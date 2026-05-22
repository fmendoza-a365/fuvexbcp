import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { requireAction } from '../middleware/permissions';
import { canAccessSale, getSalesFilter } from '../services/hierarchy';
import { upload } from '../middleware/upload';
import { getDniInfo } from '../services/dni';
import { sendPushNotification } from '../services/push';
import { validateCreateSale, validateEstadoChange, filterProtectedFields, validateTransition, getValidTransitions, VALID_ESTADOS, CATALOGO_MOTIVOS, getEstadoLabel, ACTIVE_ESTADOS, DOCUMENT_REQUIRED_STATES, REJECTION_REASONS } from '../middleware/validate';
import { sendStoredDocument, storeUploadedDocument } from '../services/storage';
import { calcularSimulacion } from '../services/simulator';
import { getSlaInfo } from '../services/sla';
import { generateAndStoreFilledAgreement } from '../services/pdfService';

const router = Router();

const triggerPdfGeneration = (saleId: string, userId: string) => {
  generateAndStoreFilledAgreement(saleId, userId).catch(err => {
    console.error(`Error in background PDF auto-filling for sale ${saleId}:`, err);
  });
};

const isMarried = (estadoCivil?: string | null) => (
  /CASAD/i.test(String(estadoCivil || ''))
);

const saleResponse = (sale: any) => ({
  ...sale,
  documents: (sale.documents || []).map((doc: any) => ({
    ...doc,
    url: `/api/sales/${sale.id}/documentos/${doc.id}/download`
  }))
});

const isValidRejectionReason = (value: any) => (
  typeof value === 'string' && (REJECTION_REASONS as readonly string[]).includes(value)
);

const isSimulationApproved = (resultado: any) => {
  const validaciones = resultado?.validaciones || {};
  const resumen = resultado?.resumen || {};
  return resumen.dictamen === 'CONTINUAR' &&
    validaciones.rci_valido !== false &&
    validaciones.cem_valido !== false &&
    validaciones.endeudamiento_valido !== false;
};

const parseExpectedVersion = (req: any): number | undefined | null => {
  const raw = req.body?.expected_version ?? req.headers?.['if-match'];
  if (raw === undefined || raw === null || raw === '') return undefined;

  const value = Array.isArray(raw) ? raw[0] : String(raw);
  const normalized = value.replace(/^W\//, '').replace(/"/g, '').trim();
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const conflictResponse = (res: any) => (
  res.status(409).json({
    error: 'El expediente fue actualizado por otro usuario. Recarga la informacion antes de guardar.',
    code: 'VERSION_CONFLICT'
  })
);

const toJsonOrNull = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const safeParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const TIMELINE_TYPES = ['all', 'state', 'note', 'document', 'rcc', 'mail', 'digitalizacion', 'system'] as const;

const normalizeTimelineType = (value: any) => {
  const type = String(value || 'all').toLowerCase();
  return TIMELINE_TYPES.includes(type as any) ? type : 'all';
};

const classifyAuditAction = (accion?: string | null, estadoNuevo?: string | null) => {
  const text = String(accion || '').toLowerCase();
  if (estadoNuevo || text.includes('estado') || text.includes('reasignaci')) return 'state';
  if (text.includes('documento')) return 'document';
  if (text.includes('rcc') || text.includes('infoburo') || text.includes('buro')) return 'rcc';
  if (text.includes('correo') || text.includes('mail')) return 'mail';
  if (text.includes('digital') || text.includes('bcp') || text.includes('instituci')) return 'digitalizacion';
  return 'system';
};

const timelineTitle = (accion?: string | null, estadoNuevo?: string | null) => (
  estadoNuevo ? `Cambio a ${estadoNuevo}` : (accion || 'Actualizacion')
);

const timelineText = (log: any) => {
  if (log.detalles) return log.detalles;
  if (log.estado_anterior || log.estado_nuevo) {
    return [log.estado_anterior || 'Inicio', log.estado_nuevo || 'Sin nuevo estado'].join(' -> ');
  }
  return log.accion || 'Evento registrado';
};

async function requireSaleAccess(req: any, res: any, sale: { asesor_id: string } | null): Promise<boolean> {
  if (!sale) {
    res.status(404).json({ error: 'Venta no encontrada' });
    return false;
  }

  if (!(await canAccessSale(req.user, sale))) {
    res.status(403).json({ error: 'No tienes permisos para acceder a este expediente' });
    return false;
  }

  return true;
}

async function getMissingRequiredDocuments(saleId: string, convenio?: string | null) {
  const docsRequeridos = await prisma.documentoRequerido.findMany({
    where: {
      activo: true,
      obligatorio: true,
      OR: [
        { convenio: convenio || 'GENERIC' },
        { convenio: '*' },
        { convenio: 'GENERIC' }
      ]
    }
  });
  const docsObligatorios = Array.from(new Map<string, typeof docsRequeridos[number]>(docsRequeridos.map(doc => [doc.tipo_doc, doc] as [string, typeof docsRequeridos[number]])).values());
  if (docsObligatorios.length === 0) return [];

  const docsSubidos = await prisma.document.findMany({
    where: {
      sale_id: saleId,
      tipo_documento: { not: 'DESTITUIDO' }
    }
  });
  const tiposSubidos = new Set(docsSubidos.map(doc => doc.tipo_documento));
  return docsObligatorios
    .filter(doc => !tiposSubidos.has(doc.tipo_doc))
    .map(doc => ({ tipo: doc.tipo_doc, nombre: doc.nombre }));
}

async function autoAdvanceDocumentedSale(saleId: string, userId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.estado !== 'PENDIENTE_DATOS_FILE') return;

  const missingDocs = await getMissingRequiredDocuments(saleId, sale.convenio);
  if (missingDocs.length > 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        estado: 'VALIDACION_BACK_OFFICE',
        fecha_estado_desde: new Date(),
        version: { increment: 1 }
      }
    });
    await tx.auditLog.create({
      data: {
        sale_id: saleId,
        user_id: userId,
        accion: 'Auto-avance documental',
        estado_anterior: sale.estado,
        estado_nuevo: 'VALIDACION_BACK_OFFICE',
        detalles: 'Documentos obligatorios completos; expediente enviado a revision de back office.'
      }
    });
  });
}

// GET all sales (Filtered by role hierarchy)
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { q } = req.query;
    const filter = await getSalesFilter(req.user);

    // Paginación: default 100, max 500
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    // Add text search if query 'q' is provided
    const searchFilter = q ? {
      OR: [
        { dni_cliente: { contains: String(q) } },
        { nombres_cliente: { contains: String(q), mode: 'insensitive' as any } },
        { id: { contains: String(q) } }
      ]
    } : {};

    const whereClause = { ...filter, ...searchFilter };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        include: {
          asesor: { select: { username: true, nombre: true } },
          documents: true,
          feedbackNotes: {
            include: { user: { select: { username: true, nombre: true } } },
            orderBy: { created_at: 'desc' },
            take: 3
          },
          audit_logs: {
            where: { detalles: { not: null } },
            include: { user: { select: { username: true, nombre: true } } },
            orderBy: { created_at: 'desc' },
            take: 3
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.sale.count({ where: whereClause })
    ]);

    res.json({
      data: sales.map(saleResponse),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las ventas' });
  }
});

