import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { canAccessSale } from '../services/hierarchy';
import { sendPushNotification } from '../services/push';

const router = Router();

// ═══════════════════════════════════════════════════
// SPRINT 3.1 — ENVÍO A INSTITUCIONES
// ═══════════════════════════════════════════════════

// GET /api/sales/:id/instituciones
// Listar todas las instituciones asociadas a un expediente
router.get('/:id/instituciones', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    const instituciones = await prisma.expedienteInstitucion.findMany({
      where: { sale_id: id },
      include: { usuario: { select: { id: true, nombre: true, username: true } } },
      orderBy: { created_at: 'asc' }
    });

    res.json({ sale_id: id, instituciones });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener instituciones' });
  }
});

// POST /api/sales/:id/instituciones
// Registrar una nueva institución asociada al expediente
router.post('/:id/instituciones', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { institucion, observaciones } = req.body;

    if (!institucion) {
      return res.status(400).json({ error: 'El campo institucion es requerido' });
    }

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    const nuevaInstitucion = await prisma.$transaction(async (tx) => {
      const inst = await tx.expedienteInstitucion.create({
        data: {
          sale_id: id,
          institucion,
          observaciones: observaciones || null,
          enviado_por: req.user.id,
          estado: 'PENDIENTE'
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Registro de Institución",
          detalles: `Institución registrada: ${institucion}`
        }
      });

      return inst;
    });

    res.status(201).json(nuevaInstitucion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar institución' });
  }
});

// PUT /api/sales/:saleId/instituciones/:instId
// Actualizar estado de envío/respuesta de una institución
router.put('/:saleId/instituciones/:instId', authMiddleware, async (req: any, res: any) => {
  try {
    const { saleId, instId } = req.params;
    const { estado, fecha_envio, fecha_respuesta, observaciones } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    const inst = await prisma.expedienteInstitucion.findUnique({ where: { id: instId } });
    if (!inst || inst.sale_id !== saleId) {
      return res.status(404).json({ error: 'Institución no encontrada en este expediente' });
    }

    const updateData: any = {};
    if (estado) updateData.estado = estado;
    if (fecha_envio) updateData.fecha_envio = new Date(fecha_envio);
    if (fecha_respuesta) updateData.fecha_respuesta = new Date(fecha_respuesta);
    if (observaciones !== undefined) updateData.observaciones = observaciones;

    // Si se marca como ENVIADO, registrar fecha automáticamente
    if (estado === 'ENVIADO' && !updateData.fecha_envio) {
      updateData.fecha_envio = new Date();
    }
    // Si se marca como RECIBIDO, registrar fecha automáticamente
    if (estado === 'RECIBIDO' && !updateData.fecha_respuesta) {
      updateData.fecha_respuesta = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.expedienteInstitucion.update({
        where: { id: instId },
        data: updateData
      });

      await tx.auditLog.create({
        data: {
          sale_id: saleId,
          user_id: req.user.id,
          accion: "Actualización de Institución",
          detalles: `${inst.institucion}: ${inst.estado} → ${estado || inst.estado}`
        }
      });

      if (estado === 'ENVIADO' && sale.estado === 'SIMULACION_ACEPTADA') {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            estado: 'ENVIADO_CONVENIO',
            fecha_estado_desde: new Date()
          }
        });

        await tx.auditLog.create({
          data: {
            sale_id: saleId,
            user_id: req.user.id,
            accion: "Auto-avance: Envio a Convenio",
            estado_anterior: sale.estado,
            estado_nuevo: 'ENVIADO_CONVENIO',
            detalles: `Envio registrado para ${inst.institucion}.`
          }
        });
      }

      return result;
    });

    // ═══ AUTO-AVANCE (SPRINT 3.3) ═══
    // Verificar si todas las instituciones están RECIBIDO para auto-avanzar
    if (estado === 'RECIBIDO') {
      await checkAutoAdvanceInstituciones(saleId, req.user.id);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar institución' });
  }
});

