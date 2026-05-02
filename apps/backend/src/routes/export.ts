import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { getSalesFilter } from '../services/hierarchy';

const router = Router();

// Endpoint generico para exportar CSV
// GET /api/export/ventas
router.get('/ventas', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN', 'BACK_OFFICE', 'ANALISTA'), async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    const format = (req.query.format || 'csv').toLowerCase();
    
    const sales = await prisma.sale.findMany({
      where: filter,
      include: {
        asesor: { select: { username: true, nombre: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    // Formato JSON (para exportación Excel client-side)
    if (format === 'json') {
      return res.json({
        data: sales.map(s => ({
          id: s.id,
          dni_cliente: s.dni_cliente,
          nombres_cliente: s.nombres_cliente,
          plaza: s.plaza || '',
          convenio: s.convenio || '',
          maf_neto: s.maf_neto,
          estado: s.estado,
          asesor: s.asesor.nombre || s.asesor.username,
          fecha_ingreso: s.fecha_ingreso ? s.fecha_ingreso.toISOString().split('T')[0] : '',
          fecha_filtro: s.fecha_filtro ? s.fecha_filtro.toISOString().split('T')[0] : '',
          fecha_desembolso: s.fecha_desembolso ? s.fecha_desembolso.toISOString().split('T')[0] : '',
          rcc_semaforo: s.rcc_semaforo || '',
          rcc_monto_deuda: s.rcc_monto_deuda || ''
        })),
        exported_at: new Date().toISOString(),
        total: sales.length
      });
    }

    // Formato CSV (default)
    const headers = [
      'ID', 'DNI Cliente', 'Nombres Cliente', 'Plaza', 'Convenio', 'MAF Neto', 'Estado',
      'Asesor', 'Fecha Ingreso', 'Fecha Filtro', 'Fecha Desembolso', 'Infoburo Semaforo', 'Infoburo Deuda'
    ];

    const rows = sales.map(s => [
      s.id,
      s.dni_cliente,
      `"${s.nombres_cliente}"`,
      s.plaza || '',
      s.convenio || '',
      s.maf_neto,
      s.estado,
      s.asesor.nombre || s.asesor.username,
      s.fecha_ingreso ? s.fecha_ingreso.toISOString().split('T')[0] : '',
      s.fecha_filtro ? s.fecha_filtro.toISOString().split('T')[0] : '',
      s.fecha_desembolso ? s.fecha_desembolso.toISOString().split('T')[0] : '',
      s.rcc_semaforo || '',
      s.rcc_monto_deuda || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('ventas_export.csv');
    res.send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al exportar ventas' });
  }
});

export default router;
