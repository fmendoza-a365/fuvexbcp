import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { canAccessSale, getSalesFilter } from '../services/hierarchy';
import { upload } from '../middleware/upload';
import { getDniInfo } from '../services/dni';
import { sendPushNotification } from '../services/push';
import { validateCreateSale, validateEstadoChange, filterProtectedFields } from '../middleware/validate';
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
          documents: true
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

// Update state machine (SUPERVISOR, JEFE_ZONAL, GERENTE, BACK_OFFICE, SUPERADMIN)
router.put('/:id/estado', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'BACK_OFFICE', 'SUPERADMIN'), validateEstadoChange, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nuevo_estado, detalles } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!(await requireSaleAccess(req, res, sale))) return;
    if (!sale) return;

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: { estado: nuevo_estado }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Cambio de Estado",
          estado_anterior: sale.estado,
          estado_nuevo: nuevo_estado,
          detalles: detalles || `Estado cambiado a ${nuevo_estado}`
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

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no recibido' });
    }

    const document = await prisma.document.create({
      data: {
        sale_id: id,
        tipo_documento: tipo_documento || 'DOC',
        file_path: req.file.path,
        uploaded_by: req.user.id
      }
    });

    await prisma.auditLog.create({
      data: {
        sale_id: id,
        user_id: req.user.id,
        accion: "Carga de Documento",
        detalles: `Documento ${tipo_documento} subido`
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

// GET DNI Info (Age, Birthdate)
router.get('/dni/:dni', authMiddleware, async (req: any, res: any) => {
  try {
    const { dni } = req.params;
    const info = await getDniInfo(dni);
    res.json(info);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

export default router;
