import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { calcularSimulacion } from '../services/simulator';

const router = Router();
const prisma = new PrismaClient();
const SIMULATOR_ADMIN_ROLES = ['SUPERADMIN', 'GERENTE'];

const requireSimulatorAdmin = (req: any, res: any) => {
  if (!SIMULATOR_ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'No tienes permisos para realizar esta accion' });
    return false;
  }
  return true;
};

const toOptionalNumber = (value: any) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
};

// GET /api/simulator/config
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const convenios = await prisma.convenio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
    const cargos = await prisma.cargo.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
    const configGlobal = await prisma.configuracionGlobal.findMany();
    const configMap: Record<string, any> = {};
    configGlobal.forEach(c => {
      configMap[c.clave] = c.valor_numerico !== null ? c.valor_numerico : c.valor_texto;
    });

    const reglas = await prisma.convenioCargoRegla.findMany();

    res.json({
      convenios,
      cargos,
      reglas,
      configuracion: configMap
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/simulator/calculate
router.post('/calculate', authMiddleware, async (req, res, next) => {
  try {
    const params = req.body;
    
    // Basic validation
    if (!params.convenioId || !params.cargoId || !params.montoSolicitado || !params.cuotas || params.ingresosFijos === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para la simulación' });
    }

    const resultado = await calcularSimulacion({
      convenioId: params.convenioId,
      cargoId: params.cargoId,
      edad: params.edad,
      ingresosFijos: Number(params.ingresosFijos) || 0,
      ingresosVariables: Number(params.ingresosVariables) || 0,
      promedioVariables: Number(params.promedioVariables) || 0,
      otrosIngresosFijos: Number(params.otrosIngresosFijos ?? params.cafae) || 0,
      ingresosNoConstantes: Number(params.ingresosNoConstantes) || 0,
      descuentosLey: Number(params.descuentosLey) || 0,
      otrosDescuentos: Number(params.otrosDescuentos) || 0,
      reserva: params.reserva !== undefined ? Number(params.reserva) : undefined,
      facultativos: params.facultativos !== undefined ? Number(params.facultativos) : undefined,
      montoSolicitado: Number(params.montoSolicitado),
      cuotas: Number(params.cuotas),
      envioFisico: params.envioFisico || false,
      teaManual: params.teaManual,
      periodoGracia: Number(params.periodoGracia) || 0,
      fechaDesembolso: params.fechaDesembolso,
      seguroDesgravamenTipo: params.seguroDesgravamenTipo,
      seguroDesgravamenModalidad: params.seguroDesgravamenModalidad,
      cargaCrediticia: Array.isArray(params.cargaCrediticia) ? params.cargaCrediticia : undefined,
      deudaHipotecario: params.deudaHipotecario,
      deudaEfectivo: params.deudaEfectivo,
      deudaVehicular: params.deudaVehicular,
      deudaPyme: params.deudaPyme,
      deudaComercial: params.deudaComercial,
      deudaIndirecta: params.deudaIndirecta,
      lineaUtilizadaTC: params.lineaUtilizadaTC,
      lineaNoUtilizadaTC: params.lineaNoUtilizadaTC
    });

    res.json(resultado);
  } catch (error: any) {
    // Si es un error de negocio (ej. "Ingreso insuficiente"), mandar 400
    res.status(400).json({ error: error.message });
  }
});

// POST /api/simulator/save
router.post('/save', authMiddleware, async (req: any, res, next) => {
  try {
    const { dni_cliente, convenio, cargo, montoSolicitado, cuotas, tea, cuotaMensual, capacidadMax, ingresoNeto } = req.body;
    
    const simulacion = await prisma.simulacion.create({
      data: {
        user_id: req.user.id,
        dni_cliente,
        convenio,
        cargo,
        monto_solicitado: montoSolicitado,
        cuotas,
        tea,
        cuota_mensual: cuotaMensual,
        capacidad_max: capacidadMax,
        ingreso_neto: ingresoNeto
      }
    });

    res.status(201).json(simulacion);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/simulator/config - Update Global Variables
router.patch('/config', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const { updates } = req.body; // { TEA_DEFAULT: 0.12, COSTO_ENVIO_FISICO: 12 }
    
    for (const [clave, valor] of Object.entries(updates)) {
      await prisma.configuracionGlobal.updateMany({
        where: { clave },
        data: { valor_numerico: Number(valor) }
      });
    }

    res.json({ message: 'Configuración actualizada correctamente' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/simulator/convenios/:id - Update Individual Convenio
router.patch('/convenios/:id', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const { id } = req.params;
    const { rci_default, periodo_gracia, variables_reserva, activo } = req.body;

    const updated = await prisma.convenio.update({
      where: { id },
      data: { 
        rci_default: rci_default !== undefined ? Number(rci_default) : undefined,
        periodo_gracia: periodo_gracia !== undefined ? Number(periodo_gracia) : undefined,
        variables_reserva: variables_reserva !== undefined ? Number(variables_reserva) : undefined,
        sector: req.body.sector,
        activo: typeof activo === 'boolean' ? activo : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/simulator/convenios - Create New Convenio
router.post('/convenios', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const { nombre, rci_default, periodo_gracia } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del convenio es obligatorio' });

    const newConvenio = await prisma.convenio.create({
      data: {
        nombre,
        rci_default: Number(rci_default) || 0.5,
        periodo_gracia: Number(periodo_gracia) || 0,
        sector: req.body.sector || 'Otros',
        activo: true
      }
    });

    res.status(201).json(newConvenio);
  } catch (error) {
    next(error);
  }
});

// POST /api/simulator/cargos - Create or reactivate Cargo
router.post('/cargos', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const nombre = String(req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre del cargo es obligatorio' });

    const cargo = await prisma.cargo.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true }
    });

    res.status(201).json(cargo);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/simulator/cargos/:id - Update Cargo
router.patch('/cargos/:id', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim() : undefined;
    if (nombre === '') return res.status(400).json({ error: 'El nombre del cargo no puede estar vacio' });

    const cargo = await prisma.cargo.update({
      where: { id: req.params.id },
      data: {
        nombre,
        activo: typeof req.body.activo === 'boolean' ? req.body.activo : undefined
      }
    });

    res.json(cargo);
  } catch (error) {
    next(error);
  }
});

// POST /api/simulator/reglas - Create or update RCI for Convenio + Cargo
router.post('/reglas', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const { convenio_id, cargo_id } = req.body;
    if (!convenio_id || !cargo_id) {
      return res.status(400).json({ error: 'Convenio y cargo son obligatorios' });
    }

    const rci = Number(req.body.rci_especifico);
    if (!Number.isFinite(rci) || rci <= 0) {
      return res.status(400).json({ error: 'El RCI debe ser un numero mayor a 0' });
    }

    const edadMaxima = toOptionalNumber(req.body.edad_maxima);
    if (edadMaxima !== undefined && !Number.isFinite(edadMaxima)) {
      return res.status(400).json({ error: 'La edad maxima debe ser un numero valido' });
    }
    const regla = await prisma.convenioCargoRegla.upsert({
      where: {
        convenio_id_cargo_id: {
          convenio_id,
          cargo_id
        }
      },
      update: {
        rci_especifico: rci,
        edad_maxima: edadMaxima ?? null
      },
      create: {
        convenio_id,
        cargo_id,
        rci_especifico: rci,
        edad_maxima: edadMaxima ?? null
      }
    });

    res.status(201).json(regla);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/simulator/reglas/:id - Update RCI rule
router.patch('/reglas/:id', authMiddleware, async (req: any, res, next) => {
  try {
    if (!requireSimulatorAdmin(req, res)) return;

    const rci = toOptionalNumber(req.body.rci_especifico);
    if (rci !== undefined && (!Number.isFinite(rci) || rci <= 0)) {
      return res.status(400).json({ error: 'El RCI debe ser un numero mayor a 0' });
    }

    const edadMaxima = toOptionalNumber(req.body.edad_maxima);
    if (edadMaxima !== undefined && !Number.isFinite(edadMaxima)) {
      return res.status(400).json({ error: 'La edad maxima debe ser un numero valido' });
    }
    const regla = await prisma.convenioCargoRegla.update({
      where: { id: req.params.id },
      data: {
        rci_especifico: rci,
        edad_maxima: req.body.edad_maxima === undefined ? undefined : (edadMaxima ?? null)
      }
    });

    res.json(regla);
  } catch (error) {
    next(error);
  }
});

export default router;
