import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { canAccessSale, getSalesFilter } from '../services/hierarchy';
import { upload } from '../middleware/upload';
import { getDniInfo } from '../services/dni';
import { sendPushNotification } from '../services/push';
import { validateCreateSale, validateEstadoChange, filterProtectedFields, validateTransition, getValidTransitions, VALID_ESTADOS, CATALOGO_MOTIVOS, getEstadoLabel } from '../middleware/validate';
import { resolveExpedienteDocumentPath } from '../services/storage';

const router = Router();

const saleResponse = (sale: any) => ({
  ...sale,
  documents: (sale.documents || []).map((doc: any) => ({
    ...doc,
    url: `/api/sales/${sale.id}/documentos/${doc.id}/download`
  }))
});

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
    const info = await getDniInfo(dni);
    res.json(info);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
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
      dni_cliente, nombres_cliente, plaza, convenio, maf_neto,
      fecha_filtro, fecha_desembolso, estado_remesa,
      carta_compra_deuda, monto_remesa, vencimiento_remesa, feedback
    } = req.body;

    // Check if there is an active sale for this DNI
    const activeStates = ['POR INGRESAR', 'EN PROCESO', 'APROBADA'];
    const previousSale = await prisma.sale.findFirst({
      where: {
        dni_cliente,
        estado: { in: activeStates }
      },
      orderBy: { created_at: 'desc' }
    });

    let estado = "POR INGRESAR";
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
        plaza,
        convenio,
        maf_neto: Number(maf_neto) || 0,
        fecha_filtro: fecha_filtro ? new Date(fecha_filtro) : null,
        fecha_desembolso: fecha_desembolso ? new Date(fecha_desembolso) : null,
        estado_remesa,
        carta_compra_deuda: carta_compra_deuda ? new Date(carta_compra_deuda) : null,
        monto_remesa: monto_remesa ? Number(monto_remesa) : 0,
        vencimiento_remesa: vencimiento_remesa ? new Date(vencimiento_remesa) : null,
        feedback,
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
          ? `Venta creada para DNI: ${dni_cliente} (Bloqueada por duplicidad, requiere reasignación)`
          : `Venta creada para DNI: ${dni_cliente} | Plaza: ${plaza}`
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

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;
    if (sale.reasignacion_estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'La venta no está pendiente de reasignación' });
    }

    const nuevoEstado = accion === 'APROBAR' ? 'POR INGRESAR' : 'RECHAZADO';

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          reasignacion_estado: accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
          reasignacion_por: req.user.id,
          reasignacion_motivo: motivo,
          reasignacion_fecha: new Date()
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
            estado: { in: ['POR INGRESAR', 'EN PROCESO', 'APROBADA'] }
          },
          orderBy: { created_at: 'desc' }
        });

        if (oldSale) {
          await tx.sale.update({
            where: { id: oldSale.id },
            data: { estado: 'REASIGNADO' }
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
    const { nuevo_estado, detalles, motivo } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    // ── StateMachine: Validar transición ────────────────
    const validation = validateTransition(sale.estado, nuevo_estado, req.user.role, motivo || detalles);
    if (!validation.valid) {
      const pasoPrevio = sale.estado === 'POR INGRESAR' && nuevo_estado === 'APROBADA'
        ? 'Primero cambie el expediente a EN PROCESO; luego apruebelo con los documentos obligatorios completos.'
        : undefined;

      return res.status(422).json({
        error: validation.error,
        paso_previo: pasoPrevio,
        estado_actual: sale.estado,
        transiciones_validas: getValidTransitions(sale.estado, req.user.role).map(t => ({
          destino: t.to,
          descripcion: t.label,
          requiere_motivo: t.requiresMotivo
        }))
      });
    }

    // ── FASE 3.1: Validar documentos obligatorios antes de avanzar ──
    const estadosRequierenDocs = ['EN PROCESO', 'PENDIENTE_DOCUMENTAR', 'PENDIENTE_INSTITUCIONES', 'PENDIENTE_REMESA', 'PENDIENTE_BACK_OFFICE'];
    const estadosAvanzados = ['APROBADA', 'CONFORMIDAD', 'DESEMBOLSADO', 'EN_EVALUACION_BCP'];
    if (estadosAvanzados.includes(nuevo_estado) || (estadosRequierenDocs.includes(sale.estado) && nuevo_estado !== 'OBSERVADA' && nuevo_estado !== 'RECHAZADO' && nuevo_estado !== 'RECHAZADA_POR_SCORE' && nuevo_estado !== 'BOLETA_NO_CALIFICA')) {
      // Buscar documentos requeridos para este convenio
      const convenio = sale.convenio || 'GENERIC';
      const docsRequeridos = await prisma.documentoRequerido.findMany({
        where: {
          activo: true,
          obligatorio: true,
          OR: [
            { convenio: convenio },
            { convenio: 'GENERIC' }
          ]
        }
      });

      if (docsRequeridos.length > 0) {
        // Buscar documentos ya subidos (no destituídos)
        const docsSubidos = await prisma.document.findMany({
          where: {
            sale_id: id,
            OR: [
              { tipo_documento: { not: 'DESTITUIDO' } }
            ]
          }
        });

        // Marcar destituídos
        const docsValidos = docsSubidos.filter(d => (d as any).destituido !== true);
        const tiposSubidos = new Set(docsValidos.map(d => d.tipo_documento));

        const docsFaltantes = docsRequeridos
          .filter(dr => !tiposSubidos.has(dr.tipo_doc))
          .map(dr => ({ tipo: dr.tipo_doc, nombre: dr.nombre }));

        if (docsFaltantes.length > 0) {
          return res.status(422).json({
            error: 'Faltan documentos obligatorios',
            documentos_faltantes: docsFaltantes,
            total_faltantes: docsFaltantes.length,
            convenio: convenio
          });
        }
      }
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          estado: nuevo_estado,
          fecha_estado_desde: new Date() // Actualizar timestamp del estado
        }
      });

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

      return updated;
    });

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

