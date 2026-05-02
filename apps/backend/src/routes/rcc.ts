import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { consultarRCC } from '../services/infoburo';

const router = Router();

// POST /api/sales/:id/rcc - Consultar y guardar Infoburo para un expediente
router.post('/:id/rcc', authMiddleware, authorize('BACK_OFFICE', 'ANALISTA', 'SUPERVISOR', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { force = false } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return res.status(404).json({ error: 'Expediente no encontrado' });

    console.log(`[RCC_ROUTE] Iniciando consulta para DNI: ${sale.dni_cliente} (SaleId: ${id})`);
    
    // Si no es forzado y ya tiene datos recientes (últimas 24h), podríamos devolver los guardados
    // Pero el usuario pidió un botón de refrescar, así que usualmente vendrá force=true
    
    const result = await consultarRCC(sale.dni_cliente);
    
    if (!result || result.nombres === 'No encontrado / Sin historial') {
       // Actualizar con datos vacíos si no se encuentra
       await prisma.sale.update({
         where: { id },
         data: {
           rcc_semaforo: 'GRIS',
           rcc_monto_deuda: 0,
           rcc_ultima_act: new Date(),
           rcc_calificacion: 'SIN REGISTROS',
           rcc_raw_data: JSON.stringify(result)
         }
       });
       return res.json({ message: 'DNI sin registros en Infoburo', data: result });
    }

    // Actualizar Sale con los resultados
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        rcc_semaforo: result.semaforo || 'GRIS',
        rcc_monto_deuda: result.deudaTotal || 0,
        rcc_ultima_act: new Date(),
        rcc_calificacion: result.semaforo === 'VERDE' ? 'NORMAL' : 'RIESGO',
        rcc_raw_data: JSON.stringify(result)
      }
    });

    // Auditoría
    await prisma.auditLog.create({
      data: {
        sale_id: id,
        user_id: req.user.id,
        accion: "Consulta Infoburo",
        detalles: `Consulta RCC completada para ${sale.dni_cliente}. Resultado: ${result.semaforo} | Deuda: S/ ${result.deudaTotal}`
      }
    });

    res.json({ message: 'Consulta completada con éxito', data: result });
  } catch (error: any) {
    console.error('[RCC_ROUTE] Error:', error.message);
    res.status(500).json({ error: 'No se pudo completar la consulta de Infoburo' });
  }
});

export default router;
