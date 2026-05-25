import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { GLOBAL_ROLES, getSalesFilter, getSubordinateIds } from '../services/hierarchy';
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import ExcelJS from 'exceljs';
import { ACTIVE_ESTADOS, KANBAN_COLUMNS } from '../middleware/validate';
import { buildSlaSnapshot, getSlaInfo } from '../services/sla';

const router = Router();
const GOAL_ROLES = ['VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL'];
const DAY_MS = 1000 * 60 * 60 * 24;

const parseDateQuery = (value: unknown, fallback: Date, end = false) => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return end ? endOfDay(parsed) : startOfDay(parsed);
};

const getDateRange = (req: any) => {
  const now = new Date();
  const defaultStart = startOfMonth(now);
  const defaultEnd = endOfMonth(now);
  const requestedStart = parseDateQuery(req.query.fecha_inicio, defaultStart);
  const requestedEnd = parseDateQuery(req.query.fecha_fin, defaultEnd, true);

  if (requestedEnd < requestedStart) {
    return { startDate: requestedEnd, endDate: requestedStart };
  }

  return { startDate: requestedStart, endDate: requestedEnd };
};

const getPreviousRange = (startDate: Date, endDate: Date) => {
  const rangeDays = Math.max(Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS), 1);
  const previousEnd = endOfDay(subDays(startDate, 1));
  const previousStart = startOfDay(subDays(previousEnd, rangeDays - 1));
  return { previousStart, previousEnd };
};

const getGoalPeriods = (startDate: Date, endDate: Date) => {
  const periods: Array<{ month: number; year: number; start: Date; end: Date; weight: number }> = [];
  let cursor = startOfMonth(startDate);
  const finalMonth = startOfMonth(endDate);

  while (cursor <= finalMonth) {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const overlapStart = new Date(Math.max(monthStart.getTime(), startDate.getTime()));
    const overlapEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));
    const monthDays = Math.max(Math.floor((startOfDay(monthEnd).getTime() - startOfDay(monthStart).getTime()) / DAY_MS) + 1, 1);
    const overlapDays = Math.max(Math.floor((startOfDay(overlapEnd).getTime() - startOfDay(overlapStart).getTime()) / DAY_MS) + 1, 0);

    periods.push({
      month: monthStart.getMonth() + 1,
      year: monthStart.getFullYear(),
      start: monthStart,
      end: monthEnd,
      weight: Math.min(Math.max(overlapDays / monthDays, 0), 1)
    });

    cursor = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return periods;
};

const getVisibleGoalUserIds = async (user: any) => {
  if (GLOBAL_ROLES.includes(user.role)) {
    const users = await prisma.user.findMany({
      where: { role: { in: GOAL_ROLES }, activo: true },
      select: { id: true }
    });
    return users.map((item) => item.id);
  }

  if (user.role === 'SUPERVISOR' || user.role === 'JEFE_ZONAL') {
    const subIds = await getSubordinateIds(user.id);
    return [user.id, ...subIds];
  }

  return [user.id];
};

const getGoalAmountByUser = async (userIds: string[], startDate: Date, endDate: Date) => {
  const periods = getGoalPeriods(startDate, endDate);
  if (userIds.length === 0 || periods.length === 0) return new Map<string, number>();

  const goals = await prisma.goal.findMany({
    where: {
      user_id: { in: userIds },
      OR: periods.map((period) => ({ month: period.month, year: period.year }))
    },
    select: { user_id: true, month: true, year: true, amount: true }
  });

  const periodWeight = new Map(periods.map((period) => [`${period.month}-${period.year}`, period.weight]));
  const byUser = new Map<string, number>();

  for (const goal of goals) {
    const weight = periodWeight.get(`${goal.month}-${goal.year}`) ?? 1;
    byUser.set(goal.user_id, (byUser.get(goal.user_id) || 0) + ((Number(goal.amount) || 0) * weight));
  }

  return byUser;
};

// GET Dashboard Summary KPIs
router.get('/dashboard', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { startDate, endDate } = getDateRange(req);
    const dateFilter = { fecha_ingreso: { gte: startDate, lte: endDate } };
    const now = new Date();

    // 1. Total Disbursed (Goal Metric)
    const disbursedData = await prisma.sale.aggregate({
      where: {
        ...filter,
        estado: 'DESEMBOLSADO',
        ...dateFilter
      },
      _sum: { maf_neto: true },
      _count: true
    });

    // 2. Active Pipeline (Pipeline Value)
    const pipelineData = await prisma.sale.aggregate({
      where: {
        ...filter,
        estado: { in: ACTIVE_ESTADOS },
        ...dateFilter
      },
      _sum: { maf_neto: true },
      _count: true
    });

    // 3. Visible Goal. Managers see the visible team goal, sellers see their own goal.
    const goalUserIds = await getVisibleGoalUserIds(req.user);
    const goalByUser = await getGoalAmountByUser(goalUserIds, startDate, endDate);
    const goalAmount = [...goalByUser.values()].reduce((acc, amount) => acc + amount, 0);

    // 4. Previous comparable period data
    const { previousStart, previousEnd } = getPreviousRange(startDate, endDate);
    const prevMonthDisbursed = await prisma.sale.aggregate({
      where: { ...filter, estado: 'DESEMBOLSADO', fecha_ingreso: { gte: previousStart, lte: previousEnd } },
      _sum: { maf_neto: true }
    });

    // 5. Calculate Metrics
    const periodDays = Math.max(Math.floor((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / DAY_MS) + 1, 1);
    const elapsedDays = now >= startDate && now <= endDate
      ? Math.max(Math.floor((startOfDay(now).getTime() - startOfDay(startDate).getTime()) / DAY_MS) + 1, 1)
      : periodDays;
    const totalDisbursed = disbursedData._sum.maf_neto || 0;
    const dailyAverage = elapsedDays > 0 ? totalDisbursed / elapsedDays : 0;
    const forecasting = dailyAverage * periodDays;

    const totalEntered = await prisma.sale.count({ where: { ...filter, ...dateFilter } });
    const approvedCount = await prisma.sale.count({ where: { ...filter, estado: 'DESEMBOLSADO', ...dateFilter } });
    
    const conversionRate = totalEntered > 0 ? (approvedCount / totalEntered) * 100 : 0;
    const momGrowth = prevMonthDisbursed._sum.maf_neto ? ((totalDisbursed - prevMonthDisbursed._sum.maf_neto) / prevMonthDisbursed._sum.maf_neto) * 100 : 0;

    const activeSellers = await prisma.sale.groupBy({ by: ['asesor_id'], where: { ...filter, ...dateFilter } });
    const productivity = activeSellers.length > 0 ? totalEntered / activeSellers.length : 0;

    const pendingValue = await prisma.sale.aggregate({
      where: { ...filter, estado: { in: ['FILE_VALIDADO', 'ENVIADO_BCP_REMESA', 'REMESA_APROBADA', 'REMESA_REDUCIDA', 'PENDIENTE_DESEMBOLSO', 'PENDIENTE_LIBERACION'] }, ...dateFilter },
      _sum: { maf_neto: true }
    });

    res.json({
      totalDisbursed,
      disbursedCount: disbursedData._count,
      pipelineValue: pipelineData._sum.maf_neto || 0,
      pipelineCount: pipelineData._count,
      goalAmount,
      forecasting,
      completionRate: goalAmount ? (totalDisbursed / goalAmount) * 100 : 0,
      conversionRate,
      momGrowth,
      productivity,
      pendingValue: pendingValue._sum.maf_neto || 0,
      period: {
        fecha_inicio: format(startDate, 'yyyy-MM-dd'),
        fecha_fin: format(endDate, 'yyyy-MM-dd')
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen de analítica' });
  }
});

// GET Daily Time Series
router.get('/timeseries', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { startDate, endDate } = getDateRange(req);

    const sales = await prisma.sale.findMany({
      where: {
        ...filter,
        fecha_ingreso: { gte: startDate, lte: endDate }
      },
      select: {
        maf_neto: true,
        estado: true,
        fecha_ingreso: true
      }
    });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const timeSeries = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySales = sales.filter(s => s.fecha_ingreso && format(new Date(s.fecha_ingreso), 'yyyy-MM-dd') === dayStr);
      
      return {
        date: dayStr,
        ingresado: daySales.reduce((acc, s) => acc + s.maf_neto, 0),
        desembolsado: daySales
          .filter(s => s.estado === 'DESEMBOLSADO')
          .reduce((acc, s) => acc + s.maf_neto, 0)
      };
    });

    res.json(timeSeries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener serie temporal' });
  }
});