// GET reasignaciones pendientes (Solo JEFE_ZONAL y GERENTE)
// IMPORTANTE: Esta ruta DEBE ir ANTES de /:id para que Express no la capture como id
router.get('/reasignaciones', authMiddleware, authorize('JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    // If JEFE_ZONAL, filter to their zone only
    let zoneFilter = {};
    if (req.user.role === 'JEFE_ZONAL') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.zone_id) {
        zoneFilter = {
          asesor: {
            zone_id: user.zone_id
          }
        };
      }
    }

    const reasignaciones = await prisma.sale.findMany({
      where: {
        reasignacion_estado: 'PENDIENTE',
        ...zoneFilter
      },
      include: {
        asesor: { select: { username: true, nombre: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    // Populate original vendor names
    const populated = await Promise.all(reasignaciones.map(async (r) => {
      let originalVendor: any = null;
      if (r.reasignacion_de) {
        originalVendor = await prisma.user.findUnique({
          where: { id: r.reasignacion_de },
          select: { username: true, nombre: true }
        });
      }
      return { ...r, original_vendor: originalVendor };
    }));

    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reasignaciones' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/sales/motivos/:estado
// Catálogo de motivos frecuentes para un estado destino
// IMPORTANTE: Debe ir ANTES de /:id para evitar conflicto de parámetros
// ══════════════════════════════════════════════════
router.get('/motivos/:estado', authMiddleware, (req: any, res: any) => {
  try {
    const { estado } = req.params;
    const catalogo = (CATALOGO_MOTIVOS as any)[estado];
    if (!catalogo) {
      return res.json({ estado, motivos: [] });
    }
    res.json({ estado, motivos: catalogo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener catálogo de motivos' });
  }
});

// GET DNI Info (Age, Birthdate)
// IMPORTANTE: Debe ir ANTES de /:id para evitar conflicto de parámetros
router.get('/dni/:dni', authMiddleware, async (req: any, res: any) => {
  try {
    const { dni } = req.params;
    if (!dni || !/^\d{8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI inválido' });
    }

    const info = await getDniInfo(dni);
    res.json(info);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// GET complete timeline for one sale. Kept separate from /:id so detail views stay light.
router.get('/:id/timeline', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const type = normalizeTimelineType(req.query.type);

    const sale = await prisma.sale.findUnique({
      where: { id },
      select: {
        id: true,
        asesor_id: true,
        feedback: true,
        created_at: true,
        fecha_ingreso: true,
        asesor: { select: { id: true, username: true, nombre: true, role: true } }
      }
    });

    if (!(await requireSaleAccess(req, res, sale))) return;

    const [auditLogs, feedbackNotes] = await Promise.all([
      prisma.auditLog.findMany({
        where: { sale_id: id },
        include: { user: { select: { id: true, username: true, nombre: true, role: true } } },
        orderBy: { created_at: 'desc' }
      }),
      prisma.feedbackNote.findMany({
        where: { sale_id: id },
        include: { user: { select: { id: true, username: true, nombre: true, role: true } } },
        orderBy: { created_at: 'desc' }
      })
    ]);

    const allEvents = [
      ...(sale?.feedback ? [{
        id: 'feedback-inicial',
        source: 'sale',
        type: 'note',
        title: 'Observacion inicial',
        text: sale.feedback,
        created_at: sale.created_at || sale.fecha_ingreso,
        actor: sale.asesor
      }] : []),
      ...feedbackNotes.map((note) => ({
        id: note.id,
        source: 'feedback_note',
        type: 'note',
        title: 'Nota del expediente',
        text: note.nota,
        created_at: note.created_at,
        actor: note.user
      })),
      ...auditLogs.map((log) => ({
        id: log.id,
        source: 'audit_log',
        type: classifyAuditAction(log.accion, log.estado_nuevo),
        title: timelineTitle(log.accion, log.estado_nuevo),
        text: timelineText(log),
        accion: log.accion,
        estado_anterior: log.estado_anterior,
        estado_nuevo: log.estado_nuevo,
        created_at: log.created_at,
        actor: log.user
      }))
    ]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const totalByType = allEvents.reduce((acc: Record<string, number>, event: any) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
    const events = allEvents.filter((event) => type === 'all' || event.type === type);
    const start = (page - 1) * limit;

    res.json({
      data: events.slice(start, start + limit),
      filters: TIMELINE_TYPES,
      totalByType,
      pagination: {
        page,
        limit,
        total: events.length,
        pages: Math.ceil(events.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sale timeline:', error);
    res.status(500).json({ error: 'Error al obtener la trazabilidad del expediente' });
  }
});

// GET single sale by ID (with access control)
router.get('/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        asesor: { select: { id: true, username: true, nombre: true, role: true } },
        documents: true,
        feedbackNotes: {
          include: { user: { select: { id: true, username: true, nombre: true, role: true } } },
          orderBy: { created_at: 'desc' },
          take: 10
        },
        audit_logs: {
          where: { detalles: { not: null } },
          include: { user: { select: { id: true, username: true, nombre: true, role: true } } },
          orderBy: { created_at: 'desc' },
          take: 10
        }
      }
    });

    if (!(await requireSaleAccess(req, res, sale))) return;

    res.json(saleResponse(sale));
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Error al obtener el expediente' });
  }
});

// CREATE Sale (Permitido para Vendedores, Supervisores y Admins para pruebas y gestión)
router.post('/', authMiddleware, authorize('VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), validateCreateSale, async (req: any, res: any) => {
  try {
    const {
      dni_cliente, nombres_cliente, celular, telefono_alt, correo, direccion,
      plaza, departamento, provincia, distrito, zona_comercial,
      convenio, entidad_laboral, cargo_laboral, maf_neto, monto_solicitado,
      plazo_deseado, origen_prospecto, consentimiento, consentimiento_at,
      fecha_filtro, fecha_desembolso, estado_remesa,
      carta_compra_deuda, monto_remesa, vencimiento_remesa, feedback,
      rechazo_motivo, rechazo_detalle, calculadora_estado, simulacion_dictamen,
      simulacion_payload, simulacion_resultado, simulacion_cuota, simulacion_tea,
      simulacion_plazo, simulacion_monto, simulacion_id,
      compra_deuda, compra_deuda_entidad, compra_deuda_monto, compra_deuda_estado,
      fecha_liberacion, estado_civil_cliente, conyuge_dni, conyuge_nombres,
      score_bcp_estado, score_bcp_detalle, score_bcp_fecha, boleta_recibida_at,
      cotizacion_monto, cotizacion_cuota, cotizacion_plazo, cotizacion_enviada_at,
      cotizacion_aceptada_at, remesa_monto_original, remesa_monto_aprobado,
      remesa_reducida_aceptada, carta_poder_recibida_at, carta_no_adeudo_at
    } = req.body;

    // Check if there is an active sale for this DNI
    const previousSale = await prisma.sale.findFirst({
      where: {
        dni_cliente,
        estado: { in: ACTIVE_ESTADOS }
      },
      orderBy: { created_at: 'desc' }
    });

    const calculadoraEstado = String(calculadora_estado || '').toUpperCase();
    const simulacionResultado = typeof simulacion_resultado === 'string'
      ? safeParseJson(simulacion_resultado)
      : simulacion_resultado;
    const simulacionAprobada = calculadoraEstado === 'APROBADO' ||
      (simulacionResultado ? isSimulationApproved(simulacionResultado) : false);
    const motivoRechazoInicial = isValidRejectionReason(rechazo_motivo)
      ? rechazo_motivo
      : (calculadoraEstado === 'RECHAZADO' ? 'CALCULADORA_NO_CALIFICA' : null);
    const simulationPlazo = simulacion_plazo
      ? Number(simulacion_plazo)
      : (simulacionResultado?.resumen?.plazo ?? (plazo_deseado ? Number(plazo_deseado) : null));
    const simulationMonto = simulacion_monto
      ? Number(simulacion_monto)
      : (simulacionResultado?.resumen?.monto_solicitado ?? (Number(monto_solicitado ?? maf_neto) || null));

    let estado = motivoRechazoInicial ? "RECHAZADO" : "PROSPECTO_NUEVO";
    let reasignacion_estado: string | null = null;
    let reasignacion_de: string | null = null;

    if (previousSale && previousSale.asesor_id !== req.user.id) {
      // Duplicated DNI handled by another vendor! Flag for reassignment
      estado = "PENDIENTE_REASIGNACION";
      reasignacion_estado = "PENDIENTE";
      reasignacion_de = previousSale.asesor_id;
    }

    const sale = await prisma.sale.create({
      data: {
        dni_cliente,
        nombres_cliente,
        celular,
        telefono_alt,
        correo,
        direccion,
        plaza,
        departamento,
        provincia,
        distrito,
        zona_comercial,
        convenio,
        entidad_laboral,
        cargo_laboral,
        maf_neto: Number(maf_neto) || 0,
        monto_solicitado: Number(monto_solicitado ?? maf_neto) || 0,
        plazo_deseado: plazo_deseado ? Number(plazo_deseado) : null,
        origen_prospecto,
        consentimiento: Boolean(consentimiento),
        consentimiento_at: consentimiento_at ? new Date(consentimiento_at) : new Date(),
        fecha_filtro: fecha_filtro ? new Date(fecha_filtro) : null,
        fecha_desembolso: fecha_desembolso ? new Date(fecha_desembolso) : null,
        estado_remesa,
        carta_compra_deuda: carta_compra_deuda ? new Date(carta_compra_deuda) : null,
        monto_remesa: monto_remesa ? Number(monto_remesa) : 0,
        vencimiento_remesa: vencimiento_remesa ? new Date(vencimiento_remesa) : null,
        feedback,
        rechazo_motivo: motivoRechazoInicial,
        rechazo_detalle: rechazo_detalle || (motivoRechazoInicial ? feedback : null),
        calculadora_estado: calculadoraEstado || (simulacionAprobada ? 'APROBADO' : null),
        simulacion_dictamen: simulacion_dictamen || simulacionResultado?.resumen?.dictamen || null,
        simulacion_payload: toJsonOrNull(simulacion_payload),
        simulacion_resultado: toJsonOrNull(simulacion_resultado),
        simulacion_cuota: simulacion_cuota ? Number(simulacion_cuota) : (simulacionResultado?.resumen?.cuota_mensual ?? null),
        simulacion_tea: simulacion_tea ? Number(simulacion_tea) : (simulacionResultado?.resumen?.tea ?? null),
        simulacion_plazo: simulationPlazo,
        simulacion_monto: simulationMonto,
        simulacion_id: simulacion_id || null,
        compra_deuda: Boolean(compra_deuda),
        compra_deuda_entidad: compra_deuda_entidad || null,
        compra_deuda_monto: compra_deuda_monto ? Number(compra_deuda_monto) : null,
        compra_deuda_estado: compra_deuda_estado || (compra_deuda ? 'PENDIENTE' : null),
        fecha_liberacion: fecha_liberacion ? new Date(fecha_liberacion) : null,
        estado_civil_cliente: estado_civil_cliente || null,
        conyuge_dni: conyuge_dni || null,
        conyuge_nombres: conyuge_nombres || null,
        score_bcp_estado: score_bcp_estado || null,
        score_bcp_detalle: score_bcp_detalle || null,
        score_bcp_fecha: score_bcp_fecha ? new Date(score_bcp_fecha) : null,
        boleta_recibida_at: boleta_recibida_at ? new Date(boleta_recibida_at) : null,
        cotizacion_monto: cotizacion_monto ? Number(cotizacion_monto) : null,
        cotizacion_cuota: cotizacion_cuota ? Number(cotizacion_cuota) : null,
        cotizacion_plazo: cotizacion_plazo ? Number(cotizacion_plazo) : null,
        cotizacion_enviada_at: cotizacion_enviada_at ? new Date(cotizacion_enviada_at) : null,
        cotizacion_aceptada_at: cotizacion_aceptada_at ? new Date(cotizacion_aceptada_at) : null,
        remesa_monto_original: remesa_monto_original ? Number(remesa_monto_original) : null,
        remesa_monto_aprobado: remesa_monto_aprobado ? Number(remesa_monto_aprobado) : null,
        remesa_reducida_aceptada: remesa_reducida_aceptada === undefined ? null : Boolean(remesa_reducida_aceptada),
        carta_poder_recibida_at: carta_poder_recibida_at ? new Date(carta_poder_recibida_at) : null,
        carta_no_adeudo_at: carta_no_adeudo_at ? new Date(carta_no_adeudo_at) : null,
        asesor_id: req.user.id,
        estado,
        reasignacion_estado,
        reasignacion_de
      }
    });

    await prisma.auditLog.create({
      data: {
        sale_id: sale.id,
        user_id: req.user.id,
        accion: "Creación de Venta",
        estado_nuevo: estado,
        detalles: estado === "PENDIENTE_REASIGNACION"
          ? `Prospecto creado para DNI: ${dni_cliente} (bloqueado por duplicidad, requiere reasignacion)`
          : `Prospecto creado | DNI: ${dni_cliente} | Celular: ${celular} | Convenio: ${convenio} | Cargo: ${cargo_laboral} | Monto: S/ ${Number(maf_neto).toLocaleString('es-PE')} | Estado inicial: ${estado}`
      }
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la venta' });
  }
});

// APROBAR/RECHAZAR REASIGNACION
router.put('/:id/reasignacion', authMiddleware, authorize('JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { accion, motivo } = req.body; // accion: 'APROBAR' | 'RECHAZAR'
    const expectedVersion = parseExpectedVersion(req);
    if (expectedVersion === null) {
      return res.status(400).json({ error: 'expected_version debe ser un numero entero positivo' });
    }

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;
    if (expectedVersion && sale.version !== expectedVersion) return conflictResponse(res);
    if (sale.reasignacion_estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'La venta no está pendiente de reasignación' });
    }

    const nuevoEstado = accion === 'APROBAR' ? 'PROSPECTO_NUEVO' : 'RECHAZADO';

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          reasignacion_estado: accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
          reasignacion_por: req.user.id,
          reasignacion_motivo: motivo,
          reasignacion_fecha: new Date(),
          version: { increment: 1 }
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Reasignación",
          estado_anterior: sale.estado,
          estado_nuevo: nuevoEstado,
          detalles: `${accion === 'APROBAR' ? 'Reasignación Aprobada' : 'Reasignación Rechazada'}. Motivo: ${motivo}`
        }
      });

      // If approved, mark the old active sale as 'REASIGNADO' (if it exists)
      if (accion === 'APROBAR' && sale.reasignacion_de) {
        const oldSale = await tx.sale.findFirst({
          where: {
            dni_cliente: sale.dni_cliente,
            asesor_id: sale.reasignacion_de,
            estado: {
              in: ACTIVE_ESTADOS
            }
          },
          orderBy: { created_at: 'desc' }
        });

        if (oldSale) {
          await tx.sale.update({
            where: { id: oldSale.id },
            data: { estado: 'REASIGNADO', version: { increment: 1 } }
          });
          await tx.auditLog.create({
            data: {
              sale_id: oldSale.id,
              user_id: req.user.id,
              accion: "Pérdida por Reasignación",
              estado_anterior: oldSale.estado,
              estado_nuevo: 'REASIGNADO',
              detalles: `Cliente reasignado al asesor ID: ${sale.asesor_id}`
            }
          });
        }
      }

      return updated;
    });

    res.json(updatedSale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar reasignación' });
  }
});

// Update state machine — con validación de StateMachine por rol (SUPERVISOR, JEFE_ZONAL, GERENTE, BACK_OFFICE, SUPERADMIN)
router.put('/:id/estado', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'BACK_OFFICE', 'SUPERADMIN', 'VENDEDOR'), validateEstadoChange, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const {
      nuevo_estado,
      detalles,
      motivo,
      rechazo_motivo,
      remesa_monto_original,
      remesa_monto_aprobado,
      remesa_reducida_aceptada
    } = req.body;
    const expectedVersion = parseExpectedVersion(req);
    if (expectedVersion === null) {
      return res.status(400).json({ error: 'expected_version debe ser un numero entero positivo' });
    }

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    // ── StateMachine: Validar transición ────────────────
    const validation = validateTransition(sale.estado, nuevo_estado, req.user.role, motivo || detalles);
    if (!validation.valid) {
      return res.status(422).json({
        error: validation.error,
        estado_actual: sale.estado,
        transiciones_validas: getValidTransitions(sale.estado, req.user.role).map(t => ({
          destino: t.to,
          descripcion: t.label,
          requiere_motivo: t.requiresMotivo
        }))
      });
    }

    // ── FASE 3.1: Validar documentos obligatorios antes de avanzar ──
    if (DOCUMENT_REQUIRED_STATES.includes(nuevo_estado)) {
      const docsFaltantes = await getMissingRequiredDocuments(id, sale.convenio);
      if (docsFaltantes.length > 0) {
        return res.status(422).json({
          error: 'Faltan documentos obligatorios',
          documentos_faltantes: docsFaltantes,
          total_faltantes: docsFaltantes.length,
          convenio: sale.convenio || 'GENERIC'
        });
      }
    }

    // ── FASE 3.2: Validar documentos de compra de deuda ──
    if (nuevo_estado === 'REENVIADO_BCP_COMPRA_DEUDA') {
      const cartaPoder = await prisma.document.findFirst({
        where: { sale_id: id, tipo_documento: 'CARTA_PODER' }
      });
      if (!cartaPoder) {
        return res.status(422).json({
          error: 'Debe subir la CARTA DE PODER antes de reenviar al BCP para compra de deuda.',
          documento_faltante: 'CARTA_PODER'
        });
      }
    }

    if (nuevo_estado === 'PENDIENTE_LIBERACION') {
      const cartaNoAdeudo = await prisma.document.findFirst({
        where: { sale_id: id, tipo_documento: 'CARTA_NO_ADEUDO' }
      });
      if (!cartaNoAdeudo) {
        return res.status(422).json({
          error: 'Debe subir la CARTA DE NO ADEUDO antes de avanzar a la liberación.',
          documento_faltante: 'CARTA_NO_ADEUDO'
        });
      }
    }


    const updatedSale = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.updateMany({
        where: {
          id,
          ...(expectedVersion ? { version: expectedVersion } : {})
        },
        data: {
          estado: nuevo_estado,
          fecha_estado_desde: new Date(),
          version: { increment: 1 },
          ...(nuevo_estado === 'RECHAZADO' ? {
            rechazo_motivo: isValidRejectionReason(rechazo_motivo || motivo) ? (rechazo_motivo || motivo) : 'OTRO',
            rechazo_detalle: detalles || motivo || null
          } : {}),
          ...(nuevo_estado === 'DESISTIDO' ? {
            rechazo_motivo: 'CLIENTE_DESISTE',
            rechazo_detalle: detalles || motivo || null
          } : {}),
          ...(nuevo_estado === 'EVALUACION_CALCULADORA' ? {
            boleta_recibida_at: sale.boleta_recibida_at || new Date()
          } : {}),
          ...(nuevo_estado === 'COTIZACION_ENVIADA' ? {
            cotizacion_enviada_at: sale.cotizacion_enviada_at || new Date()
          } : {}),
          ...(nuevo_estado === 'PENDIENTE_DATOS_FILE' ? {
            cotizacion_aceptada_at: sale.cotizacion_aceptada_at || new Date()
          } : {}),
          ...(nuevo_estado === 'REMESA_APROBADA' ? {
            estado_remesa: 'APROBADA',
            remesa_monto_original: remesa_monto_original ? Number(remesa_monto_original) : sale.remesa_monto_original,
            remesa_monto_aprobado: remesa_monto_aprobado ? Number(remesa_monto_aprobado) : sale.remesa_monto_aprobado,
            monto_remesa: remesa_monto_aprobado ? Number(remesa_monto_aprobado) : sale.monto_remesa
          } : {}),
          ...(nuevo_estado === 'REMESA_REDUCIDA' ? {
            estado_remesa: 'REDUCIDA',
            remesa_monto_original: remesa_monto_original ? Number(remesa_monto_original) : sale.remesa_monto_original,
            remesa_monto_aprobado: remesa_monto_aprobado ? Number(remesa_monto_aprobado) : sale.remesa_monto_aprobado,
            monto_remesa: remesa_monto_aprobado ? Number(remesa_monto_aprobado) : sale.monto_remesa
          } : {}),
          ...(nuevo_estado === 'PENDIENTE_DESEMBOLSO' && remesa_reducida_aceptada !== undefined ? {
            remesa_reducida_aceptada: Boolean(remesa_reducida_aceptada)
          } : {}),
          ...(nuevo_estado === 'PENDIENTE_CARTA_PODER' ? {
            compra_deuda: true,
            compra_deuda_estado: 'PENDIENTE_CARTA_PODER'
          } : {}),
          ...(nuevo_estado === 'REENVIADO_BCP_COMPRA_DEUDA' ? {
            carta_poder_recibida_at: sale.carta_poder_recibida_at || new Date(),
            compra_deuda_estado: 'REENVIADO_BCP'
          } : {}),
          ...(nuevo_estado === 'PENDIENTE_CARTA_NO_ADEUDO' ? {
            compra_deuda_estado: 'PENDIENTE_CARTA_NO_ADEUDO'
          } : {}),
          ...(nuevo_estado === 'PENDIENTE_LIBERACION' ? {
            carta_no_adeudo_at: sale.carta_no_adeudo_at || new Date(),
            compra_deuda_estado: 'PENDIENTE_LIBERACION'
          } : {}),
          ...(nuevo_estado === 'DESEMBOLSADO' ? {
            fecha_desembolso: sale.fecha_desembolso || new Date(),
            compra_deuda_estado: sale.compra_deuda ? 'LIBERADO' : sale.compra_deuda_estado
          } : {})
        }
      });

      if (result.count === 0) return null;

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Cambio de Estado",
          estado_anterior: sale.estado,
          estado_nuevo: nuevo_estado,
          detalles: motivo || detalles || `Estado cambiado a ${nuevo_estado}`
        }
      });

      return tx.sale.findUnique({ where: { id } });
    });

    if (!updatedSale) return conflictResponse(res);

    // Notify Asesor about state change
    try {
      await sendPushNotification(
        sale.asesor_id,
        'Actualización de Expediente',
        `El expediente de ${sale.nombres_cliente} ha cambiado a: ${nuevo_estado}`,
        { saleId: id, type: 'STATE_CHANGE' }
      );
    } catch (e) {
      console.error('Failed to send notification:', e);
    }

    if (nuevo_estado === 'PENDIENTE_DATOS_FILE') {
      triggerPdfGeneration(id, req.user.id);
    }

    res.json(updatedSale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// GET /api/sales/:id/transiciones — Retorna las transiciones válidas para el usuario actual
router.get('/:id/transiciones', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const transiciones = getValidTransitions(sale.estado, req.user.role);

    res.json({
      estado_actual: sale.estado,
      rol_usuario: req.user.role,
      transiciones_disponibles: transiciones.map(t => ({
        destino: t.to,
        descripcion: t.label,
        requiere_motivo: t.requiresMotivo
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener transiciones' });
  }
});

// POST /api/sales/:id/score-bcp
// Registra el resultado del score interno BCP y mueve el expediente al siguiente paso.
router.post('/:id/score-bcp', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'BACK_OFFICE', 'ANALISTA', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { resultado, detalle } = req.body;
    const normalized = String(resultado || '').toUpperCase();
    const aprobado = ['APROBADO', 'PASA', 'OK', 'VERDE'].includes(normalized);
    const rechazado = ['RECHAZADO', 'NO_CALIFICA', 'ROJO'].includes(normalized);
    if (!aprobado && !rechazado) {
      return res.status(400).json({ error: 'resultado debe ser APROBADO o RECHAZADO' });
    }

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const nextEstado = aprobado ? 'PENDIENTE_BOLETA' : 'RECHAZADO';
    const validation = validateTransition(sale.estado, nextEstado, req.user.role, detalle || 'Score BCP no califica');
    if (!validation.valid) {
      return res.status(422).json({ error: validation.error });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.update({
        where: { id },
        data: {
          score_bcp_estado: aprobado ? 'APROBADO' : 'RECHAZADO',
          score_bcp_detalle: detalle || null,
          score_bcp_fecha: new Date(),
          estado: nextEstado,
          fecha_estado_desde: new Date(),
          version: { increment: 1 },
          ...(rechazado ? {
            rechazo_motivo: 'SCORE_BCP_NO_CALIFICA',
            rechazo_detalle: detalle || 'Score BCP no califica.'
          } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: aprobado ? 'Score BCP aprobado' : 'Score BCP rechazado',
          estado_anterior: sale.estado,
          estado_nuevo: nextEstado,
          detalles: detalle || (aprobado ? 'Cliente pasa score BCP.' : 'Cliente no pasa score BCP.')
        }
      });

      return result;
    });

    res.json(updated);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo registrar el score BCP' });
  }
});

// POST /api/sales/:id/boleta
// Marca la boleta como recibida y habilita la evaluacion de calculadora.
router.post('/:id/boleta', authMiddleware, authorize('VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const nextEstado = 'EVALUACION_CALCULADORA';
    const validation = validateTransition(sale.estado, nextEstado, req.user.role);
    if (!validation.valid) {
      return res.status(422).json({ error: validation.error });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.update({
        where: { id },
        data: {
          boleta_recibida_at: new Date(),
          estado: nextEstado,
          fecha_estado_desde: new Date(),
          version: { increment: 1 }
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: 'Boleta recibida',
          estado_anterior: sale.estado,
          estado_nuevo: nextEstado,
          detalles: req.body?.detalle || 'Boleta registrada para evaluacion en calculadora.'
        }
      });

      return result;
    });

    res.json(updated);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo registrar la boleta' });
  }
});