// DELETE /api/sales/:saleId/instituciones/:instId
// Eliminar una institución del expediente
router.delete('/:saleId/instituciones/:instId', authMiddleware, async (req: any, res: any) => {
  try {
    const { saleId, instId } = req.params;

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    const inst = await prisma.expedienteInstitucion.findUnique({ where: { id: instId } });
    if (!inst || inst.sale_id !== saleId) {
      return res.status(404).json({ error: 'Institución no encontrada' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expedienteInstitucion.delete({ where: { id: instId } });

      await tx.auditLog.create({
        data: {
          sale_id: saleId,
          user_id: req.user.id,
          accion: "Eliminación de Institución",
          detalles: `Institución eliminada: ${inst.institucion}`
        }
      });
    });

    res.json({ success: true, message: 'Institución eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar institución' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 3.2 — EXPEDIENTE BCP
// ═══════════════════════════════════════════════════

// Documentos que BCP típicamente requiere
const CHECKLIST_BCP_DEFAULT = [
  { tipo: 'TITULO', nombre: 'Título de propiedad', obligatorio: true },
  { tipo: 'FICHA', nombre: 'Ficha de evaluación', obligatorio: true },
  { tipo: 'LIQUIDACION', nombre: 'Liquidación de haberes', obligatorio: true },
  { tipo: 'BOLETA_PAGO', nombre: 'Boletas de pago (últimas 3)', obligatorio: true },
  { tipo: 'CONSTANCIA_TRABAJO', nombre: 'Constancia de trabajo', obligatorio: true },
  { tipo: 'ESTADO_CUENTA', nombre: 'Estado de cuenta', obligatorio: false },
  { tipo: 'RCC', nombre: 'Reporte RCC', obligatorio: true },
  { tipo: 'DECLARACION_JURADA', nombre: 'Declaración jurada', obligatorio: false },
  { tipo: 'CONSENTIMIENTO_DATOS', nombre: 'Consentimiento de datos personales', obligatorio: true },
  { tipo: 'OTROS', nombre: 'Otros documentos', obligatorio: false }
];

// GET /api/sales/:id/expediente-bcp
// Obtener el expediente BCP con checklist
router.get('/:id/expediente-bcp', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    let expediente = await prisma.expedienteBCP.findUnique({
      where: { sale_id: id },
      include: { usuario: { select: { id: true, nombre: true, username: true } } }
    });

    // Si no existe, crear uno por defecto
    if (!expediente) {
      expediente = await prisma.expedienteBCP.create({
        data: {
          sale_id: id,
          checklist_json: JSON.stringify(CHECKLIST_BCP_DEFAULT),
          creado_por: req.user.id
        },
        include: { usuario: { select: { id: true, nombre: true, username: true } } }
      });
    }

    // Parsear checklist
    let checklist = CHECKLIST_BCP_DEFAULT;
    try {
      if (expediente.checklist_json) {
        checklist = JSON.parse(expediente.checklist_json);
      }
    } catch { /* usar default */ }

    // Calcular completitud
    const totalObligatorios = checklist.filter((c: any) => c.obligatorio).length;
    const completados = checklist.filter((c: any) => c.completado === true).length;
    const completitudPct = totalObligatorios > 0 ? Math.round((completados / totalObligatorios) * 100) : 0;

    res.json({
      ...expediente,
      checklist,
      resumen: {
        total_documentos: checklist.length,
        obligatorios: totalObligatorios,
        completados,
        pendientes: totalObligatorios - completados,
        completitud_pct: completitudPct,
        completo: completados >= totalObligatorios
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener expediente BCP' });
  }
});

// PUT /api/sales/:id/expediente-bcp
// Actualizar expediente BCP (datos generales)
router.put('/:id/expediente-bcp', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nro_expediente, agencia, estado, observaciones_bcp, checklist } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    const updateData: any = {};
    if (nro_expediente !== undefined) updateData.nro_expediente = nro_expediente;
    if (agencia !== undefined) updateData.agencia = agencia;
    if (estado !== undefined) {
      updateData.estado = estado;
      // Auto-registrar fechas según el estado
      if (estado === 'ENVIADO_BCP' && !req.body.fecha_envio_bcp) {
        updateData.fecha_envio_bcp = new Date();
      }
      if (['APROBADO_BCP', 'RECHAZADO_BCP'].includes(estado) && !req.body.fecha_respuesta) {
        updateData.fecha_respuesta = new Date();
      }
    }
    if (observaciones_bcp !== undefined) updateData.observaciones_bcp = observaciones_bcp;
    if (req.body.fecha_envio_bcp) updateData.fecha_envio_bcp = new Date(req.body.fecha_envio_bcp);
    if (req.body.fecha_respuesta) updateData.fecha_respuesta = new Date(req.body.fecha_respuesta);

    // Si se pasa checklist actualizado
    if (checklist) {
      updateData.checklist_json = JSON.stringify(checklist);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const expediente = await tx.expedienteBCP.upsert({
        where: { sale_id: id },
        update: updateData,
        create: {
          sale_id: id,
          ...updateData,
          checklist_json: updateData.checklist_json || JSON.stringify(CHECKLIST_BCP_DEFAULT),
          creado_por: req.user.id
        },
        include: { usuario: { select: { id: true, nombre: true, username: true } } }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Actualización Expediente BCP",
          detalles: `Estado: ${estado || expediente.estado}, Agencia: ${agencia || expediente.agencia || 'N/A'}`
        }
      });

      return expediente;
    });

    // ═══ AUTO-AVANCE (SPRINT 3.3) ═══
    // Si BCP aprobó → avanzar a CONFORMIDAD
    const saleStateByBcpState: Record<string, string> = {
      EN_PREPARACION: 'PREPARANDO_BCP',
      ENVIADO_BCP: 'ENVIADO_BCP',
      EN_EVALUACION_BCP: 'ENVIADO_BCP',
      APROBADO_BCP: 'APROBADO_BCP',
      RECHAZADO_BCP: 'RECHAZADO',
      DESEMBOLSADO_BCP: 'DESEMBOLSADO'
    };

    if (estado && saleStateByBcpState[estado]) {
      await checkAutoAdvanceBCP(id, saleStateByBcpState[estado], req.user.id, observaciones_bcp);
      return res.json(updated);
    }

    if (estado === 'APROBADO_BCP') {
      await checkAutoAdvanceBCP(id, 'APROBADO_BCP', req.user.id);
    }
    // Si BCP rechazó → marcar OBSERVADA
    if (estado === 'RECHAZADO_BCP') {
      await checkAutoAdvanceBCP(id, 'OBSERVADO', req.user.id, observaciones_bcp);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar expediente BCP' });
  }
});

// PUT /api/sales/:id/expediente-bcp/checklist/:tipo
// Marcar/desmarcar un documento del checklist BCP
router.put('/:id/expediente-bcp/checklist/:tipo', authMiddleware, async (req: any, res: any) => {
  try {
    const { id, tipo } = req.params;
    const { completado, observacion } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) return res.status(403).json({ error: 'Sin permisos' });

    // Obtener o crear expediente
    let expediente = await prisma.expedienteBCP.findUnique({ where: { sale_id: id } });
    if (!expediente) {
      expediente = await prisma.expedienteBCP.create({
        data: {
          sale_id: id,
          checklist_json: JSON.stringify(CHECKLIST_BCP_DEFAULT),
          creado_por: req.user.id
        }
      });
    }

    // Parsear y actualizar checklist
    let checklist: any[] = CHECKLIST_BCP_DEFAULT;
    try {
      if (expediente.checklist_json) checklist = JSON.parse(expediente.checklist_json);
    } catch { /* usar default */ }

    const idx = checklist.findIndex((c: any) => c.tipo === tipo);
    if (idx === -1) {
      return res.status(400).json({ error: `Tipo de documento '${tipo}' no encontrado en el checklist` });
    }

    checklist[idx].completado = completado !== false;
    checklist[idx].fecha_verificacion = completado !== false ? new Date().toISOString() : null;
    if (observacion) checklist[idx].observacion = observacion;

    const updated = await prisma.expedienteBCP.update({
      where: { sale_id: id },
      data: { checklist_json: JSON.stringify(checklist) }
    });

    // Verificar si el checklist completo permite auto-avance
    if (completado !== false) {
      await checkAutoAdvanceChecklist(id, checklist, req.user.id);
    }

    const totalObligatorios = checklist.filter((c: any) => c.obligatorio).length;
    const completados = checklist.filter((c: any) => c.obligatorio && c.completado === true).length;

    res.json({
      ...updated,
      checklist,
      resumen: {
        obligatorios: totalObligatorios,
        completados,
        completitud_pct: totalObligatorios > 0 ? Math.round((completados / totalObligatorios) * 100) : 0,
        completo: completados >= totalObligatorios
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar checklist' });
  }
});

// ═══════════════════════════════════════════════════
// SPRINT 3.3 — AUTO-AVANCE DE ESTADOS
// ═══════════════════════════════════════════════════

/**
 * Verifica si todas las instituciones de un expediente están RECIBIDO
 * y auto-avanza el estado del Sale si corresponde
 */
async function checkAutoAdvanceInstituciones(saleId: string, userId: string) {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    const instituciones = await prisma.expedienteInstitucion.findMany({
      where: { sale_id: saleId }
    });

    if (instituciones.length === 0) return;

    const todasRecibidas = instituciones.every(i => i.estado === 'RECIBIDO');

    if (todasRecibidas && ['ENVIADO_CONVENIO', 'SIMULACION_ACEPTADA'].includes(sale.estado)) {
      // Auto-avanzar a ENVIADO (instituciones listas para revisión del supervisor)
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            estado: 'CONVENIO_APROBADO',
            fecha_estado_desde: new Date()
          }
        });

        await tx.auditLog.create({
          data: {
            sale_id: saleId,
            user_id: userId,
            accion: "Auto-avance: Instituciones Completas",
            estado_anterior: sale.estado,
            estado_nuevo: 'CONVENIO_APROBADO',
            detalles: `Todas las respuestas del convenio/instituciones (${instituciones.length}) fueron recibidas.`
          }
        });
      });

      // Notificar al asesor
      try {
        await sendPushNotification(
          sale.asesor_id,
          '✅ Auto-avance: Instituciones Completas',
          `El expediente de ${sale.nombres_cliente} avanzo a CONVENIO_APROBADO. Todas las respuestas fueron recibidas.`,
          { saleId, type: 'AUTO_ADVANCE' }
        );
      } catch (e) { console.error('Push notification failed:', e); }
    }
  } catch (error) {
    console.error('Error en auto-avance instituciones:', error);
  }
}

