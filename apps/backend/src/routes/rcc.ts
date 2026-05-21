import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { consultarRCC } from '../services/infoburo';
import { canAccessSale } from '../services/hierarchy';

const router = Router();

const isMarried = (estadoCivil?: string | null) => (
  /CASAD/i.test(String(estadoCivil || ''))
);

const canAdvanceToScore = (sale: any, target: 'cliente' | 'conyuge', semaforo: string) => {
  const clienteVerde = target === 'cliente' ? semaforo === 'VERDE' : sale.rcc_semaforo === 'VERDE';
  const conyugeVerde = target === 'conyuge' ? semaforo === 'VERDE' : sale.conyuge_rcc_semaforo === 'VERDE';
  return clienteVerde && (!isMarried(sale.estado_civil_cliente) || conyugeVerde);
};

// POST /api/sales/:id/rcc - Consultar y guardar Infoburo para un expediente
router.post('/:id/rcc', authMiddleware, authorize('BACK_OFFICE', 'ANALISTA', 'SUPERVISOR', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { force = false, sujeto = 'cliente', conyuge_dni } = req.body;
    const target: 'cliente' | 'conyuge' = sujeto === 'conyuge' ? 'conyuge' : 'cliente';

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });
    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'No tienes permisos para consultar este expediente' });
    }

    const dniConsulta = target === 'conyuge'
      ? String(conyuge_dni || sale.conyuge_dni || '').replace(/\D/g, '')
      : sale.dni_cliente;

    if (!/^\d{8}$/.test(dniConsulta)) {
      return res.status(400).json({ error: target === 'conyuge' ? 'DNI de conyuge requerido' : 'DNI invalido' });
    }

    console.log(`[RCC_ROUTE] Iniciando consulta ${target} para DNI: ${dniConsulta} (SaleId: ${id})`);
    
    // Si no es forzado y ya tiene datos recientes (últimas 24h), podríamos devolver los guardados
    // Pero el usuario pidió un botón de refrescar, así que usualmente vendrá force=true
    
    const result = await consultarRCC(dniConsulta);
    
    if (!result || result.nombres === 'No encontrado / Sin historial') {
       // Actualizar con datos vacíos si no se encuentra
       await prisma.sale.update({
         where: { id },
         data: target === 'conyuge'
           ? {
             conyuge_dni: dniConsulta,
             conyuge_rcc_semaforo: 'GRIS',
             conyuge_rcc_monto_deuda: 0,
             conyuge_rcc_ultima_act: new Date(),
             conyuge_rcc_calificacion: 'SIN REGISTROS',
             conyuge_rcc_raw_data: JSON.stringify(result),
             version: { increment: 1 }
           }
           : {
             rcc_semaforo: 'GRIS',
             rcc_monto_deuda: 0,
             rcc_ultima_act: new Date(),
             rcc_calificacion: 'SIN REGISTROS',
             rcc_raw_data: JSON.stringify(result),
             estado: sale.estado === 'PROSPECTO_NUEVO' ? 'VERIFICACION_SISTEMA' : sale.estado,
             fecha_estado_desde: sale.estado === 'PROSPECTO_NUEVO' ? new Date() : sale.fecha_estado_desde,
             version: { increment: 1 }
           }
       });
       await prisma.auditLog.create({
         data: {
           sale_id: id,
           user_id: req.user.id,
           accion: "Consulta Infoburo",
           detalles: `DNI ${target} sin registros en Infoburo para ${dniConsulta}.`
         }
       });
       return res.json({ message: 'DNI sin registros en Infoburo', data: result });
    }

    const semaforo = result.semaforo || 'GRIS';
    const noCalificaBuro = semaforo === 'ROJO';
    const shouldAdvanceToScore = canAdvanceToScore(sale, target, semaforo) &&
      ['PROSPECTO_NUEVO', 'VERIFICACION_SISTEMA'].includes(sale.estado);
    const nextEstado = noCalificaBuro
      ? 'RECHAZADO'
      : (shouldAdvanceToScore ? 'SCORE_BCP' : (sale.estado === 'PROSPECTO_NUEVO' ? 'VERIFICACION_SISTEMA' : sale.estado));
    const rejectionReason = target === 'conyuge' ? 'CONYUGE_NO_CALIFICA' : 'CLIENTE_CON_MALA_DEUDA';

    // Actualizar Sale con los resultados
    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: target === 'conyuge'
          ? {
            conyuge_dni: dniConsulta,
            conyuge_nombres: result.nombres || sale.conyuge_nombres,
            conyuge_rcc_semaforo: semaforo,
            conyuge_rcc_monto_deuda: result.deudaTotal || 0,
            conyuge_rcc_ultima_act: new Date(),
            conyuge_rcc_calificacion: semaforo === 'VERDE' ? 'NORMAL' : 'RIESGO',
            conyuge_rcc_raw_data: JSON.stringify(result),
            estado: nextEstado,
            fecha_estado_desde: nextEstado !== sale.estado ? new Date() : sale.fecha_estado_desde,
            version: { increment: 1 },
            ...(noCalificaBuro ? {
              rechazo_motivo: rejectionReason,
              rechazo_detalle: `Conyuge no califica en Infoburo. Semaforo ${semaforo}. Deuda: S/ ${result.deudaTotal || 0}`
            } : {})
          }
          : {
            rcc_semaforo: semaforo,
            rcc_monto_deuda: result.deudaTotal || 0,
            rcc_ultima_act: new Date(),
            rcc_calificacion: semaforo === 'VERDE' ? 'NORMAL' : 'RIESGO',
            rcc_raw_data: JSON.stringify(result),
            estado: nextEstado,
            fecha_estado_desde: nextEstado !== sale.estado ? new Date() : sale.fecha_estado_desde,
            version: { increment: 1 },
            ...(noCalificaBuro ? {
              rechazo_motivo: rejectionReason,
              rechazo_detalle: `Cliente no califica en Infoburo. Semaforo ${semaforo}. Deuda: S/ ${result.deudaTotal || 0}`
            } : {})
          }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: noCalificaBuro ? "Consulta Infoburo - No Califica" : "Consulta Infoburo",
          estado_anterior: sale.estado,
          estado_nuevo: nextEstado !== sale.estado ? nextEstado : null,
          detalles: `Consulta RCC ${target} completada para ${dniConsulta}. Resultado: ${semaforo} | Deuda: S/ ${result.deudaTotal}`
        }
      });

      return updated;
    });

    res.json({ message: 'Consulta completada con éxito', data: result, sale: updatedSale });
  } catch (error: any) {
    console.error('[RCC_ROUTE] Error:', error.message);
    res.status(500).json({ error: 'No se pudo completar la consulta de Infoburo' });
  }
});

export default router;