// POST /api/sales/:id/cotizacion/aceptacion
// Registra si el cliente acepta la cotizacion y mueve el expediente hacia file o desistimiento.
router.post('/:id/cotizacion/aceptacion', authMiddleware, authorize('VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const acepta = req.body?.acepta === true || req.body?.acepta === 'true';
    const detalle = req.body?.detalle;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const nextEstado = acepta ? 'PENDIENTE_DATOS_FILE' : 'DESISTIDO';
    const validation = validateTransition(sale.estado, nextEstado, req.user.role, detalle || 'Cliente no acepta cotizacion');
    if (!validation.valid) {
      return res.status(422).json({ error: validation.error });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.update({
        where: { id },
        data: {
          estado: nextEstado,
          fecha_estado_desde: new Date(),
          cotizacion_aceptada_at: acepta ? new Date() : sale.cotizacion_aceptada_at,
          version: { increment: 1 },
          ...(acepta ? {} : {
            rechazo_motivo: 'CLIENTE_DESISTE',
            rechazo_detalle: detalle || 'Cliente no acepta la cotizacion.'
          })
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: acepta ? 'Cotizacion aceptada' : 'Cotizacion no aceptada',
          estado_anterior: sale.estado,
          estado_nuevo: nextEstado,
          detalles: detalle || (acepta ? 'Cliente acepta cotizacion.' : 'Cliente no acepta cotizacion.')
        }
      });

      return result;
    });

    if (nextEstado === 'PENDIENTE_DATOS_FILE') {
      triggerPdfGeneration(id, req.user.id);
    }

    res.json(updated);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo registrar la aceptacion de cotizacion' });
  }
});

