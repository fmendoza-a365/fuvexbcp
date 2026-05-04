import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { canAccessSale } from '../services/hierarchy';

const router = Router();

// ═══════════════════════════════════════════════════
// GET /api/sales/:id/checklist
// Retorna el checklist de documentos requeridos vs subidos
// para el convenio del expediente
// ═══════════════════════════════════════════════════
router.get('/:id/checklist', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { documents: true }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    // Buscar documentos requeridos para este convenio (o wildcard "*")
    const convenioDocs = await prisma.documentoRequerido.findMany({
      where: {
        activo: true,
        OR: [
          { convenio: sale.convenio || '' },
          { convenio: '*' }
        ]
      },
      orderBy: { orden: 'asc' }
    });

    // Si hay documentos específicos para el convenio, usarlos; si no, usar wildcard
    const docsEspecificos = convenioDocs.filter(d => d.convenio === sale.convenio);
    const docsWildcard = convenioDocs.filter(d => d.convenio === '*');
    const docsRequeridos = docsEspecificos.length > 0 ? docsEspecificos : docsWildcard;

    // Mapear con estado de subida
    const uploadedTypes = new Set(sale.documents.map((d: any) => d.tipo_documento));

    const checklist = docsRequeridos.map(doc => ({
      tipo_doc: doc.tipo_doc,
      nombre: doc.nombre,
      obligatorio: doc.obligatorio,
      orden: doc.orden,
      estado: uploadedTypes.has(doc.tipo_doc) ? 'SUBIDO' : 'PENDIENTE',
      documento: sale.documents.find((d: any) => d.tipo_documento === doc.tipo_doc) || null
    }));

    const totalRequeridos = docsRequeridos.filter(d => d.obligatorio).length;
    const totalSubidos = checklist.filter(c => c.obligatorio && c.estado === 'SUBIDO').length;
    const completitud = totalRequeridos > 0 ? Math.round((totalSubidos / totalRequeridos) * 100) : 0;
    const completo = totalRequeridos === totalSubidos;

    res.json({
      sale_id: id,
      convenio: sale.convenio,
      checklist,
      resumen: {
        total_documentos: docsRequeridos.length,
        obligatorios: totalRequeridos,
        subidos: totalSubidos,
        pendientes: totalRequeridos - totalSubidos,
        completitud_pct: completitud,
        completo
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener checklist' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/sales/:id/nextSteps
// Retorna qué hacer según el estado actual del expediente
// ═══════════════════════════════════════════════════
router.get('/:id/nextSteps', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { documents: true }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const role = req.user.role;
    const steps = getNextSteps(sale, role);

    res.json({
      sale_id: id,
      estado_actual: sale.estado,
      rol_usuario: role,
      pasos: steps
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pasos' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/sales/:id/tiempo-estado
// Retorna tiempo transcurrido en el estado actual
// ═══════════════════════════════════════════════════
router.get('/:id/tiempo-estado', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({ where: { id } });

    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const ahora = new Date();
    const inicioEstado = (sale as any).fecha_estado_desde || sale.created_at;
    const diffMs = ahora.getTime() - inicioEstado.getTime();
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;

    res.json({
      sale_id: id,
      estado_actual: sale.estado,
      fecha_estado_desde: inicioEstado.toISOString(),
      tiempo_transcurrido: {
        dias,
        horas: horasRestantes,
        total_horas: horas,
        total_minutos: Math.floor(diffMs / (1000 * 60))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular tiempo' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /api/sales/:id/simulacion
// Vincular datos de simulación al expediente
// ═══════════════════════════════════════════════════
router.put('/:id/simulacion', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { simulacion_cuota, simulacion_tea, simulacion_plazo, simulacion_monto, simulacion_id } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          simulacion_cuota: simulacion_cuota ? Number(simulacion_cuota) : null,
          simulacion_tea: simulacion_tea ? Number(simulacion_tea) : null,
          simulacion_plazo: simulacion_plazo ? Number(simulacion_plazo) : null,
          simulacion_monto: simulacion_monto ? Number(simulacion_monto) : null,
          simulacion_id: simulacion_id || null
        }
      });

      await tx.auditLog.create({
        data: {
          sale_id: id,
          user_id: req.user.id,
          accion: "Vinculación de Simulación",
          detalles: `Simulación vinculada: S/ ${simulacion_monto} a ${simulacion_plazo} meses, cuota S/ ${simulacion_cuota}`
        }
      });

      return updatedSale;
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al vincular simulación' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/documentos-requeridos
// Listar todos los documentos requeridos (admin)
// ═══════════════════════════════════════════════════
router.get('/documentos-requeridos', authMiddleware, async (req: any, res: any) => {
  try {
    const { convenio } = req.query;

    const where: any = { activo: true };
    if (convenio) where.convenio = convenio;

    const docs = await prisma.documentoRequerido.findMany({
      where,
      orderBy: [
        { convenio: 'asc' },
        { orden: 'asc' }
      ]
    });

    res.json(docs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener documentos requeridos' });
  }
});

// ═══════════════════════════════════════════════════
// Función auxiliar: Determinar pasos según estado y rol
// ═══════════════════════════════════════════════════
function getNextSteps(sale: any, role: string) {
  const steps: Array<{
    paso: number;
    titulo: string;
    descripcion: string;
    estado: 'COMPLETADO' | 'ACTUAL' | 'PENDIENTE' | 'BLOQUEADO';
    accion?: string;
    rol_responsable: string;
  }> = [];

  const estadoOrden = [
    'POR INGRESAR',
    'EN PROCESO',
    'APROBADA',
    'CONFORMIDAD',
    'DESEMBOLSADO'
  ];

  const idxActual = estadoOrden.indexOf(sale.estado);

  // Si el expediente está en estado especial
  if (sale.estado === 'OBSERVADA') {
    steps.push(
      {
        paso: 1, titulo: 'Registro de Datos',
        descripcion: 'Datos del cliente registrados',
        estado: 'COMPLETADO', rol_responsable: 'VENDEDOR'
      },
      {
        paso: 2, titulo: 'Evaluación',
        descripcion: 'El expediente fue observado por el supervisor',
        estado: 'ACTUAL',
        accion: 'Subsanar observaciones y reenviar a Supervisor',
        rol_responsable: 'VENDEDOR'
      },
      {
        paso: 3, titulo: 'Re-evaluación',
        descripcion: 'Supervisor revisará las correcciones',
        estado: 'BLOQUEADO', rol_responsable: 'SUPERVISOR'
      },
      {
        paso: 4, titulo: 'Aprobación',
        descripcion: 'Esperando aprobación',
        estado: 'BLOQUEADO', rol_responsable: 'SUPERVISOR'
      },
      {
        paso: 5, titulo: 'Desembolso',
        descripcion: 'Tramitación final',
        estado: 'BLOQUEADO', rol_responsable: 'BACK_OFFICE'
      }
    );
    return steps;
  }

  if (sale.estado === 'RECHAZADO') {
    steps.push(
      {
        paso: 1, titulo: 'Expediente Rechazado',
        descripcion: `El expediente fue rechazado. Motivo: ${sale.feedback || 'No especificado'}`,
        estado: 'ACTUAL',
        accion: 'Contactar al cliente y evaluar reingreso',
        rol_responsable: role
      }
    );
    return steps;
  }

  if (sale.estado === 'PENDIENTE_REASIGNACION') {
    steps.push(
      {
        paso: 1, titulo: 'Pendiente de Reasignación',
        descripcion: 'Este expediente requiere reasignación por duplicidad de DNI',
        estado: 'ACTUAL',
        accion: 'Esperando decisión del Jefe Zonal / Gerente',
        rol_responsable: 'JEFE_ZONAL'
      }
    );
    return steps;
  }

  if (sale.estado === 'REASIGNADO') {
    steps.push(
      {
        paso: 1, titulo: 'Reasignado',
        descripcion: 'El cliente fue reasignado a otro asesor',
        estado: 'COMPLETADO', rol_responsable: 'JEFE_ZONAL'
      }
    );
    return steps;
  }

  // Flujo normal
  const pasosDef = [
    { key: 'POR INGRESAR', titulo: 'Registro de Datos', desc: 'DNI, nombre, plaza, convenio y monto ingresados', rol: 'VENDEDOR' },
    { key: 'EN PROCESO', titulo: 'Evaluación y Documentos', desc: 'Subir documentos requeridos, revisión del supervisor', rol: 'SUPERVISOR' },
    { key: 'APROBADA', titulo: 'Aprobación', desc: 'Expediente aprobado, pendiente de conformidad', rol: 'SUPERVISOR' },
    { key: 'CONFORMIDAD', titulo: 'Conformidad', desc: 'Conformidad de documentos verificada por Back Office', rol: 'BACK_OFFICE' },
    { key: 'DESEMBOLSADO', titulo: 'Desembolso', desc: 'Crédito desembolsado', rol: 'BACK_OFFICE' }
  ];

  for (let i = 0; i < pasosDef.length; i++) {
    const p = pasosDef[i];
    let estado: typeof steps[0]['estado'] = 'PENDIENTE';

    if (i < idxActual) estado = 'COMPLETADO';
    else if (i === idxActual) estado = 'ACTUAL';
    else estado = 'PENDIENTE';

    steps.push({
      paso: i + 1,
      titulo: p.titulo,
      descripcion: p.desc,
      estado,
      rol_responsable: p.rol
    });
  }

  return steps;
}

export default router;