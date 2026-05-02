import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { calcularSimulacion } from '../services/simulator';

const router = Router();
const prisma = new PrismaClient();

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
      ingresosFijos: params.ingresosFijos,
      ingresosVariables: params.ingresosVariables || 0,
      descuentosLey: params.descuentosLey || 0,
      otrosDescuentos: params.otrosDescuentos || 0,
      montoSolicitado: params.montoSolicitado,
      cuotas: params.cuotas,
      envioFisico: params.envioFisico || false,
      teaManual: params.teaManual,
      periodoGracia: Number(params.periodoGracia) || 0,
      // Nuevos campos de deuda
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
    if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }

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
    if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }

    const { id } = req.params;
    const { rci_default, periodo_gracia } = req.body;

    const updated = await prisma.convenio.update({
      where: { id },
      data: { 
        rci_default: rci_default !== undefined ? Number(rci_default) : undefined,
        periodo_gracia: periodo_gracia !== undefined ? Number(periodo_gracia) : undefined,
        sector: req.body.sector
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
    if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }

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

export default router;