// POST /api/sales/:id/simulacion/calcular
// Calcula, guarda y vincula una simulacion al expediente. Si no califica, detiene el flujo.
router.post('/:id/simulacion/calcular', authMiddleware, authorize('VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'BACK_OFFICE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const expectedVersion = parseExpectedVersion(req);
    if (expectedVersion === null) {
      return res.status(400).json({ error: 'expected_version debe ser un numero entero positivo' });
    }
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;
    if (expectedVersion && sale.version !== expectedVersion) return conflictResponse(res);

    const params = req.body || {};
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
      otrosDescuentos: Number(params.otrosDescuentos ?? params.facultativos) || 0,
      reserva: params.reserva !== undefined ? Number(params.reserva) : undefined,
      facultativos: params.facultativos !== undefined ? Number(params.facultativos) : undefined,
      montoSolicitado: Number(params.montoSolicitado),
      cuotas: Number(params.cuotas),
      envioFisico: Boolean(params.envioFisico),
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

    const approved = isSimulationApproved(resultado);
    const [convenio, cargo] = await Promise.all([
      prisma.convenio.findUnique({ where: { id: params.convenioId } }),
      prisma.cargo.findUnique({ where: { id: params.cargoId } })
    ]);

    const simulacion = await prisma.simulacion.create({
      data: {
        user_id: req.user.id,
        dni_cliente: sale.dni_cliente,
        convenio: convenio?.nombre || sale.convenio || params.convenioId,
        cargo: cargo?.nombre || sale.cargo_laboral || params.cargoId,
        monto_solicitado: Number(params.montoSolicitado),
        cuotas: Number(params.cuotas),
        tea: resultado.resumen?.tea || 0,
        cuota_mensual: resultado.resumen?.cuota_mensual || 0,
        capacidad_max: resultado.resumen?.capacidad_maxima || 0,
        ingreso_neto: resultado.resumen?.ingreso_neto_disponible || 0
      }
    });

    const nextEstado = approved
      ? (params.clienteAcepta ? 'PENDIENTE_DATOS_FILE' : 'COTIZACION_ENVIADA')
      : 'RECHAZADO';

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.updateMany({
        where: {
          id,
          ...(expectedVersion ? { version: expectedVersion } : {})
        },
        data: {
          simulacion_id: simulacion.id,
          simulacion_cuota: resultado.resumen?.cuota_mensual || null,
          simulacion_tea: resultado.resumen?.tea || null,
          simulacion_plazo: resultado.resumen?.plazo || Number(params.cuotas) || null,
          simulacion_monto: resultado.resumen?.monto_solicitado || Number(params.montoSolicitado) || null,
          simulacion_dictamen: resultado.resumen?.dictamen || null,
          simulacion_payload: JSON.stringify(params),
          simulacion_resultado: JSON.stringify(resultado),
          calculadora_estado: approved ? 'APROBADO' : 'RECHAZADO',
          cotizacion_monto: resultado.resumen?.monto_solicitado || Number(params.montoSolicitado) || null,
          cotizacion_cuota: resultado.resumen?.cuota_mensual || null,
          cotizacion_plazo: resultado.resumen?.plazo || Number(params.cuotas) || null,
          cotizacion_enviada_at: approved ? new Date() : null,
          cotizacion_aceptada_at: approved && params.clienteAcepta ? new Date() : sale.cotizacion_aceptada_at,
          estado: nextEstado,
          fecha_estado_desde: nextEstado !== sale.estado ? new Date() : sale.fecha_estado_desde,
          version: { increment: 1 },
          ...(approved ? {} : {
            rechazo_motivo: 'CALCULADORA_NO_CALIFICA',
            rechazo_detalle: 'La simulacion no cumple RCI, CEM o endeudamiento permitido.'
          })
        }
      });

      if (result.count === 0) return null;

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: approved ? 'Simulacion aprobada' : 'Simulacion rechazada',
          estado_anterior: sale.estado,
          estado_nuevo: nextEstado,
          detalles: approved
            ? `Cuota S/ ${Number(resultado.resumen?.cuota_mensual || 0).toLocaleString('es-PE')} | Dictamen ${resultado.resumen?.dictamen}`
            : 'Calculadora no califica: RCI, CEM o endeudamiento fuera de politica.'
        }
      });

      return tx.sale.findUnique({ where: { id } });
    });

    if (!updated) return conflictResponse(res);

    res.json({ sale: updated, simulacion, resultado, aprobado: approved });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ error: error.message || 'No se pudo calcular la simulacion del expediente' });
  }
});