// Update basic sale info (SUPERVISOR, JEFE_ZONAL, BACK_OFFICE, SUPERADMIN, GERENTE)
router.put('/:id', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE'), filterProtectedFields, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    // Convert date strings
    if (data.fecha_filtro) data.fecha_filtro = new Date(data.fecha_filtro);
    if (data.fecha_desembolso) data.fecha_desembolso = new Date(data.fecha_desembolso);
    if (data.carta_compra_deuda) data.carta_compra_deuda = new Date(data.carta_compra_deuda);
    if (data.vencimiento_remesa) data.vencimiento_remesa = new Date(data.vencimiento_remesa);
    if (data.maf_neto !== undefined) data.maf_neto = Number(data.maf_neto);
    if (data.monto_remesa !== undefined) data.monto_remesa = Number(data.monto_remesa);

    const updated = await prisma.sale.update({
      where: { id },
      data
    });

    await prisma.auditLog.create({
      data: {
        sale_id: id,
        user_id: req.user.id,
        accion: "Actualización de Datos",
        detalles: `Campos actualizados: ${Object.keys(data).join(', ')}`
      }
    });

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

    const document = await prisma.document.create({
      data: {
        sale_id: id,
        tipo_documento: tipoDocumento,
        file_path: req.file.path,
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

    const filePath = resolveExpedienteDocumentPath(document.file_path, sale.dni_cliente);
    if (!filePath) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const filename = document.file_path.split(/[\\/]/).pop() || 'documento';
    if (req.query.download === '1') {
      return res.download(filePath, filename);
    }

    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
});

// ═══════════════════════════════════════════════════
// PATCH /api/sales/:id/documentos/:docId/destituir
// Marcar un documento como destituído (inválido)
// Solo SUPERVISOR, JEFE_ZONAL, GERENTE, SUPERADMIN
// ═══════════════════════════════════════════════════
router.patch('/:id/documentos/:docId/destituir', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
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
          // Guardamos el tipo original en file_path si no existe campo mejor
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
          { convenio: 'GENERIC' }
        ]
      },
      orderBy: { orden: 'asc' }
    });

    const docsSubidos = sale.documents.filter((d: any) => d.tipo_documento !== 'DESTITUIDO');
    const tiposSubidos = new Map<string, number>();
    docsSubidos.forEach((d: any) => {
      tiposSubidos.set(d.tipo_documento, (tiposSubidos.get(d.tipo_documento) || 0) + 1);
    });

    const checklist = docsRequeridos.map(dr => ({
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
    const diasEnEstado = (sale as any).fecha_estado_desde
      ? Math.floor((Date.now() - new Date((sale as any).fecha_estado_desde).getTime()) / 86400000)
      : null;

    // Determinar acciones guiadas según estado
    let acciones: { icono: string; texto: string; urgente: boolean }[] = [];
    let mensaje = '';

    switch (sale.estado) {
      case 'POR INGRESAR':
        mensaje = 'Nuevo prospecto. Inicie el trámite cuando tenga la documentación lista.';
        acciones = [
          { icono: '📋', texto: 'Verificar DNI y datos del cliente', urgente: false },
          { icono: '📄', texto: 'Solicitar boletas de pago y certificado de trabajo', urgente: false },
          { icono: '▶️', texto: 'Cambiar a "En Proceso" cuando inicie evaluación', urgente: false },
        ];
        break;

      case 'EN PROCESO':
        mensaje = 'Expediente en evaluación. Revise documentos y RCC antes de aprobar.';
        acciones = [
          { icono: '🔍', texto: 'Verificar RCC y score crediticio', urgente: true },
          { icono: '📎', texto: 'Confirmar que todos los documentos estén cargados', urgente: true },
          { icono: '✅', texto: 'Aprobar si todo está en orden', urgente: false },
        ];
        if (diasEnEstado !== null && diasEnEstado > 3) {
          acciones.unshift({ icono: '⚠️', texto: `Lleva ${diasEnEstado} días en este estado — priorizar`, urgente: true });
        }
        break;

      case 'OBSERVADA':
        mensaje = 'El expediente tiene observaciones. El vendedor debe corregirlas.';
        acciones = [
          { icono: '📝', texto: 'Revisar las observaciones detalladas', urgente: true },
          { icono: '📞', texto: 'Contactar al vendedor para correcciones', urgente: true },
        ];
        break;

      case 'SUBSANADA':
        mensaje = 'El vendedor subsanó las observaciones. Valide las correcciones.';
        acciones = [
          { icono: '🔎', texto: 'Revisar documentos corregidos', urgente: true },
          { icono: '✅', texto: 'Enviar a "En Proceso" si están correctos', urgente: false },
          { icono: '↩️', texto: 'Devolver a "Observada" si faltan correcciones', urgente: false },
        ];
        break;

      case 'APROBADA':
        mensaje = 'Expediente aprobado. Proceda con el desembolso.';
        acciones = [
          { icono: '💰', texto: 'Registrar fecha y monto de desembolso', urgente: true },
          { icono: '🏦', texto: 'Confirmar desembolso con BCP', urgente: false },
        ];
        break;

      case 'PENDIENTE_DOCUMENTAR':
        mensaje = 'Falta documentación del cliente. El vendedor debe recolectarla.';
        acciones = [
          { icono: '📋', texto: 'Indicar qué documentos faltan', urgente: true },
          { icono: '📞', texto: 'Coordinar con el cliente para entrega', urgente: true },
        ];
        break;

      case 'PENDIENTE_INSTITUCIONES':
        mensaje = 'Esperando respuesta de instituciones (RENIEC, SUNAT, ESSALUD, etc.).';
        acciones = [
          { icono: '🏛️', texto: 'Dar seguimiento a consultas institucionales', urgente: false },
          { icono: '⏰', texto: 'Verificar plazos de respuesta', urgente: diasEnEstado !== null && diasEnEstado > 5 },
        ];
        break;

      case 'PENDIENTE_REMESA':
        mensaje = 'Expediente aprobado. Esperando documentos físicos (remesa).';
        acciones = [
          { icono: '📦', texto: 'Coordinar recepción de remesa', urgente: true },
          { icono: '✅', texto: 'Registrar recepción y pasar a Back Office', urgente: false },
        ];
        break;

      case 'PENDIENTE_BACK_OFFICE':
        mensaje = 'Expediente en manos de Back Office para envío a BCP.';
        acciones = [
          { icono: '📑', texto: 'Verificar checklist de documentos BCP', urgente: true },
          { icono: '📤', texto: 'Enviar expediente a BCP', urgente: false },
        ];
        break;

      case 'EN_EVALUACION_BCP':
        mensaje = 'Expediente en evaluación por BCP. Esperando respuesta.';
        acciones = [
          { icono: '🏦', texto: 'Dar seguimiento con BCP', urgente: diasEnEstado !== null && diasEnEstado > 7 },
          { icono: '📞', texto: 'Contactar agencia BCP si hay demora', urgente: diasEnEstado !== null && diasEnEstado > 14 },
        ];
        break;

      case 'OBSERVADO_BACK':
        mensaje = 'Back Office detectó un error. Corrija antes de reenviar.';
        acciones = [
          { icono: '🔍', texto: 'Revisar observación de Back Office', urgente: true },
          { icono: '✏️', texto: 'Corregir y devolver a preparación', urgente: true },
        ];
        break;

      case 'RECHAZADO':
        mensaje = 'Expediente rechazado. Considere reasignar o reabrir.';
        acciones = [
          { icono: '📊', texto: 'Revisar motivo del rechazo', urgente: false },
          { icono: '🔄', texto: 'Evaluar si se puede reabrir (solo GERENTE/SUPERADMIN)', urgente: false },
        ];
        break;

      case 'RECHAZADA_POR_SCORE':
        mensaje = 'BCP rechazó por score crediticio.';
        acciones = [
          { icono: '📊', texto: 'Verificar score y calificación', urgente: false },
          { icono: '📝', texto: 'Evaluar nueva documentación que respalde', urgente: false },
        ];
        break;

      case 'BOLETA_NO_CALIFICA':
        mensaje = 'La boleta del cliente no califica para el convenio seleccionado.';
        acciones = [
          { icono: '🔄', texto: 'Evaluar otro convenio o tipo de contratación', urgente: false },
          { icono: '📋', texto: 'Solicitar nueva boleta si aplica', urgente: false },
        ];
        break;

      default:
        mensaje = `Estado actual: ${getEstadoLabel(sale.estado)}`;
        break;
    }

    res.json({
      estado_actual: sale.estado,
      estado_label: getEstadoLabel(sale.estado),
      rol_usuario: req.user.role,
      dias_en_estado: diasEnEstado,
      mensaje,
      acciones,
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
