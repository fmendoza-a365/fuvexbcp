import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { canAccessSale } from '../services/hierarchy';
import { getEstadoLabel } from '../middleware/validate';

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
    const {
      simulacion_cuota,
      simulacion_tea,
      simulacion_plazo,
      simulacion_monto,
      simulacion_id,
      calculadora_estado,
      simulacion_dictamen,
      simulacion_payload,
      simulacion_resultado,
      rechazo_motivo,
      rechazo_detalle,
      cliente_acepta
    } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {
        simulacion_cuota: simulacion_cuota ? Number(simulacion_cuota) : null,
        simulacion_tea: simulacion_tea ? Number(simulacion_tea) : null,
        simulacion_plazo: simulacion_plazo ? Number(simulacion_plazo) : null,
        simulacion_monto: simulacion_monto ? Number(simulacion_monto) : null,
        simulacion_id: simulacion_id || null,
        calculadora_estado: calculadora_estado || null,
        simulacion_dictamen: simulacion_dictamen || null,
        simulacion_payload: typeof simulacion_payload === 'string'
          ? simulacion_payload
          : simulacion_payload
            ? JSON.stringify(simulacion_payload)
            : null,
        simulacion_resultado: typeof simulacion_resultado === 'string'
          ? simulacion_resultado
          : simulacion_resultado
            ? JSON.stringify(simulacion_resultado)
            : null
      };

      if (calculadora_estado === 'RECHAZADO') {
        data.estado = 'RECHAZADO';
        data.rechazo_motivo = rechazo_motivo || 'CALCULADORA_NO_CALIFICA';
        data.rechazo_detalle = rechazo_detalle || 'La simulacion no califica para continuar.';
        data.fecha_estado_desde = new Date();
      } else if (['PROSPECTO_NUEVO', 'PENDIENTE_BOLETA', 'EVALUACION_CALCULADORA'].includes(sale.estado) && (calculadora_estado === 'APROBADO' || simulacion_dictamen === 'CONTINUAR')) {
        data.estado = cliente_acepta ? 'PENDIENTE_DATOS_FILE' : 'COTIZACION_ENVIADA';
        data.cotizacion_enviada_at = new Date();
        data.cotizacion_monto = simulacion_monto ? Number(simulacion_monto) : null;
        data.cotizacion_cuota = simulacion_cuota ? Number(simulacion_cuota) : null;
        data.cotizacion_plazo = simulacion_plazo ? Number(simulacion_plazo) : null;
        data.fecha_estado_desde = new Date();
      } else if (sale.estado === 'PENDIENTE_ACEPTACION_CLIENTE' && cliente_acepta) {
        data.estado = 'PENDIENTE_DATOS_FILE';
        data.cotizacion_aceptada_at = new Date();
        data.fecha_estado_desde = new Date();
      }

      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          ...data,
          version: { increment: 1 }
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

  if (sale.estado === 'RECHAZADO') {
    steps.push(
      {
        paso: 1, titulo: 'Expediente Rechazado',
        descripcion: `El expediente fue rechazado. Motivo: ${sale.rechazo_motivo || sale.feedback || 'No especificado'}`,
        estado: 'ACTUAL',
        accion: 'Revisar motivo y decidir si corresponde reingresar el prospecto',
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

  const pasosDef = [
    { keys: ['PROSPECTO_NUEVO', 'VERIFICACION_SISTEMA', 'SCORE_BCP'], titulo: 'Evaluacion inicial', desc: 'Prospecto, verificacion de sistema y score BCP', rol: 'VENTA / BACK_OFFICE' },
    { keys: ['PENDIENTE_BOLETA', 'EVALUACION_CALCULADORA'], titulo: 'Boleta y calculadora', desc: 'Boleta recibida y simulacion del prestamo', rol: 'VENDEDOR' },
    { keys: ['COTIZACION_ENVIADA', 'PENDIENTE_ACEPTACION_CLIENTE'], titulo: 'Cotizacion', desc: 'Cliente revisa y acepta la propuesta', rol: 'VENDEDOR' },
    { keys: ['PENDIENTE_DATOS_FILE'], titulo: 'File', desc: 'Vendedor completa datos y documentos desde la app', rol: 'VENDEDOR' },
    { keys: ['VALIDACION_BACK_OFFICE', 'OBS_BACK_OFFICE'], titulo: 'Back Office', desc: 'Validacion documental y subsanaciones internas', rol: 'BACK_OFFICE' },
    { keys: ['FILE_VALIDADO', 'ENVIADO_BCP_REMESA', 'OBS_BCP'], titulo: 'BCP Remesa', desc: 'Envio del file y respuesta de remesa BCP', rol: 'BACK_OFFICE' },
    { keys: ['REMESA_APROBADA', 'REMESA_REDUCIDA', 'PENDIENTE_ACEPTACION_REMESA', 'PENDIENTE_DESEMBOLSO'], titulo: 'Desembolso', desc: 'Confirmacion de remesa y desembolso', rol: 'BACK_OFFICE' },
    { keys: ['PENDIENTE_CARTA_PODER', 'REENVIADO_BCP_COMPRA_DEUDA', 'PENDIENTE_CARTA_NO_ADEUDO', 'PENDIENTE_LIBERACION'], titulo: 'Compra de deuda', desc: 'Cartas, no adeudo y liberacion del monto', rol: 'BACK_OFFICE' },
    { keys: ['DESEMBOLSADO'], titulo: 'Desembolso', desc: 'Credito desembolsado', rol: 'BACK_OFFICE' }
  ];

  const accionesPorEstado: Record<string, string> = {
    PROSPECTO_NUEVO: 'Iniciar verificacion del cliente',
    VERIFICACION_SISTEMA: 'Consultar deudas del cliente y conyuge si aplica',
    SCORE_BCP: 'Registrar resultado de score BCP',
    PENDIENTE_BOLETA: 'Solicitar boleta al cliente',
    EVALUACION_CALCULADORA: 'Evaluar en calculadora',
    COTIZACION_ENVIADA: 'Dar seguimiento a la cotizacion',
    PENDIENTE_ACEPTACION_CLIENTE: 'Registrar aceptacion del cliente',
    PENDIENTE_DATOS_FILE: 'Cargar documentos obligatorios desde la app',
    VALIDACION_BACK_OFFICE: 'Validar documentos en central web',
    OBS_BACK_OFFICE: 'Subsanar observacion de back office',
    FILE_VALIDADO: 'Enviar file al BCP',
    ENVIADO_BCP_REMESA: 'Registrar respuesta de remesa BCP',
    OBS_BCP: 'Subsanar observacion del BCP',
    REMESA_APROBADA: 'Registrar ruta de desembolso',
    REMESA_REDUCIDA: 'Consultar aceptacion de nuevo monto',
    PENDIENTE_ACEPTACION_REMESA: 'Registrar decision del cliente',
    PENDIENTE_DESEMBOLSO: 'Confirmar desembolso',
    PENDIENTE_CARTA_PODER: 'Registrar carta poder',
    REENVIADO_BCP_COMPRA_DEUDA: 'Dar seguimiento a compra de deuda',
    PENDIENTE_CARTA_NO_ADEUDO: 'Validar carta de no adeudo',
    PENDIENTE_LIBERACION: 'Registrar liberacion de compra de deuda',
    DESEMBOLSADO: 'Expediente cerrado'
  };

  const idxActual = pasosDef.findIndex((p) => p.keys.includes(sale.estado));

  for (let i = 0; i < pasosDef.length; i++) {
    const p = pasosDef[i];
    let estado: typeof steps[0]['estado'] = 'PENDIENTE';

    if (idxActual === -1) estado = i === 0 ? 'ACTUAL' : 'PENDIENTE';
    else if (i < idxActual) estado = 'COMPLETADO';
    else if (i === idxActual) estado = 'ACTUAL';
    else estado = 'PENDIENTE';

    steps.push({
      paso: i + 1,
      titulo: p.titulo,
      descripcion: i === idxActual ? `${p.desc}. Estado actual: ${getEstadoLabel(sale.estado)}` : p.desc,
      estado,
      accion: i === idxActual ? accionesPorEstado[sale.estado] : undefined,
      rol_responsable: p.rol
    });
  }

  return steps;
}

export default router;