/**
 * Auto-avanza el estado del Sale cuando BCP aprueba o rechaza
 */
async function checkAutoAdvanceBCP(saleId: string, nuevoEstado: string, userId: string, observacion?: string) {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          estado: nuevoEstado,
          fecha_estado_desde: new Date(),
          ...(observacion ? { feedback: observacion } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: saleId,
          user_id: userId,
          accion: `Auto-avance BCP: ${nuevoEstado}`,
          estado_anterior: sale.estado,
          estado_nuevo: nuevoEstado,
          detalles: observacion || `Expediente actualizado por respuesta BCP a ${nuevoEstado}`
        }
      });
    });

    // Notificar al asesor
    try {
      await sendPushNotification(
        sale.asesor_id,
        `Respuesta BCP: ${nuevoEstado}`,
        `El expediente de ${sale.nombres_cliente} cambio a ${nuevoEstado}.${observacion ? ' Obs: ' + observacion.substring(0, 80) : ''}`,
        { saleId, type: 'BCP_RESPONSE' }
      );
    } catch (e) { console.error('Push notification failed:', e); }
  } catch (error) {
    console.error('Error en auto-avance BCP:', error);
  }
}

/**
 * Verifica si el checklist BCP está completo y auto-avanza
 */
async function checkAutoAdvanceChecklist(saleId: string, checklist: any[], userId: string) {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    const obligatorios = checklist.filter((c: any) => c.obligatorio);
    const todosCompletos = obligatorios.every((c: any) => c.completado === true);

    if (todosCompletos) {
      // Si el expediente BCP está en EN_PREPARACION, pasarlo a ENVIADO_BCP
      const expediente = await prisma.expedienteBCP.findUnique({ where: { sale_id: saleId } });
        if (expediente && expediente.estado === 'EN_PREPARACION') {
        await prisma.$transaction(async (tx) => {
          await tx.expedienteBCP.update({
            where: { sale_id: saleId },
            data: {
              estado: 'ENVIADO_BCP',
              fecha_envio_bcp: new Date()
            }
          });

          await tx.sale.update({
            where: { id: saleId },
            data: {
              estado: 'ENVIADO_BCP',
              fecha_estado_desde: new Date()
            }
          });

          await tx.auditLog.create({
            data: {
              sale_id: saleId,
              user_id: userId,
              accion: "Auto-avance: Checklist BCP Completo",
              estado_anterior: sale.estado,
              estado_nuevo: 'ENVIADO_BCP',
              detalles: 'Todos los documentos obligatorios del checklist BCP fueron verificados.'
            }
          });
        });

        // Notificar al asesor
        try {
          await sendPushNotification(
            sale.asesor_id,
            '📤 Checklist BCP Completo',
            `El expediente de ${sale.nombres_cliente} tiene todos los documentos obligatorios verificados y fue enviado a BCP.`,
            { saleId, type: 'CHECKLIST_COMPLETE' }
          );
        } catch (e) { console.error('Push notification failed:', e); }
      }
    }
  } catch (error) {
    console.error('Error en auto-avance checklist:', error);
  }
}

export default router;
