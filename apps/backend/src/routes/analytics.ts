import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { getSalesFilter, getSubordinateIds } from '../services/hierarchy';
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import ExcelJS from 'exceljs';

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
        estado: { in: ['PROSPECTO_NUEVO', 'PENDIENTE_DATOS', 'PENDIENTE_DOCUMENTOS', 'LISTO_SCORE', 'SCORE_APROBADO', 'SIMULACION_ACEPTADA', 'ENVIADO_CONVENIO', 'CONVENIO_APROBADO', 'PREPARANDO_BCP', 'ENVIADO_BCP', 'APROBADO_BCP', 'OBSERVADO', 'PENDIENTE_REASIGNACION'] },
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
      where: { ...filter, estado: { in: ['APROBADO_BCP', 'CONVENIO_APROBADO', 'ENVIADO_BCP'] } },
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

    const auditNotes = await prisma.auditLog.findMany({
      where: {
        sale: filter,
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

    const salesForTiming = await prisma.sale.findMany({
      where: filter,
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

// ═══════════════════════════════════════════════════
// SPRINT 4.1 — PIRÁMIDE DE CONVERSIÓN (FUNNEL)
// Agrupa los 14+ estados en etapas de negocio
// ═══════════════════════════════════════════════════

const ETAPA_MAP: Record<string, string> = {
  'PROSPECTO_NUEVO': 'Registro',
  'PENDIENTE_DATOS': 'Registro',
  'PENDIENTE_DOCUMENTOS': 'Documentacion',
  'LISTO_SCORE': 'Score',
  'SCORE_APROBADO': 'Score',
  'SIMULACION_ACEPTADA': 'Simulacion',
  'ENVIADO_CONVENIO': 'Convenio',
  'CONVENIO_APROBADO': 'Convenio',
  'PREPARANDO_BCP': 'Conformidad BCP',
  'ENVIADO_BCP': 'Conformidad BCP',
  'APROBADO_BCP': 'Conformidad BCP',
  'OBSERVADO': 'Observado',
  'POR INGRESAR': 'Registro',
  'EN PROCESO': 'Evaluación Interna',
  'OBSERVADA': 'Evaluación Interna',
  'SUBSANADA': 'Evaluación Interna',
  'PENDIENTE_REASIGNACION': 'Evaluación Interna',
  'REASIGNADO': 'Evaluación Interna',
  'ENVIADO': 'Revisión Supervisor',
  'APROBADA': 'Aprobación',
  'CONFORMIDAD': 'Conformidad BCP',
  'EN_PREPARACION': 'Conformidad BCP',
  'EN_EVALUACION_BCP': 'Conformidad BCP',
  'DESEMBOLSADO': 'Desembolso',
  'DESEMBOLSADO_BCP': 'Desembolso',
  'RECHAZADO': 'Rechazado',
  'RECHAZADO_BCP': 'Rechazado',
  'BOLETA_NO_CALIFICA': 'Rechazado'
};

const ETAPA_ORDEN = [
  'Registro',
  'Documentacion',
  'Score',
  'Simulacion',
  'Convenio',
  'Evaluación Interna',
  'Revisión Supervisor',
  'Aprobación',
  'Conformidad BCP',
  'Observado',
  'Desembolso',
  'Rechazado'
];

router.get('/funnel', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const { fecha_inicio, fecha_fin, convenio } = req.query;

    const whereClause: any = { ...filter };

    if (fecha_inicio || fecha_fin) {
      whereClause.fecha_ingreso = {};
      if (fecha_inicio) whereClause.fecha_ingreso.gte = new Date(fecha_inicio as string);
      if (fecha_fin) whereClause.fecha_ingreso.lte = new Date(fecha_fin as string);
    }
    if (convenio) whereClause.convenio = convenio;

    const sales = await prisma.sale.findMany({
      where: whereClause,
      select: { id: true, estado: true, maf_neto: true, convenio: true }
    });

    // Agrupar por etapa
    const etapas: Record<string, { cantidad: number; monto_total: number; estados: Record<string, { cantidad: number; monto: number }> }> = {};

    for (const etapa of ETAPA_ORDEN) {
      etapas[etapa] = { cantidad: 0, monto_total: 0, estados: {} };
    }

    for (const sale of sales) {
      const etapa = ETAPA_MAP[sale.estado] || 'Otros';
      if (!etapas[etapa]) etapas[etapa] = { cantidad: 0, monto_total: 0, estados: {} };
      etapas[etapa].cantidad++;
      etapas[etapa].monto_total += sale.maf_neto;
      if (!etapas[etapa].estados[sale.estado]) etapas[etapa].estados[sale.estado] = { cantidad: 0, monto: 0 };
      etapas[etapa].estados[sale.estado].cantidad++;
      etapas[etapa].estados[sale.estado].monto += sale.maf_neto;
    }

    // Construir funnel con tasas de conversión
    const funnel = ETAPA_ORDEN.map((nombre, idx) => {
      const data = etapas[nombre] || { cantidad: 0, monto_total: 0, estados: {} };
      const tasa_entrada = sales.length > 0 ? (data.cantidad / sales.length) * 100 : 0;

      // Tasa de conversión vs etapa anterior (excepto primera y última)
      let tasa_conversion = 0;
      if (idx > 0 && idx < ETAPA_ORDEN.length - 1) {
        const etapaAnterior = etapas[ETAPA_ORDEN[idx - 1]];
        tasa_conversion = etapaAnterior.cantidad > 0 ? (data.cantidad / etapaAnterior.cantidad) * 100 : 0;
      }

      return {
        etapa: nombre,
        orden: idx + 1,
        cantidad: data.cantidad,
        monto_total: Math.round(data.monto_total * 100) / 100,
        tasa_entrada_pct: Math.round(tasa_entrada * 10) / 10,
        tasa_conversion_pct: Math.round(tasa_conversion * 10) / 10,
        estados_detalle: data.estados
      };
    });

    // Tasa de conversión global (Registro → Desembolso)
    const totalRegistro = etapas['Registro']?.cantidad || 0;
    const totalDesembolso = etapas['Desembolso']?.cantidad || 0;
    const conversionGlobal = totalRegistro > 0 ? (totalDesembolso / totalRegistro) * 100 : 0;

    res.json({
      funnel,
      resumen: {
        total_expedientes: sales.length,
        monto_total_pipeline: Math.round(sales.reduce((acc, s) => acc + s.maf_neto, 0) * 100) / 100,
        conversion_global_pct: Math.round(conversionGlobal * 10) / 10,
        etapas_activas: ETAPA_ORDEN.filter(e => (etapas[e]?.cantidad || 0) > 0).length
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
      if (fecha_inicio) whereClause.created_at.gte = new Date(fecha_inicio as string);
      if (fecha_fin) whereClause.created_at.lte = new Date(fecha_fin as string);
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
      const diffMs = ahora.getTime() - inicio.getTime();
      return {
        sale_id: sale.id,
        cliente: sale.nombres_cliente,
        estado: sale.estado,
        dias_en_estado: Math.round(diffMs / (1000 * 60 * 60 * 24)),
        horas_en_estado: Math.round(diffMs / (1000 * 60 * 60))
      };
    }).sort((a, b) => b.dias_en_estado - a.dias_en_estado);

    // Alertas: expedientes >5 días sin movimiento
    const alertas = tiempoEnEstado.filter(t => t.dias_en_estado > 5);

    res.json({
      transiciones: tiemposPorTransicion,
      ciclo_completo: {
        promedio_dias: Math.round((cicloPromedio / (1000 * 60 * 60 * 24)) * 10) / 10,
        muestras: tiemposCiclo.length
      },
      expedientes_activos: tiempoEnEstado,
      alertas_inactividad: {
        total: alertas.length,
        criticos: alertas.filter(a => a.dias_en_estado > 10).length,
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
      if (fecha_inicio) whereClause.fecha_ingreso.gte = new Date(fecha_inicio as string);
      if (fecha_fin) whereClause.fecha_ingreso.lte = new Date(fecha_fin as string);
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        asesor: { select: { id: true, nombre: true, avatar_url: true } }
      },
      orderBy: { fecha_ingreso: 'desc' }
    });

    // Definir columnas del Kanban (14 estados — flujo BCP completo)
    const columnas = [
      { key: 'PROSPECTO_NUEVO', label: 'Prospecto', color: '#6B7280', seccion: 'registro' },
      { key: 'PENDIENTE_DATOS', label: 'Pte. Datos', color: '#F59E0B', seccion: 'registro' },
      { key: 'PENDIENTE_DOCUMENTOS', label: 'Pte. Docs', color: '#D97706', seccion: 'documentos' },
      { key: 'LISTO_SCORE', label: 'Listo Score', color: '#3B82F6', seccion: 'score' },
      { key: 'SCORE_APROBADO', label: 'Score Aprobado', color: '#10B981', seccion: 'score' },
      { key: 'SIMULACION_ACEPTADA', label: 'Simulacion', color: '#0891B2', seccion: 'simulacion' },
      { key: 'ENVIADO_CONVENIO', label: 'En Convenio', color: '#4F46E5', seccion: 'convenio' },
      { key: 'CONVENIO_APROBADO', label: 'Convenio OK', color: '#0D9488', seccion: 'convenio' },
      { key: 'PREPARANDO_BCP', label: 'Preparando BCP', color: '#7C3AED', seccion: 'bcp' },
      { key: 'ENVIADO_BCP', label: 'Enviado BCP', color: '#2563EB', seccion: 'bcp' },
      { key: 'APROBADO_BCP', label: 'Aprobado BCP', color: '#10B981', seccion: 'bcp' },
      { key: 'OBSERVADO', label: 'Observado', color: '#EA580C', seccion: 'observado' },
      // Flujo original
      { key: 'POR INGRESAR', label: 'Por Ingresar', color: '#6B7280', seccion: 'recojo' },
      { key: 'EN PROCESO', label: 'En Proceso', color: '#3B82F6', seccion: 'evaluacion' },
      { key: 'OBSERVADA', label: 'Observada', color: '#F59E0B', seccion: 'evaluacion' },
      { key: 'SUBSANADA', label: 'Subsanada', color: '#8B5CF6', seccion: 'evaluacion' },
      // Flujo BCP extendido
      { key: 'PENDIENTE_DOCUMENTAR', label: 'Pte. Documentar', color: '#D97706', seccion: 'pendientes' },
      { key: 'PENDIENTE_INSTITUCIONES', label: 'Pte. Instituciones', color: '#7C3AED', seccion: 'pendientes' },
      { key: 'PENDIENTE_REMESA', label: 'Pte. Remesa', color: '#0891B2', seccion: 'pendientes' },
      { key: 'PENDIENTE_BACK_OFFICE', label: 'Pte. Back Office', color: '#4F46E5', seccion: 'back_office' },
      { key: 'OBSERVADO_BACK', label: 'Observado Back', color: '#EA580C', seccion: 'back_office' },
      { key: 'EN_EVALUACION_BCP', label: 'Evaluación BCP', color: '#2563EB', seccion: 'bcp' },
      // Finales
      { key: 'APROBADA', label: 'Aprobada', color: '#10B981', seccion: 'final' },
      { key: 'DESEMBOLSADO', label: 'Desembolsado', color: '#22C55E', seccion: 'final' },
      { key: 'RECHAZADO', label: 'Rechazado', color: '#EF4444', seccion: 'rechazo' },
      { key: 'RECHAZADA_POR_SCORE', label: 'Rechazada Score', color: '#DC2626', seccion: 'rechazo' },
      { key: 'BOLETA_NO_CALIFICA', label: 'Boleta No Califica', color: '#B91C1C', seccion: 'rechazo' },
    ];

    const kanban: Record<string, any[]> = {};
    for (const col of columnas) {
      kanban[col.key] = [];
    }

    const ahora = new Date();
    for (const sale of sales) {
      const inicioEstado = (sale as any).fecha_estado_desde || sale.created_at;
      const diasEnEstado = Math.round((ahora.getTime() - new Date(inicioEstado).getTime()) / (1000 * 60 * 60 * 24));

      const card = {
        id: sale.id,
        cliente: sale.nombres_cliente,
        dni: sale.dni_cliente,
        convenio: sale.convenio,
        monto: sale.maf_neto,
        estado: sale.estado,
        asesor: sale.asesor,
        dias_en_estado: diasEnEstado,
        alerta: diasEnEstado > 5,
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
      if (fecha_inicio) whereClause.fecha_ingreso.gte = new Date(fecha_inicio as string);
      if (fecha_fin) whereClause.fecha_ingreso.lte = new Date(fecha_fin as string);
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

    // 5. Expedientes estancados (>5 días sin movimiento)
    const ventasActivas = await prisma.sale.findMany({
      where: {
        ...filter,
        estado: { notIn: ['DESEMBOLSADO', 'RECHAZADO', 'REASIGNADO'] }
      },
      select: { id: true, estado: true, fecha_estado_desde: true, nombres_cliente: true }
    });

    const estancados = ventasActivas
      .filter(s => {
        const inicio = (s as any).fecha_estado_desde || new Date();
        const dias = Math.round((ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 5;
      })
      .map(s => ({
        cliente: s.nombres_cliente,
        estado: s.estado,
        dias: Math.round((ahora.getTime() - ((s as any).fecha_estado_desde || ahora).getTime()) / (1000 * 60 * 60 * 24))
      }))
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