// Update basic sale info (SUPERVISOR, JEFE_ZONAL, BACK_OFFICE, SUPERADMIN, GERENTE)
router.put('/:id', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE'), filterProtectedFields, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const expectedVersion = parseExpectedVersion(req);
    if (expectedVersion === null) {
      return res.status(400).json({ error: 'expected_version debe ser un numero entero positivo' });
    }
    const data = req.body;
    delete data.expected_version;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    // Convert date strings
    if (data.fecha_filtro) data.fecha_filtro = new Date(data.fecha_filtro);
    if (data.fecha_desembolso) data.fecha_desembolso = new Date(data.fecha_desembolso);
    if (data.carta_compra_deuda) data.carta_compra_deuda = new Date(data.carta_compra_deuda);
    if (data.vencimiento_remesa) data.vencimiento_remesa = new Date(data.vencimiento_remesa);
    if (data.fecha_liberacion) data.fecha_liberacion = new Date(data.fecha_liberacion);
    if (data.score_bcp_fecha) data.score_bcp_fecha = new Date(data.score_bcp_fecha);
    if (data.boleta_recibida_at) data.boleta_recibida_at = new Date(data.boleta_recibida_at);
    if (data.cotizacion_enviada_at) data.cotizacion_enviada_at = new Date(data.cotizacion_enviada_at);
    if (data.cotizacion_aceptada_at) data.cotizacion_aceptada_at = new Date(data.cotizacion_aceptada_at);
    if (data.carta_poder_recibida_at) data.carta_poder_recibida_at = new Date(data.carta_poder_recibida_at);
    if (data.carta_no_adeudo_at) data.carta_no_adeudo_at = new Date(data.carta_no_adeudo_at);
    if (data.consentimiento_at) data.consentimiento_at = new Date(data.consentimiento_at);
    const optionalNumber = (value: any) => (value === null || value === '' ? null : Number(value));
    if (data.maf_neto !== undefined) data.maf_neto = Number(data.maf_neto);
    if (data.monto_solicitado !== undefined) data.monto_solicitado = optionalNumber(data.monto_solicitado);
    if (data.plazo_deseado !== undefined) data.plazo_deseado = optionalNumber(data.plazo_deseado);
    if (data.monto_remesa !== undefined) data.monto_remesa = optionalNumber(data.monto_remesa);
    if (data.cotizacion_monto !== undefined) data.cotizacion_monto = optionalNumber(data.cotizacion_monto);
    if (data.cotizacion_cuota !== undefined) data.cotizacion_cuota = optionalNumber(data.cotizacion_cuota);
    if (data.cotizacion_plazo !== undefined) data.cotizacion_plazo = optionalNumber(data.cotizacion_plazo);
    if (data.remesa_monto_original !== undefined) data.remesa_monto_original = optionalNumber(data.remesa_monto_original);
    if (data.remesa_monto_aprobado !== undefined) data.remesa_monto_aprobado = optionalNumber(data.remesa_monto_aprobado);
    if (data.compra_deuda_monto !== undefined) data.compra_deuda_monto = optionalNumber(data.compra_deuda_monto);
    if (data.consentimiento !== undefined) data.consentimiento = Boolean(data.consentimiento);
    if (data.compra_deuda !== undefined) data.compra_deuda = Boolean(data.compra_deuda);
    if (data.remesa_reducida_aceptada !== undefined) data.remesa_reducida_aceptada = Boolean(data.remesa_reducida_aceptada);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.updateMany({
        where: {
          id,
          ...(expectedVersion ? { version: expectedVersion } : {})
        },
        data: {
          ...data,
          version: { increment: 1 }
        }
      });

      if (result.count === 0) return null;

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Actualización de Datos",
          detalles: `Campos actualizados: ${Object.keys(data).join(', ')}`
        }
      });

      return tx.sale.findUnique({ where: { id } });
    });

    if (!updated) return conflictResponse(res);

    if (updated && ['PENDIENTE_DATOS_FILE', 'VALIDACION_BACK_OFFICE', 'OBS_BACK_OFFICE', 'FILE_VALIDADO'].includes(updated.estado)) {
      triggerPdfGeneration(id, req.user.id);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

// Upload Document
router.post(
  '/:id/documentos',
  authMiddleware,
  requireAction('UPLOAD_DOCUMENT'),
  async (req: any, res: any, next: any) => {
    try {
      const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
      if (!(await requireSaleAccess(req, res, sale))) return;
      req.sale = sale;
      next();
    } catch (error) {
      next(error);
    }
  },
  upload.single('documento'),
  async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { tipo_documento } = req.body;
    const tipoDocumento = String(tipo_documento || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_') || 'OTROS';

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no recibido' });
    }

    const storedDocument = await storeUploadedDocument(req.file, req.sale?.dni_cliente || 'sin-dni');

    const document = await prisma.document.create({
      data: {
        sale_id: id,
        tipo_documento: tipoDocumento,
        file_path: storedDocument.filePath,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        checksum_sha256: storedDocument.checksumSha256,
        storage_provider: storedDocument.storageProvider,
        storage_key: storedDocument.storageKey,
        uploaded_by: req.user.id
      }
    });

    await prisma.auditLog.create({
      data: {
        sale_id: id,
        user_id: req.user.id,
        accion: "Carga de Documento",
        detalles: `Documento ${tipoDocumento} subido`
      }
    });

    await autoAdvanceDocumentedSale(id, req.user.id);

    res.status(201).json(document);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

// Download/view document with expediente-level authorization
router.get('/:id/documentos/:documentId/download', authMiddleware, async (req: any, res: any) => {
  try {
    const { id, documentId } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { documents: { where: { id: documentId } } }
    });

    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const document = sale.documents[0];
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const sent = await sendStoredDocument(res, document, sale.dni_cliente, req.query.download === '1');
    if (!sent) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    return undefined;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/sales/:id/pdf
// Descargar el PDF de convenio autollenado (o generarlo al vuelo si no existe)
// ═══════════════════════════════════════════════════
router.get('/:id/pdf', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        documents: {
          where: { tipo_documento: 'SOLICITUD_CONVENIO' },
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    let doc = sale.documents[0];

    // If no document exists yet, generate one on the fly
    if (!doc) {
      const generated = await generateAndStoreFilledAgreement(id, req.user.id);
      if (!generated) {
        return res.status(404).json({
          error: 'No se pudo generar el PDF. Verifique que el convenio tenga una plantilla asociada.'
        });
      }
      doc = generated;
    }

    const sent = await sendStoredDocument(res, doc, sale.dni_cliente, req.query.download === '1');
    if (!sent) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado en almacenamiento' });
    }
    return undefined;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener PDF de convenio' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/sales/:id/pdf/regenerar
// Forzar la regeneración del PDF de convenio (por ejemplo, tras actualizar datos)
// ═══════════════════════════════════════════════════
router.post('/:id/pdf/regenerar', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const generated = await generateAndStoreFilledAgreement(id, req.user.id);
    if (!generated) {
      return res.status(422).json({
        error: 'No se pudo regenerar el PDF. Verifique que el convenio tenga una plantilla asociada.'
      });
    }

    res.json({
      message: 'PDF de convenio regenerado exitosamente',
      documento: generated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al regenerar PDF de convenio' });
  }
});

// ═══════════════════════════════════════════════════
// PATCH /api/sales/:id/documentos/:docId/destituir
// Marcar un documento como destituído (inválido)
// Solo SUPERVISOR, JEFE_ZONAL, GERENTE, SUPERADMIN
// ═══════════════════════════════════════════════════
router.patch('/:id/documentos/:docId/destituir', authMiddleware, requireAction('INVALIDATE_DOCUMENT'), async (req: any, res: any) => {
  try {
    const { id, docId } = req.params;
    const { motivo } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const doc = await prisma.document.findFirst({ where: { id: docId, sale_id: id } });
    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDoc = await tx.document.update({
        where: { id: docId },
        data: {
          tipo_documento: 'DESTITUIDO',
          estado_validacion: 'INVALIDO',
          observacion: motivo || 'Documento destituido'
        } as any
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Destitución de Documento",
          detalles: `Documento ${doc.tipo_documento} (ID: ${docId}) destituído. Motivo: ${motivo || 'No especificado'}`
        }
      });

      return updatedDoc;
    });

    res.json({ message: 'Documento destituído', documento: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al destituir documento' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/sales/:id/documentos/checklist
// Estado de documentos requeridos vs subidos para un expediente
// ═══════════════════════════════════════════════════
router.get('/:id/documentos/checklist', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { documents: true }
    });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const convenio = sale.convenio || 'GENERIC';
    const docsRequeridos = await prisma.documentoRequerido.findMany({
      where: {
        activo: true,
        OR: [
          { convenio: convenio },
          { convenio: '*' },
          { convenio: 'GENERIC' }
        ]
      },
      orderBy: { orden: 'asc' }
    });

    const docsUnicos = Array.from(new Map<string, typeof docsRequeridos[number]>(docsRequeridos.map(doc => [doc.tipo_doc, doc] as [string, typeof docsRequeridos[number]])).values())
      .sort((a, b) => a.orden - b.orden);
    const docsSubidos = sale.documents.filter((d: any) => d.tipo_documento !== 'DESTITUIDO');
    const tiposSubidos = new Map<string, number>();
    docsSubidos.forEach((d: any) => {
      tiposSubidos.set(d.tipo_documento, (tiposSubidos.get(d.tipo_documento) || 0) + 1);
    });

    const checklist = docsUnicos.map(dr => ({
      tipo: dr.tipo_doc,
      nombre: dr.nombre,
      obligatorio: dr.obligatorio,
      orden: dr.orden,
      subido: tiposSubidos.has(dr.tipo_doc),
      cantidad: tiposSubidos.get(dr.tipo_doc) || 0
    }));

    const total = checklist.length;
    const completados = checklist.filter(c => c.subido).length;
    const obligatoriosFaltantes = checklist.filter(c => c.obligatorio && !c.subido);

    res.json({
      sale_id: id,
      convenio,
      progreso: { total, completados, porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0 },
      obligatorios_faltantes: obligatoriosFaltantes.length,
      checklist
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener checklist' });
  }
});

// Delete Sale (Solo GERENTE y SUPERADMIN)
router.delete('/:id', authMiddleware, authorize('GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;

    await prisma.$transaction([
      prisma.document.deleteMany({ where: { sale_id: id } }),
      prisma.auditLog.deleteMany({ where: { sale_id: id } }),
      prisma.feedbackNote.deleteMany({ where: { sale_id: id } }),
      prisma.sale.delete({ where: { id } })
    ]);

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la venta' });
  }
});

// ADD Feedback Note & Notify
router.post('/:id/feedback', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'BACK_OFFICE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nota } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const feedback = await prisma.feedbackNote.create({
      data: {
        sale_id: id,
        user_id: req.user.id,
        nota
      }
    });

    // Notify Asesor
    await sendPushNotification(
      sale.asesor_id,
      'Nueva Nota en tu Expediente',
      `${req.user.nombre} ha dejado un comentario: "${nota.substring(0, 50)}${nota.length > 50 ? '...' : ''}"`,
      { saleId: id, type: 'FEEDBACK' }
    );

    res.status(201).json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al añadir nota' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/sales/:id/next-steps
// Pasos guiados: qué hacer siguiente según el estado actual y rol
// ══════════════════════════════════════════════════
router.get('/:id/next-steps', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        documents: true,
        expediente_bcp: true,
      }
    });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const transiciones = getValidTransitions(sale.estado, req.user.role);
    const sla = getSlaInfo(sale.estado, (sale as any).fecha_estado_desde || sale.created_at);
    const diasEnEstado = sla.nivel === 'SIN_SLA' ? null : sla.dias_en_estado;
    const slaUrgent = sla.vencido || sla.nivel === 'POR_VENCER' || sla.nivel === 'CRITICO';

    // Determinar acciones guiadas según estado
    let acciones: { icono: string; texto: string; urgente: boolean }[] = [];
    let mensaje = '';

    switch (sale.estado) {
	      case 'PROSPECTO_NUEVO':
	        mensaje = 'Prospecto registrado. Falta iniciar verificacion de sistema.';
	        acciones = [
	          { icono: 'search', texto: 'Validar deudas del cliente', urgente: true },
	          { icono: 'people', texto: 'Si es casado, registrar y evaluar conyuge', urgente: true },
	        ];
	        break;
	      case 'VERIFICACION_SISTEMA':
	        mensaje = 'Se debe completar la verificacion del cliente y conyuge si aplica.';
	        acciones = [
	          { icono: 'search', texto: 'Consultar Infoburo del cliente', urgente: true },
	          { icono: 'people', texto: 'Consultar Infoburo del conyuge si corresponde', urgente: isMarried((sale as any).estado_civil_cliente) },
	        ];
	        break;
	      case 'SCORE_BCP':
	        mensaje = 'Cliente paso verificacion. Falta registrar resultado de score BCP.';
	        acciones = [
	          { icono: 'business', texto: 'Registrar si pasa score interno BCP', urgente: true },
	          { icono: 'close', texto: 'Rechazar si score BCP no califica', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_BOLETA':
	        mensaje = 'Score BCP aprobado. El vendedor debe solicitar boleta al cliente.';
	        acciones = [
	          { icono: 'document', texto: 'Solicitar y registrar boleta', urgente: true },
	        ];
	        break;
	      case 'EVALUACION_CALCULADORA':
	        mensaje = 'Boleta recibida. Falta evaluar la propuesta en calculadora.';
	        acciones = [
	          { icono: 'calculator', texto: 'Calcular prestamo con datos de boleta', urgente: true },
	          { icono: 'close', texto: 'Rechazar si calculadora no califica', urgente: false },
	        ];
	        break;
	      case 'COTIZACION_ENVIADA':
	      case 'PENDIENTE_ACEPTACION_CLIENTE':
	        mensaje = 'Propuesta calculada. Falta cerrar aceptacion con el cliente.';
	        acciones = [
	          { icono: 'call', texto: 'Explicar cotizacion y registrar aceptacion', urgente: true },
	          { icono: 'close', texto: 'Marcar desistido si no acepta', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_DATOS_FILE':
	        mensaje = 'Cliente acepto. Vendedor debe completar datos y documentos del file.';
	        acciones = [
	          { icono: 'attach', texto: 'Subir DNI, boleta y documentos obligatorios', urgente: true },
	          { icono: 'list', texto: 'Verificar checklist antes de enviar a back office', urgente: true },
	        ];
	        break;
	      case 'VALIDACION_BACK_OFFICE':
	        mensaje = 'Back office debe validar datos y documentos del expediente.';
	        acciones = [
	          { icono: 'list', texto: 'Revisar documentos subidos y datos operativos', urgente: true },
	          { icono: 'checkmark', texto: 'Marcar file validado si todo esta conforme', urgente: false },
	        ];
	        if (diasEnEstado !== null && slaUrgent) {
	          acciones.unshift({ icono: 'alert', texto: `Lleva ${diasEnEstado} dias pendiente de back office`, urgente: true });
        }
        break;
      case 'OBS_BACK_OFFICE':
        mensaje = 'Back office observo el expediente. Vendedor debe subsanar.';
        acciones = [
          { icono: 'alert', texto: 'Revisar observacion de back office', urgente: true },
          { icono: 'attach', texto: 'Corregir datos o documentos observados', urgente: true },
	        ];
	        break;
	      case 'FILE_VALIDADO':
	        mensaje = 'File validado. Back office debe enviarlo al BCP para aprobacion de remesa.';
	        acciones = [
	          { icono: 'send', texto: 'Enviar file al BCP', urgente: true },
	          { icono: 'mail', texto: 'Registrar trazabilidad del envio', urgente: false },
	        ];
	        break;
	      case 'ENVIADO_BCP_REMESA':
	        mensaje = 'File enviado al BCP. Esperando respuesta de remesa.';
	        acciones = [
	          { icono: 'business', texto: 'Dar seguimiento a BCP', urgente: slaUrgent },
	          { icono: 'chat', texto: 'Registrar observacion, rechazo, remesa aprobada o reducida', urgente: false },
	        ];
	        break;
	      case 'OBS_BCP':
	        mensaje = 'BCP observo el expediente. Back office debe subsanar.';
	        acciones = [
	          { icono: 'alert', texto: 'Revisar observacion BCP', urgente: true },
	          { icono: 'send', texto: 'Reenviar al BCP cuando este subsanado', urgente: false },
	        ];
	        break;
	      case 'REMESA_APROBADA':
	        mensaje = 'Remesa aprobada. Falta definir desembolso o ruta de compra de deuda.';
	        acciones = [
	          { icono: 'cash', texto: 'Pasar a pendiente de desembolso si es libre disponibilidad', urgente: true },
	          { icono: 'refresh', texto: 'Pasar a carta poder si es compra de deuda', urgente: false },
	        ];
	        break;
	      case 'REMESA_REDUCIDA':
	      case 'PENDIENTE_ACEPTACION_REMESA':
	        mensaje = 'BCP aprobo menor monto. Falta confirmar si el cliente acepta.';
	        acciones = [
	          { icono: 'call', texto: 'Consultar aceptacion del nuevo monto', urgente: true },
	          { icono: 'close', texto: 'Marcar desistido o rechazado si no acepta', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_DESEMBOLSO':
	        mensaje = 'Esperando confirmacion de desembolso por parte del BCP.';
	        acciones = [
	          { icono: 'cash', texto: 'Registrar desembolso si es libre disponibilidad', urgente: true },
	          { icono: 'document', texto: 'Si es compra de deuda, esperar carta poder', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_CARTA_PODER':
	        mensaje = 'Compra de deuda pendiente de carta poder enviada por BCP.';
	        acciones = [
	          { icono: 'document', texto: 'Registrar carta poder recibida', urgente: true },
	          { icono: 'send', texto: 'Reenviar file de compra de deuda al BCP', urgente: false },
	        ];
	        break;
	      case 'REENVIADO_BCP_COMPRA_DEUDA':
	        mensaje = 'File de compra de deuda reenviado al BCP. Esperando carta de no adeudo.';
	        acciones = [
	          { icono: 'business', texto: 'Dar seguimiento a compra de deuda', urgente: slaUrgent },
	          { icono: 'document', texto: 'Registrar carta de no adeudo cuando llegue', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_CARTA_NO_ADEUDO':
	        mensaje = 'Falta validar carta de no adeudo para liberar el monto.';
	        acciones = [
	          { icono: 'document', texto: 'Validar carta de no adeudo', urgente: true },
	          { icono: 'refresh', texto: 'Pasar a pendiente de liberacion', urgente: false },
	        ];
	        break;
	      case 'PENDIENTE_LIBERACION':
	        mensaje = 'Compra de deuda pendiente de liberacion antes del cierre.';
        acciones = [
          { icono: 'refresh', texto: 'Confirmar liberacion de la deuda comprada', urgente: true },
          { icono: 'cash', texto: 'Registrar desembolso cuando corresponda', urgente: false },
        ];
        break;
      case 'RECHAZADO':
        mensaje = 'Expediente rechazado.';
        acciones = [
          { icono: 'close', texto: 'Revisar motivo y dejar trazabilidad', urgente: false },
          { icono: 'refresh', texto: 'Solo gerencia puede reabrir si corresponde', urgente: false },
        ];
        break;
      case 'DESISTIDO':
        mensaje = 'Cliente desistio o no continuo el tramite.';
        acciones = [
          { icono: 'close', texto: 'Revisar motivo del desistimiento', urgente: false },
          { icono: 'refresh', texto: 'Solo gerencia puede reabrir si corresponde', urgente: false },
        ];
        break;
      case 'PENDIENTE_REASIGNACION':
        mensaje = 'Duplicidad detectada. Jefatura debe decidir la reasignacion.';
        acciones = [
          { icono: 'people', texto: 'Aprobar o rechazar reasignacion', urgente: true },
        ];
        break;
      case 'REASIGNADO':
        mensaje = 'Expediente reasignado a otro asesor.';
        acciones = [
          { icono: 'checkmark', texto: 'Validar que el nuevo asesor continue la gestion', urgente: false },
        ];
        break;
      case 'DESEMBOLSADO':
        mensaje = 'Operacion desembolsada y cerrada.';
        acciones = [
          { icono: 'checkmark-circle', texto: 'Mantener trazabilidad para auditoria', urgente: false },
        ];
        break;
      default:
        mensaje = `Estado actual: ${getEstadoLabel(sale.estado)}`;
        break;
    }

    const nextSteps = acciones.map((accion, index) => ({
      step: index + 1,
      action: accion.texto,
      description: mensaje,
      targetState: transiciones[index]?.to || sale.estado,
      icon: accion.icono,
      urgent: accion.urgente
    }));

    return res.json({
      estado_actual: sale.estado,
      estado_label: getEstadoLabel(sale.estado),
      rol_usuario: req.user.role,
      dias_en_estado: diasEnEstado,
      sla,
      mensaje,
      acciones,
      nextSteps,
      transiciones_disponibles: transiciones.map(t => ({
        destino: t.to,
        destino_label: getEstadoLabel(t.to),
        descripcion: t.label,
        requiere_motivo: t.requiresMotivo,
        motivos_disponibles: (CATALOGO_MOTIVOS as any)[t.to] || []
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pasos guiados' });
  }
});

export default router;
