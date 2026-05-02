import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { getSalesFilter, getSubordinateIds } from '../services/hierarchy';
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';

const router = Router();

// GET Dashboard Summary KPIs
router.get('/dashboard', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 1. Total Disbursed (Goal Metric)
    const disbursedData = await prisma.sale.aggregate({
      where: {
        ...filter,
        estado: 'DESEMBOLSADO',
        fecha_ingreso: { gte: monthStart, lte: monthEnd }
      },
      _sum: { maf_neto: true },
      _count: true
    });

    // 2. Active Pipeline (Pipeline Value)
    const pipelineData = await prisma.sale.aggregate({
      where: {
        ...filter,
        estado: { in: ['POR INGRESAR', 'EN PROCESO', 'APROBADA', 'OBSERVADA', 'SUBSANADA'] },
        fecha_ingreso: { gte: monthStart, lte: monthEnd }
      },
      _sum: { maf_neto: true },
      _count: true
    });

    // 3. User Goal
    const userGoal = await prisma.goal.findUnique({
      where: {
        user_id_month_year: {
          user_id: req.user.id,
          month: now.getMonth() + 1,
          year: now.getFullYear()
        }
      }
    });

    // 4. Previous Month Data (MoM)
    const prevMonthStart = startOfMonth(subDays(monthStart, 5));
    const prevMonthEnd = endOfMonth(subDays(monthStart, 5));
    const prevMonthDisbursed = await prisma.sale.aggregate({
      where: { ...filter, estado: 'DESEMBOLSADO', fecha_ingreso: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { maf_neto: true }
    });

    // 5. Calculate Metrics
    const daysInMonth = monthEnd.getDate();
    const currentDay = now.getDate();
    const totalDisbursed = disbursedData._sum.maf_neto || 0;
    const dailyAverage = currentDay > 0 ? totalDisbursed / currentDay : 0;
    const forecasting = dailyAverage * daysInMonth;

    const totalEntered = await prisma.sale.count({ where: { ...filter, fecha_ingreso: { gte: monthStart, lte: monthEnd } } });
    const approvedCount = await prisma.sale.count({ where: { ...filter, estado: 'DESEMBOLSADO', fecha_ingreso: { gte: monthStart, lte: monthEnd } } });
    
    const conversionRate = totalEntered > 0 ? (approvedCount / totalEntered) * 100 : 0;
    const momGrowth = prevMonthDisbursed._sum.maf_neto ? ((totalDisbursed - prevMonthDisbursed._sum.maf_neto) / prevMonthDisbursed._sum.maf_neto) * 100 : 0;

    const activeSellers = await prisma.sale.groupBy({ by: ['asesor_id'], where: { ...filter, fecha_ingreso: { gte: monthStart, lte: monthEnd } } });
    const productivity = activeSellers.length > 0 ? totalEntered / activeSellers.length : 0;

    const pendingValue = await prisma.sale.aggregate({
      where: { ...filter, estado: 'APROBADA' },
      _sum: { maf_neto: true }
    });

    res.json({
      totalDisbursed,
      disbursedCount: disbursedData._count,
      pipelineValue: pipelineData._sum.maf_neto || 0,
      pipelineCount: pipelineData._count,
      goalAmount: userGoal?.amount || 0,
      forecasting,
      completionRate: userGoal?.amount ? (totalDisbursed / userGoal.amount) * 100 : 0,
      conversionRate,
      momGrowth,
      productivity,
      pendingValue: pendingValue._sum.maf_neto || 0
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
    const now = new Date();
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(now);

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
    
    const geoData = await prisma.sale.groupBy({
      by: ['departamento'],
      where: {
        ...filter,
        estado: 'DESEMBOLSADO',
        departamento: { not: null }
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
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Only allow hierarchical roles to see rankings? 
    // Usually everyone can see them for competition.

    // 1. Top Vendedores (Asesores)
    const topVendedores = await prisma.sale.groupBy({
      by: ['asesor_id'],
      where: {
        estado: 'DESEMBOLSADO',
        fecha_ingreso: { gte: monthStart, lte: monthEnd }
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
          fecha_ingreso: { gte: monthStart, lte: monthEnd }
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
          fecha_ingreso: { gte: monthStart, lte: monthEnd }
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
    
    // 1. Funnel
    const funnel = await prisma.sale.groupBy({
      by: ['estado'],
      where: filter,
      _count: true
    });

    // 2. Risk Mix (Infoburo)
    const risk = await prisma.sale.groupBy({
      by: ['rcc_semaforo'],
      where: { ...filter, rcc_semaforo: { not: null } },
      _count: true
    });

    // 3. Motivos de Observación (calculado desde FeedbackNotes reales)
    const feedbackNotes = await prisma.feedbackNote.findMany({
      where: { sale: filter },
      select: { nota: true }
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
    
    for (const note of feedbackNotes) {
      const lower = note.nota.toLowerCase();
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
      where: filter,
      _sum: { maf_neto: true },
      _count: true
    });

    // 5. Tiempos de Respuesta (calculado desde AuditLog real)
    const stateChanges = await prisma.auditLog.findMany({
      where: {
        sale: filter,
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

    // Calcular tiempo promedio entre estados
    const stageTimesMs: Record<string, number[]> = {};
    const saleFirstChange: Record<string, Date> = {};

    for (const change of stateChanges) {
      const stage = change.estado_nuevo || 'Desconocido';
      if (!saleFirstChange[change.sale_id]) {
        saleFirstChange[change.sale_id] = change.created_at;
        continue;
      }
      const prev = saleFirstChange[change.sale_id];
      const diffMs = change.created_at.getTime() - prev.getTime();
      if (!stageTimesMs[stage]) stageTimesMs[stage] = [];
      stageTimesMs[stage].push(diffMs);
      saleFirstChange[change.sale_id] = change.created_at;
    }

    const responseTimes = Object.entries(stageTimesMs).map(([stage, times]) => ({
      stage,
      hours: Math.round((times.reduce((a, b) => a + b, 0) / times.length) / (1000 * 60 * 60))
    })).filter(t => t.hours > 0);

    // 6. Inactivity Radar & Efficiency
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
        where: { asesor_id: s.id },
        _count: { id: true },
        _sum: { maf_neto: true }
      });

      const approvedCount = await prisma.sale.count({
        where: { asesor_id: s.id, estado: 'DESEMBOLSADO' }
      });

      return {
        name: s.nombre,
        daysInactive,
        efficiency: stats._count.id > 0 ? (approvedCount / stats._count.id) * 100 : 0,
        volume: stats._sum.maf_neto || 0
      };
    }));

    res.json({
      funnel,
      risk,
      observations,
      agreements: agreements.map(a => ({ name: a.convenio || 'Otros', value: a._sum?.maf_neto || 0 })),
      responseTimes,
      radar: radar.filter(r => r.daysInactive >= 3).sort((a, b) => b.daysInactive - a.daysInactive),
      efficiency: radar.sort((a, b) => b.efficiency - a.efficiency).slice(0, 5)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos operativos' });
  }
});

export default router;