// GET Geographic Data (Map)
router.get('/geography', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { startDate, endDate } = getDateRange(req);
    
    const geoData = await prisma.sale.groupBy({
      by: ['departamento'],
      where: {
        ...filter,
        estado: 'DESEMBOLSADO',
        departamento: { not: null },
        fecha_ingreso: { gte: startDate, lte: endDate }
      },
      _sum: { maf_neto: true },
      _count: true
    });

    res.json(geoData.map(d => ({
      region: d.departamento,
      value: d._sum.maf_neto || 0,
      count: d._count
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos geográficos' });
  }
});

// GET Rankings (Hall of Fame)
router.get('/rankings', authMiddleware, async (req: any, res: any) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    // Only allow hierarchical roles to see rankings? 
    // Usually everyone can see them for competition.

    // 1. Top Vendedores (Asesores)
    const topVendedores = await prisma.sale.groupBy({
      by: ['asesor_id'],
      where: {
        estado: 'DESEMBOLSADO',
        fecha_ingreso: { gte: startDate, lte: endDate }
      },
      _sum: { maf_neto: true },
      orderBy: { _sum: { maf_neto: 'desc' } },
      take: 5
    });

    const populatedVendedores = await Promise.all(topVendedores.map(async (v) => {
      const user = await prisma.user.findUnique({ where: { id: v.asesor_id }, select: { nombre: true, avatar_url: true }});
      return { name: user?.nombre || 'Desconocido', value: v._sum.maf_neto || 0, avatar: user?.avatar_url };
    }));

    // 2. Top Supervisores (Sum of their teams)
    const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR' }, select: { id: true, nombre: true, avatar_url: true }});
    const topSupervisores = await Promise.all(supervisors.map(async (s) => {
      const subIds = await getSubordinateIds(s.id);
      const total = await prisma.sale.aggregate({
        where: {
          asesor_id: { in: [s.id, ...subIds] },
          estado: 'DESEMBOLSADO',
          fecha_ingreso: { gte: startDate, lte: endDate }
        },
        _sum: { maf_neto: true }
      });
      return { name: s.nombre, value: total._sum.maf_neto || 0, avatar: s.avatar_url };
    }));

    // 3. Top Zonas
    const zones = await prisma.zone.findMany({ select: { id: true, nombre: true }});
    const topZones = await Promise.all(zones.map(async (z) => {
      const total = await prisma.sale.aggregate({
        where: {
          asesor: { zone_id: z.id },
          estado: 'DESEMBOLSADO',
          fecha_ingreso: { gte: startDate, lte: endDate }
        },
        _sum: { maf_neto: true }
      });
      return { name: z.nombre, value: total._sum.maf_neto || 0 };
    }));

    res.json({
      vendedores: populatedVendedores,
      supervisores: topSupervisores.sort((a, b) => b.value - a.value).slice(0, 5),
      zonas: topZones.sort((a, b) => b.value - a.value).slice(0, 5)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

// GET Funnel & Quality
router.get('/operations', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const now = new Date();
    const { startDate, endDate } = getDateRange(req);
    const periodFilter = {
      ...filter,
      fecha_ingreso: { gte: startDate, lte: endDate }
    };
    
    // 1. Funnel
    const funnel = await prisma.sale.groupBy({
      by: ['estado'],
      where: periodFilter,
      _count: true
    });

    // 2. Risk Mix (Infoburo)
    const risk = await prisma.sale.groupBy({
      by: ['rcc_semaforo'],
      where: { ...periodFilter, rcc_semaforo: { not: null } },
      _count: true
    });

    // 3. Motivos de Observación (calculado desde FeedbackNotes reales)
    const feedbackNotes = await prisma.feedbackNote.findMany({
      where: { sale: periodFilter },
      select: { nota: true }
    });

    const auditNotes = await prisma.auditLog.findMany({
      where: {
        sale: periodFilter,
        detalles: { not: null }
      },
      select: { detalles: true }
    });
    
    // Clasificar notas por categoría usando keywords
    const categories: Record<string, number> = {};
    const keywords: Record<string, string[]> = {
      'DNI / Datos': ['dni', 'dato', 'datos', 'documento de identidad'],
      'Firma': ['firma', 'firmar', 'sin firma'],
      'Sustento': ['sustento', 'ingreso', 'boleta', 'recibo'],
      'RCC / Riesgo': ['rcc', 'riesgo', 'deuda', 'semaforo', 'semáforo'],
      'Documentación': ['documento', 'falta', 'adjunto', 'archivo'],
      'Convenio': ['convenio', 'producto', 'tipo']
    };

    const observationTexts: string[] = [
      ...feedbackNotes.map(note => note.nota),
      ...auditNotes.map(note => note.detalles || '')
    ].filter((text): text is string => Boolean(text));
    
    for (const text of observationTexts) {
      const lower = text.toLowerCase();
      let matched = false;
      for (const [cat, words] of Object.entries(keywords)) {
        if (words.some(w => lower.includes(w))) {
          categories[cat] = (categories[cat] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched) {
        categories['Otros'] = (categories['Otros'] || 0) + 1;
      }
    }
    
    const observations = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 4. Agreement Mix (Convenios)
    const agreements = await prisma.sale.groupBy({
      by: ['convenio'],
      where: periodFilter,
      _sum: { maf_neto: true },
      _count: true
    });

    // 5. Tiempos de Respuesta (calculado desde AuditLog real)
    const stateChanges = await prisma.auditLog.findMany({
      where: {
        sale: periodFilter,
        accion: 'Cambio de Estado'
      },
      select: {
        estado_anterior: true,
        estado_nuevo: true,
        created_at: true,
        sale_id: true
      },
      orderBy: { created_at: 'asc' }
    });

    const salesForTiming = await prisma.sale.findMany({
      where: periodFilter,
      select: { id: true, created_at: true, fecha_ingreso: true }
    });

    const saleBaseDates = new Map<string, Date>();
    for (const sale of salesForTiming) {
      saleBaseDates.set(sale.id, sale.fecha_ingreso || sale.created_at);
    }

    // Calcular tiempo promedio desde el registro y entre cada cambio de estado
    const stageTimesMs: Record<string, number[]> = {};
    const saleCursor: Record<string, Date> = {};

    for (const change of stateChanges) {
      const stage = change.estado_nuevo || 'Desconocido';
      const prev = saleCursor[change.sale_id] || saleBaseDates.get(change.sale_id) || change.created_at;
      const diffMs = change.created_at.getTime() - prev.getTime();
      if (diffMs >= 0) {
        if (!stageTimesMs[stage]) stageTimesMs[stage] = [];
        stageTimesMs[stage].push(diffMs);
      }
      saleCursor[change.sale_id] = change.created_at;
    }

    const responseTimes = Object.entries(stageTimesMs).map(([stage, times]) => ({
      stage,
      hours: Math.round(((times.reduce((a, b) => a + b, 0) / times.length) / (1000 * 60 * 60)) * 10) / 10,
      samples: times.length
    })).sort((a, b) => b.hours - a.hours);

    // 6. Alertas SLA por estado activo
    const activeSalesForSla = await prisma.sale.findMany({
      where: {
        ...filter,
        estado: { in: ACTIVE_ESTADOS }
      },
      select: {
        id: true,
        estado: true,
        fecha_estado_desde: true,
        created_at: true,
        nombres_cliente: true,
        maf_neto: true,
        asesor: { select: { nombre: true, username: true } }
      }
    });

    const sla = buildSlaSnapshot(activeSalesForSla, now);

    // 7. Inactivity Radar & Efficiency
    const subordinates = await prisma.user.findMany({
      where: {
        id: { in: await getSubordinateIds(req.user.id) },
        role: 'VENDEDOR'
      },
      select: { id: true, nombre: true }
    });

    const radar = await Promise.all(subordinates.map(async (s) => {
      const lastSale = await prisma.sale.findFirst({
        where: { asesor_id: s.id },
        orderBy: { fecha_ingreso: 'desc' }
      });
      
      const daysInactive = lastSale?.fecha_ingreso 
        ? Math.floor((new Date().getTime() - new Date(lastSale.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24))
        : 99;

      const stats = await prisma.sale.aggregate({
        where: { asesor_id: s.id, fecha_ingreso: { gte: startDate, lte: endDate } },
        _count: { id: true },
        _sum: { maf_neto: true }
      });

      const approvedCount = await prisma.sale.count({
        where: { asesor_id: s.id, estado: 'DESEMBOLSADO', fecha_ingreso: { gte: startDate, lte: endDate } }
      });

      return {
        name: s.nombre,
        daysInactive,
        efficiency: stats._count.id > 0 ? (approvedCount / stats._count.id) * 100 : 0,
        volume: stats._sum.maf_neto || 0
      };
    }));

    // 8. Tablas de gestión para decisiones comerciales del mes
    const summaryWhere = periodFilter;
    const goalUserIds = await getVisibleGoalUserIds(req.user);

    const [summarySales, goalByUser] = await Promise.all([
      prisma.sale.findMany({
        where: summaryWhere,
        select: {
          estado: true,
          maf_neto: true,
          convenio: true,
          plaza: true,
          departamento: true,
          zona_comercial: true,
          asesor_id: true,
          asesor: {
            select: {
              id: true,
              nombre: true,
              supervisor_id: true,
              supervisor: { select: { id: true, nombre: true } },
              zone: { select: { id: true, nombre: true } }
            }
          }
        }
      }),
      getGoalAmountByUser(goalUserIds, startDate, endDate)
    ]);

    const createBucket = (key: string, name: string, zone?: string) => ({
      key,
      name,
      zone: zone || 'Sin zona',
      userIds: new Set<string>(),
      prospectos: 0,
      qDesembolso: 0,
      totalDesembolso: 0,
      pipeline: 0,
      evaluacionBcp: 0,
      pendienteBack: 0,
      pendienteRemesa: 0,
      rechazados: 0
    });

    const addSaleToBucket = (bucket: ReturnType<typeof createBucket>, sale: typeof summarySales[number]) => {
      const amount = Number(sale.maf_neto) || 0;
      bucket.userIds.add(sale.asesor_id);
      bucket.prospectos += 1;
      if (sale.estado === 'DESEMBOLSADO') {
        bucket.qDesembolso += 1;
        bucket.totalDesembolso += amount;
      }
      if ((ACTIVE_ESTADOS as readonly string[]).includes(sale.estado)) bucket.pipeline += amount;
      if (['ENVIADO_BCP_REMESA', 'OBS_BCP'].includes(sale.estado)) bucket.evaluacionBcp += amount;
      if (['VALIDACION_BACK_OFFICE', 'OBS_BACK_OFFICE'].includes(sale.estado)) bucket.pendienteBack += amount;
      if (['REMESA_APROBADA', 'REMESA_REDUCIDA', 'PENDIENTE_DESEMBOLSO', 'PENDIENTE_LIBERACION'].includes(sale.estado)) bucket.pendienteRemesa += amount;
      if (sale.estado === 'RECHAZADO') bucket.rechazados += 1;
    };

    const finalizeBucket = (bucket: ReturnType<typeof createBucket>) => {
      const meta = [...bucket.userIds].reduce<number>((acc, userId) => acc + (goalByUser.get(userId) || 0), 0);
      return {
        key: bucket.key,
        name: bucket.name,
        zone: bucket.zone,
        prospectos: bucket.prospectos,
        q_desembolso: bucket.qDesembolso,
        total_desembolso: Math.round(bucket.totalDesembolso * 100) / 100,
        pipeline: Math.round(bucket.pipeline * 100) / 100,
        evaluacion_bcp: Math.round(bucket.evaluacionBcp * 100) / 100,
        pendiente_back: Math.round(bucket.pendienteBack * 100) / 100,
        pendiente_remesa: Math.round(bucket.pendienteRemesa * 100) / 100,
        rechazados: bucket.rechazados,
        meta: Math.round(meta * 100) / 100,
        avance: meta > 0 ? Math.round((bucket.totalDesembolso / meta) * 1000) / 10 : 0,
        ticket_promedio: bucket.qDesembolso > 0 ? Math.round((bucket.totalDesembolso / bucket.qDesembolso) * 100) / 100 : 0
      };
    };

    const supervisorBuckets = new Map<string, ReturnType<typeof createBucket>>();
    const zoneBuckets = new Map<string, ReturnType<typeof createBucket>>();
    const agreementBuckets = new Map<string, ReturnType<typeof createBucket>>();

    for (const sale of summarySales) {
      const zoneName = sale.asesor?.zone?.nombre || sale.zona_comercial || sale.plaza || sale.departamento || 'Sin zona';
      const supervisorId = sale.asesor?.supervisor?.id || sale.asesor?.id || sale.asesor_id;
      const supervisorName = sale.asesor?.supervisor?.nombre || sale.asesor?.nombre || 'Sin responsable';
      const agreementName = sale.convenio || 'Sin convenio';

      if (!supervisorBuckets.has(supervisorId)) {
        supervisorBuckets.set(supervisorId, createBucket(supervisorId, supervisorName, zoneName));
      }
      if (!zoneBuckets.has(zoneName)) {
        zoneBuckets.set(zoneName, createBucket(zoneName, zoneName, zoneName));
      }
      if (!agreementBuckets.has(agreementName)) {
        agreementBuckets.set(agreementName, createBucket(agreementName, agreementName, zoneName));
      }

      addSaleToBucket(supervisorBuckets.get(supervisorId)!, sale);
      addSaleToBucket(zoneBuckets.get(zoneName)!, sale);
      addSaleToBucket(agreementBuckets.get(agreementName)!, sale);
    }

    const sortSummary = (items: Array<ReturnType<typeof finalizeBucket>>) => (
      items.sort((a, b) => b.total_desembolso - a.total_desembolso || b.pipeline - a.pipeline || b.prospectos - a.prospectos)
    );

    res.json({
      funnel,
      risk,
      observations,
      agreements: agreements.map(a => ({ name: a.convenio || 'Otros', value: a._sum?.maf_neto || 0 })),
      responseTimes,
      sla,
      radar: radar.filter(r => r.daysInactive >= 3).sort((a, b) => b.daysInactive - a.daysInactive),
      efficiency: radar.sort((a, b) => b.efficiency - a.efficiency).slice(0, 5),
      summaries: {
        supervisors: sortSummary([...supervisorBuckets.values()].map(finalizeBucket)),
        zones: sortSummary([...zoneBuckets.values()].map(finalizeBucket)),
        agreements: sortSummary([...agreementBuckets.values()].map(finalizeBucket))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos operativos' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 4.1 — FUNNEL COMERCIAL ACUMULATIVO
// Mide cuantos prospectos llegaron a cada hito de negocio.
// ═══════════════════════════════════════════════════

const DOCUMENTED_OR_LATER_STATES = [
  'PENDIENTE_DATOS_FILE',
  'VALIDACION_BACK_OFFICE',
  'OBS_BACK_OFFICE',
  'FILE_VALIDADO',
  'ENVIADO_BCP_REMESA',
  'OBS_BCP',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO'
];

const FILE_VALIDATED_OR_LATER_STATES = [
  'FILE_VALIDADO',
  'ENVIADO_BCP_REMESA',
  'OBS_BCP',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO'
];

const SENT_BCP_OR_LATER_STATES = [
  'ENVIADO_BCP_REMESA',
  'OBS_BCP',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO'
];

const REMESA_APPROVED_OR_LATER_STATES = [
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO'
];

const hasAnyState = (states: Set<string>, candidates: string[]) => (
  candidates.some((state) => states.has(state))
);

const isCalculatorApproved = (sale: any, states: Set<string>) => {
  if (hasAnyState(states, DOCUMENTED_OR_LATER_STATES)) return true;

  const calculadora = String(sale.calculadora_estado || '').toUpperCase();
  const dictamen = String(sale.simulacion_dictamen || '').toUpperCase();
  const rechazoMotivo = String(sale.rechazo_motivo || '').toUpperCase();

  if (calculadora === 'RECHAZADO' || rechazoMotivo === 'CALCULADORA_NO_CALIFICA') return false;

  return calculadora === 'APROBADO' ||
    dictamen === 'CONTINUAR' ||
    Boolean(sale.simulacion_id);
};

const hasPassedEvaluation = (sale: any, states: Set<string>) => {
  const semaforo = String(sale.rcc_semaforo || '').toUpperCase();
  const rechazoMotivo = String(sale.rechazo_motivo || '').toUpperCase();

  if (sale.estado === 'RECHAZADO' && ['BURO_NO_CALIFICA', 'CLIENTE_CON_MALA_DEUDA', 'CONYUGE_NO_CALIFICA'].includes(rechazoMotivo)) return false;

  return (Boolean(semaforo) && semaforo !== 'ROJO') ||
    isCalculatorApproved(sale, states) ||
    hasAnyState(states, DOCUMENTED_OR_LATER_STATES) ||
    ['SCORE_BCP_NO_CALIFICA', 'CALCULADORA_NO_CALIFICA', 'DOCUMENTOS_INVALIDOS', 'BCP_RECHAZA'].includes(rechazoMotivo);
};

const FUNNEL_STAGES = [
  {
    etapa: 'Prospectos',
    descripcion: 'Prospectos registrados por vendedores',
    reached: () => true
  },
  {
    etapa: 'Verificacion OK',
    descripcion: 'Pasaron filtro de sistema y conyuge si aplica',
    reached: hasPassedEvaluation
  },
  {
    etapa: 'Score BCP',
    descripcion: 'Pasaron o llegaron a score interno BCP',
    reached: (sale: any, states: Set<string>) => hasAnyState(states, ['SCORE_BCP', 'PENDIENTE_BOLETA', 'EVALUACION_CALCULADORA', 'COTIZACION_ENVIADA', ...DOCUMENTED_OR_LATER_STATES]) ||
      ['SCORE_BCP_NO_CALIFICA', 'CALCULADORA_NO_CALIFICA', 'DOCUMENTOS_INVALIDOS', 'BCP_RECHAZA'].includes(String(sale.rechazo_motivo || ''))
  },
  {
    etapa: 'Calculadora aprobada',
    descripcion: 'Simulacion calificada para continuar',
    reached: isCalculatorApproved
  },
  {
    etapa: 'Cliente acepto',
    descripcion: 'Acepto la propuesta y pasa a documentar',
    reached: (sale: any, states: Set<string>) => hasAnyState(states, DOCUMENTED_OR_LATER_STATES) ||
      ['DOCUMENTOS_INVALIDOS', 'BCP_RECHAZA'].includes(String(sale.rechazo_motivo || ''))
  },
  {
    etapa: 'File validado',
    descripcion: 'Back office valido el expediente',
    reached: (sale: any, states: Set<string>) => hasAnyState(states, FILE_VALIDATED_OR_LATER_STATES) ||
      String(sale.rechazo_motivo || '') === 'BCP_RECHAZA'
  },
  {
    etapa: 'Enviado a BCP',
    descripcion: 'File enviado a BCP para remesa',
    reached: (sale: any, states: Set<string>) => hasAnyState(states, SENT_BCP_OR_LATER_STATES) ||
      String(sale.rechazo_motivo || '') === 'BCP_RECHAZA'
  },
  {
    etapa: 'Remesa aprobada',
    descripcion: 'BCP aprobo remesa completa o reducida',
    reached: (_sale: any, states: Set<string>) => hasAnyState(states, REMESA_APPROVED_OR_LATER_STATES)
  },
  {
    etapa: 'Desembolsado',
    descripcion: 'Credito desembolsado',
    reached: (_sale: any, states: Set<string>) => states.has('DESEMBOLSADO')
  }
];

router.get('/funnel', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { fecha_inicio, fecha_fin, convenio } = req.query;

    const whereClause: any = { ...filter };

    if (fecha_inicio || fecha_fin) {
      whereClause.fecha_ingreso = {};
      if (fecha_inicio) whereClause.fecha_ingreso.gte = parseDateQuery(fecha_inicio, startOfDay(new Date()));
      if (fecha_fin) whereClause.fecha_ingreso.lte = parseDateQuery(fecha_fin, endOfDay(new Date()), true);
    }
    if (convenio) whereClause.convenio = convenio;

    const sales = await prisma.sale.findMany({
      where: whereClause,
      select: {
        id: true,
        estado: true,
        maf_neto: true,
        convenio: true,
        rcc_semaforo: true,
        rechazo_motivo: true,
        calculadora_estado: true,
        simulacion_dictamen: true,
        simulacion_id: true,
        audit_logs: {
          select: { estado_nuevo: true },
          where: { estado_nuevo: { not: null } }
        }
      }
    });

    const reachedBySale = sales.map((sale) => ({
      sale,
      states: new Set([
        sale.estado,
        ...(sale.audit_logs || []).map((log) => log.estado_nuevo).filter(Boolean) as string[]
      ])
    }));

    const funnel = FUNNEL_STAGES.map((stage, idx) => {
      const stageSales = reachedBySale.filter(({ sale, states }) => stage.reached(sale, states));
      const previousCount = idx === 0
        ? stageSales.length
        : reachedBySale.filter(({ sale, states }) => FUNNEL_STAGES[idx - 1].reached(sale, states)).length;
      const cantidad = stageSales.length;
      const montoTotal = stageSales.reduce((acc, { sale }) => acc + Number(sale.maf_neto || 0), 0);
      const tasaEntrada = sales.length > 0 ? (cantidad / sales.length) * 100 : 0;
      const tasaConversion = idx === 0
        ? 100
        : previousCount > 0 ? (cantidad / previousCount) * 100 : 0;

      return {
        etapa: stage.etapa,
        descripcion: stage.descripcion,
        orden: idx + 1,
        cantidad,
        monto_total: Math.round(montoTotal * 100) / 100,
        tasa_entrada_pct: Math.round(tasaEntrada * 10) / 10,
        tasa_conversion_pct: Math.round(tasaConversion * 10) / 10,
        estados_detalle: {}
      }
    });

    const totalRegistro = funnel[0]?.cantidad || 0;
    const totalDesembolso = funnel[funnel.length - 1]?.cantidad || 0;
    const conversionGlobal = totalRegistro > 0 ? (totalDesembolso / totalRegistro) * 100 : 0;

    res.json({
      funnel,
      resumen: {
        total_expedientes: sales.length,
        monto_total_pipeline: Math.round(sales.reduce((acc, s) => acc + Number(s.maf_neto || 0), 0) * 100) / 100,
        conversion_global_pct: Math.round(conversionGlobal * 10) / 10,
        etapas_activas: funnel.filter(e => e.cantidad > 0).length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener funnel de conversión' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 4.2 — DASHBOARD DE TIEMPOS PROMEDIO
// Calcula días promedio entre estados usando AuditLog
// ═══════════════════════════════════════════════════

router.get('/tiempos', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { fecha_inicio, fecha_fin } = req.query;

    const whereClause: any = {
      sale: filter,
      accion: 'Cambio de Estado'
    };

    if (fecha_inicio || fecha_fin) {
      whereClause.created_at = {};
      if (fecha_inicio) whereClause.created_at.gte = parseDateQuery(fecha_inicio, startOfDay(new Date()));
      if (fecha_fin) whereClause.created_at.lte = parseDateQuery(fecha_fin, endOfDay(new Date()), true);
    }

    const stateChanges = await prisma.auditLog.findMany({
      where: whereClause,
      select: {
        sale_id: true,
        estado_anterior: true,
        estado_nuevo: true,
        created_at: true
      },
      orderBy: { created_at: 'asc' }
    });

    // Agrupar por sale_id y calcular tiempos entre cada transición
    const salesChanges: Record<string, typeof stateChanges> = {};
    for (const change of stateChanges) {
      if (!salesChanges[change.sale_id]) salesChanges[change.sale_id] = [];
      salesChanges[change.sale_id].push(change);
    }

    // Calcular tiempos por transición (origen → destino)
    const transiciones: Record<string, { tiempos: number[]; desde: string; hasta: string }> = {};

    for (const [saleId, changes] of Object.entries(salesChanges)) {
      for (let i = 1; i < changes.length; i++) {
        const desde = changes[i - 1].estado_nuevo || 'INICIO';
        const hasta = changes[i].estado_nuevo || 'FIN';
        const key = `${desde} → ${hasta}`;
        const diffMs = changes[i].created_at.getTime() - changes[i - 1].created_at.getTime();

        if (!transiciones[key]) transiciones[key] = { tiempos: [], desde, hasta };
        transiciones[key].tiempos.push(diffMs);
      }
    }

    // Calcular estadísticas por transición
    const tiemposPorTransicion = Object.entries(transiciones)
      .map(([key, data]) => {
        const tiempos = data.tiempos;
        const sorted = [...tiempos].sort((a, b) => a - b);
        const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
        const mediana = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];

        return {
          transicion: key,
          desde: data.desde,
          hasta: data.hasta,
          cantidad: tiempos.length,
          promedio_dias: Math.round((promedio / (1000 * 60 * 60 * 24)) * 10) / 10,
          mediana_dias: Math.round((mediana / (1000 * 60 * 60 * 24)) * 10) / 10,
          min_dias: Math.round((min / (1000 * 60 * 60 * 24)) * 10) / 10,
          max_dias: Math.round((max / (1000 * 60 * 60 * 24)) * 10) / 10,
          promedio_horas: Math.round(promedio / (1000 * 60 * 60))
        };
      })
      .sort((a, b) => b.cantidad - a.cantidad);

    // Tiempo total del ciclo (primer registro → desembolso)
    const tiemposCiclo: number[] = [];
    for (const [saleId, changes] of Object.entries(salesChanges)) {
      const primerCambio = changes[0];
      const ultimoCambio = changes[changes.length - 1];
      if (primerCambio && ultimoCambio) {
        const cicloMs = ultimoCambio.created_at.getTime() - primerCambio.created_at.getTime();
        tiemposCiclo.push(cicloMs);
      }
    }

    const cicloPromedio = tiemposCiclo.length > 0
      ? tiemposCiclo.reduce((a, b) => a + b, 0) / tiemposCiclo.length
      : 0;

    // Tiempo actual en cada estado (expedientes activos)
    const ventasActivas = await prisma.sale.findMany({
      where: {
        ...filter,
        estado: { notIn: ['DESEMBOLSADO', 'RECHAZADO', 'REASIGNADO'] }
      },
      select: { id: true, estado: true, fecha_estado_desde: true, created_at: true, nombres_cliente: true }
    });

    const ahora = new Date();
    const tiempoEnEstado = ventasActivas.map(sale => {
      const inicio = (sale as any).fecha_estado_desde || sale.created_at;
      return {
        sale_id: sale.id,
        cliente: sale.nombres_cliente,
        ...getSlaInfo(sale.estado, inicio, ahora)
      };
    }).sort((a, b) => (b.progreso_pct || 0) - (a.progreso_pct || 0));

    const alertas = tiempoEnEstado.filter(t => t.vencido || t.nivel === 'POR_VENCER');

    res.json({
      transiciones: tiemposPorTransicion,
      ciclo_completo: {
        promedio_dias: Math.round((cicloPromedio / (1000 * 60 * 60 * 24)) * 10) / 10,
        muestras: tiemposCiclo.length
      },
      expedientes_activos: tiempoEnEstado,
      alertas_inactividad: {
        total: alertas.length,
        criticos: alertas.filter(a => a.nivel === 'CRITICO').length,
        vencidos: alertas.filter(a => a.vencido).length,
        por_vencer: alertas.filter(a => a.nivel === 'POR_VENCER').length,
        expedientes: alertas
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tiempos promedio' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 4.3 — PIPELINE VISUAL (KANBAN)
// Retorna ventas agrupadas por estado para vista Kanban
// ═══════════════════════════════════════════════════

router.get('/kanban', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { convenio, asesor_id, fecha_inicio, fecha_fin } = req.query;

    const whereClause: any = {
      ...filter,
      estado: { notIn: ['REASIGNADO'] }
    };

    if (convenio) whereClause.convenio = convenio;
    if (asesor_id) whereClause.asesor_id = asesor_id;
    if (fecha_inicio || fecha_fin) {
      whereClause.fecha_ingreso = {};
      if (fecha_inicio) whereClause.fecha_ingreso.gte = parseDateQuery(fecha_inicio, startOfDay(new Date()));
      if (fecha_fin) whereClause.fecha_ingreso.lte = parseDateQuery(fecha_fin, endOfDay(new Date()), true);
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        asesor: { select: { id: true, nombre: true, avatar_url: true } }
      },
      orderBy: { fecha_ingreso: 'desc' }
    });

    const columnas = KANBAN_COLUMNS;

    const kanban: Record<string, any[]> = {};
    for (const col of columnas) {
      kanban[col.key] = [];
    }

    const ahora = new Date();
    for (const sale of sales) {
      const inicioEstado = (sale as any).fecha_estado_desde || sale.created_at;
      const sla = getSlaInfo(sale.estado, inicioEstado, ahora);

      const card = {
        id: sale.id,
        cliente: sale.nombres_cliente,
        dni: sale.dni_cliente,
        convenio: sale.convenio,
        monto: sale.maf_neto,
        estado: sale.estado,
        asesor: sale.asesor,
        dias_en_estado: sla.dias_en_estado,
        horas_en_estado: sla.horas_en_estado,
        sla_dias: sla.sla_dias,
        sla_nivel: sla.nivel,
        sla_responsable: sla.sla_responsable,
        sla_progreso_pct: sla.progreso_pct,
        dias_restantes: sla.dias_restantes,
        siguiente_accion: sla.siguiente_accion,
        alerta: sla.vencido || sla.nivel === 'POR_VENCER',
        fecha_ingreso: sale.fecha_ingreso,
        simulacion_cuota: (sale as any).simulacion_cuota || null
      };

      if (kanban[sale.estado]) {
        kanban[sale.estado].push(card);
      }
    }

    // Resumen por columna
    const resumen = columnas.map(col => ({
      ...col,
      cantidad: kanban[col.key]?.length || 0,
      monto_total: Math.round((kanban[col.key]?.reduce((acc: number, s: any) => acc + s.monto, 0) || 0) * 100) / 100
    }));

    res.json({
      columnas: resumen,
      datos: kanban,
      filtros_aplicados: { convenio, asesor_id, fecha_inicio, fecha_fin }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pipeline Kanban' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 4.4 — EXPORTACIÓN DE REPORTES (EXCEL)
// Genera Excel con el reporte completo o filtrado
// ═══════════════════════════════════════════════════

router.get('/export/excel', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { fecha_inicio, fecha_fin, convenio, estado } = req.query;

    const whereClause: any = { ...filter };
    if (fecha_inicio || fecha_fin) {
      whereClause.fecha_ingreso = {};
      if (fecha_inicio) whereClause.fecha_ingreso.gte = parseDateQuery(fecha_inicio, startOfDay(new Date()));
      if (fecha_fin) whereClause.fecha_ingreso.lte = parseDateQuery(fecha_fin, endOfDay(new Date()), true);
    }
    if (convenio) whereClause.convenio = convenio;
    if (estado) whereClause.estado = estado;

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        asesor: { select: { nombre: true } },
        documents: { select: { tipo_documento: true } },
        expediente_instituciones: { select: { institucion: true, estado: true } },
        expediente_bcp: { select: { estado: true, nro_expediente: true } }
      },
      orderBy: { fecha_ingreso: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fuvex Manager';
    workbook.created = new Date();

    // ─── Hoja 1: Expedientes ───
    const ws = workbook.addWorksheet('Expedientes', {
      properties: { tabColor: { argb: '3B82F6' } }
    });

    ws.columns = [
      { header: 'DNI', key: 'dni', width: 12 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Convenio', key: 'convenio', width: 20 },
      { header: 'MAF Neto', key: 'monto', width: 15 },
      { header: 'Estado', key: 'estado', width: 20 },
      { header: 'Asesor', key: 'asesor', width: 25 },
      { header: 'Fecha Ingreso', key: 'fecha_ingreso', width: 18 },
      { header: 'Días en Estado', key: 'dias_estado', width: 15 },
      { header: 'Estado BCP', key: 'estado_bcp', width: 18 },
      { header: 'Instituciones', key: 'instituciones', width: 30 },
      { header: 'Docs Subidos', key: 'docs_count', width: 12 },
      { header: 'Plaza', key: 'plaza', width: 15 },
      { header: 'Departamento', key: 'departamento', width: 18 }
    ];

    // Estilo header
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
    ws.getRow(1).alignment = { horizontal: 'center' };

    const ahora = new Date();
    for (const sale of sales) {
      const inicioEstado = (sale as any).fecha_estado_desde || sale.created_at;
      const diasEstado = Math.round((ahora.getTime() - new Date(inicioEstado).getTime()) / (1000 * 60 * 60 * 24));
      const insts = (sale as any).expediente_instituciones?.map((i: any) => `${i.institucion}(${i.estado})`).join(', ') || '';

      const row = ws.addRow({
        dni: sale.dni_cliente,
        cliente: sale.nombres_cliente,
        convenio: sale.convenio || '-',
        monto: sale.maf_neto,
        estado: sale.estado,
        asesor: sale.asesor?.nombre || '-',
        fecha_ingreso: sale.fecha_ingreso ? format(new Date(sale.fecha_ingreso), 'dd/MM/yyyy') : '-',
        dias_estado: diasEstado,
        estado_bcp: (sale as any).expediente_bcp?.estado || '-',
        instituciones: insts,
        docs_count: sale.documents.length,
        plaza: sale.plaza || '-',
        departamento: sale.departamento || '-'
      });

      // Colorear alertas de tiempo
      if (diasEstado > 10) {
        row.getCell('dias_estado').font = { color: { argb: 'EF4444' }, bold: true };
      } else if (diasEstado > 5) {
        row.getCell('dias_estado').font = { color: { argb: 'F59E0B' }, bold: true };
      }
    }

    ws.autoFilter = { from: 'A1', to: `M${sales.length + 1}` };

    // ─── Hoja 2: Resumen por Estado ───
    const wsResumen = workbook.addWorksheet('Resumen por Estado', {
      properties: { tabColor: { argb: '10B981' } }
    });

    wsResumen.columns = [
      { header: 'Estado', key: 'estado', width: 25 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Monto Total', key: 'monto', width: 18 },
      { header: 'Monto Promedio', key: 'promedio', width: 18 },
      { header: '% del Total', key: 'pct', width: 12 }
    ];

    wsResumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    wsResumen.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } };

    const estadoGroups: Record<string, { cantidad: number; monto: number }> = {};
    for (const sale of sales) {
      if (!estadoGroups[sale.estado]) estadoGroups[sale.estado] = { cantidad: 0, monto: 0 };
      estadoGroups[sale.estado].cantidad++;
      estadoGroups[sale.estado].monto += sale.maf_neto;
    }

    const totalMonto = sales.reduce((acc, s) => acc + s.maf_neto, 0);
    for (const [estado, data] of Object.entries(estadoGroups).sort((a, b) => b[1].monto - a[1].monto)) {
      wsResumen.addRow({
        estado,
        cantidad: data.cantidad,
        monto: Math.round(data.monto * 100) / 100,
        promedio: Math.round((data.monto / data.cantidad) * 100) / 100,
        pct: totalMonto > 0 ? Math.round((data.monto / totalMonto) * 1000) / 10 : 0
      });
    }

    // ─── Hoja 3: Tiempos por Transición ───
    const stateChanges = await prisma.auditLog.findMany({
      where: { sale: filter, accion: 'Cambio de Estado' },
      select: { sale_id: true, estado_anterior: true, estado_nuevo: true, created_at: true },
      orderBy: { created_at: 'asc' }
    });

    const wsTiempos = workbook.addWorksheet('Tiempos entre Estados', {
      properties: { tabColor: { argb: 'F59E0B' } }
    });

    wsTiempos.columns = [
      { header: 'Transición', key: 'transicion', width: 35 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Promedio (días)', key: 'promedio', width: 15 },
      { header: 'Mediana (días)', key: 'mediana', width: 15 },
      { header: 'Mín (días)', key: 'min', width: 12 },
      { header: 'Máx (días)', key: 'max', width: 12 }
    ];

    wsTiempos.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    wsTiempos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } };

    // Recalcular tiempos
    const salesChangesMap: Record<string, typeof stateChanges> = {};
    for (const change of stateChanges) {
      if (!salesChangesMap[change.sale_id]) salesChangesMap[change.sale_id] = [];
      salesChangesMap[change.sale_id].push(change);
    }

    const transMs: Record<string, number[]> = {};
    for (const changes of Object.values(salesChangesMap)) {
      for (let i = 1; i < changes.length; i++) {
        const key = `${changes[i - 1].estado_nuevo} → ${changes[i].estado_nuevo}`;
        const diff = changes[i].created_at.getTime() - changes[i - 1].created_at.getTime();
        if (!transMs[key]) transMs[key] = [];
        transMs[key].push(diff);
      }
    }

    const DAY_MS = 1000 * 60 * 60 * 24;
    for (const [key, times] of Object.entries(transMs).sort((a, b) => b[1].length - a[1].length)) {
      const sorted = [...times].sort((a, b) => a - b);
      wsTiempos.addRow({
        transicion: key,
        cantidad: times.length,
        promedio: Math.round((times.reduce((a, b) => a + b, 0) / times.length / DAY_MS) * 10) / 10,
        mediana: Math.round((sorted[Math.floor(sorted.length / 2)] / DAY_MS) * 10) / 10,
        min: Math.round((sorted[0] / DAY_MS) * 10) / 10,
        max: Math.round((sorted[sorted.length - 1] / DAY_MS) * 10) / 10
      });
    }

    // Generar y enviar
    const fecha = format(new Date(), 'yyyy-MM-dd_HHmm');
    const filename = `Fuvex_Reporte_${fecha}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte Excel' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 4.5 — REPORTE SEMANAL
// Resumen de actividad de la última semana
// ═══════════════════════════════════════════════════

router.get('/reporte-semanal', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const ahora = new Date();
    const haceSemana = subDays(ahora, 7);

    // 1. Expedientes creados en la semana
    const creadosSemana = await prisma.sale.findMany({
      where: {
        ...filter,
        fecha_ingreso: { gte: haceSemana, lte: ahora }
      },
      include: { asesor: { select: { nombre: true } } }
    });

    // 2. Desembolsos de la semana
    const desembolsosSemana = await prisma.sale.findMany({
      where: {
        ...filter,
        estado: 'DESEMBOLSADO',
        fecha_desembolso: { gte: haceSemana, lte: ahora }
      },
      include: { asesor: { select: { nombre: true } } }
    });

    // 3. Cambios de estado de la semana
    const cambiosEstado = await prisma.auditLog.findMany({
      where: {
        sale: filter,
        accion: 'Cambio de Estado',
        created_at: { gte: haceSemana, lte: ahora }
      },
      select: {
        estado_anterior: true,
        estado_nuevo: true,
        created_at: true,
        sale_id: true
      }
    });

    // 4. Contar cambios por tipo de transición
    const transicionesSemana: Record<string, number> = {};
    for (const cambio of cambiosEstado) {
      const key = `${cambio.estado_anterior || 'INICIO'} → ${cambio.estado_nuevo}`;
      transicionesSemana[key] = (transicionesSemana[key] || 0) + 1;
    }

    // 5. Expedientes fuera de SLA o por vencer
    const ventasActivas = await prisma.sale.findMany({
      where: {
        ...filter,
        estado: { notIn: ['DESEMBOLSADO', 'RECHAZADO', 'REASIGNADO'] }
      },
      select: { id: true, estado: true, fecha_estado_desde: true, nombres_cliente: true }
    });

    const estancados = ventasActivas
      .map(s => {
        const sla = getSlaInfo(s.estado, (s as any).fecha_estado_desde || ahora, ahora);
        return {
          cliente: s.nombres_cliente,
          estado: s.estado,
          dias: sla.dias_en_estado,
          sla_dias: sla.sla_dias,
          nivel: sla.nivel,
          responsable: sla.sla_responsable,
          siguiente_accion: sla.siguiente_accion
        };
      })
      .filter(s => ['POR_VENCER', 'VENCIDO', 'CRITICO'].includes(s.nivel))
      .sort((a, b) => b.dias - a.dias);

    // 6. Top asesores de la semana
    const topAsesores: Record<string, { nombre: string; cantidad: number; monto: number }> = {};
    for (const sale of creadosSemana) {
      const key = sale.asesor_id;
      if (!topAsesores[key]) topAsesores[key] = { nombre: sale.asesor?.nombre || 'N/A', cantidad: 0, monto: 0 };
      topAsesores[key].cantidad++;
      topAsesores[key].monto += sale.maf_neto;
    }

    const rankingAsesores = Object.values(topAsesores)
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);

    // Construir reporte
    res.json({
      periodo: {
        desde: format(haceSemana, 'yyyy-MM-dd'),
        hasta: format(ahora, 'yyyy-MM-dd')
      },
      resumen: {
        nuevos_expedientes: creadosSemana.length,
        monto_ingresado: Math.round(creadosSemana.reduce((acc, s) => acc + s.maf_neto, 0) * 100) / 100,
        desembolsos: desembolsosSemana.length,
        monto_desembolsado: Math.round(desembolsosSemana.reduce((acc, s) => acc + s.maf_neto, 0) * 100) / 100,
        total_cambios_estado: cambiosEstado.length
      },
      transiciones: Object.entries(transicionesSemana)
        .map(([transicion, cantidad]) => ({ transicion, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
      expedientes_estancados: {
        total: estancados.length,
        lista: estancados
      },
      top_asesores: rankingAsesores
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte semanal' });
  }
});

export default router;
