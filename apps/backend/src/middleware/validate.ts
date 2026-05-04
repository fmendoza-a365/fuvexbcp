// ══════════════════════════════════════════════════
// Middleware de Validación — Fuvex Manager
// Validadores puros sin dependencias externas
// ══════════════════════════════════════════════════

// Estados válidos del sistema (14 estados - flujo BCP completo)
// Los 9 estados originales se mantienen para compatibilidad
// Los nuevos estados BCP se integran incrementalmente
export const VALID_ESTADOS = [
  // ── Estados originales (9) ──────────────────────
  'POR INGRESAR',
  'EN PROCESO',
  'APROBADA',
  'OBSERVADA',
  'SUBSANADA',
  'DESEMBOLSADO',
  'RECHAZADO',
  'REASIGNADO',
  'PENDIENTE_REASIGNACION',
  // ── Nuevos estados BCP (5) ─────────────────────
  'PENDIENTE_REMESA',          // Esperando remesa/documentos físicos
  'PENDIENTE_INSTITUCIONES',   // Enviado a CIA/SIS/ESSALUD/etc.
  'PENDIENTE_DOCUMENTAR',      // Falta documentación del cliente
  'PENDIENTE_BACK_OFFICE',     // En manos de back office para envío BCP
  'EN_EVALUACION_BCP',         // Expediente enviado a BCP, esperando respuesta
  'OBSERVADO_BACK',            // BCP observó, back office corrige
  'RECHAZADA_POR_SCORE',       // Rechazado por score crediticio BCP
  'BOLETA_NO_CALIFICA',        // Boleta no califica para el convenio
] as const;

// Catálogo de motivos frecuentes para rechazos y observaciones
export const CATALOGO_MOTIVOS = {
  RECHAZADO: [
    'Score crediticio insuficiente',
    'Deuda vencida en sistema financiero',
    'Documentos falsos o adulterados',
    'Cliente no cumple requisitos del convenio',
    'Ingresos insuficientes para el monto solicitado',
    'Restricción de AFP o judiciales',
    'Cliente desistió del trámite',
    'Duplicidad de expediente',
    'Otro (especificar)'
  ],
  OBSERVADA: [
    'Documentación incompleta',
    'Boleta de pago ilegible o vencida',
    'Certificado de trabajo vencido',
    'Error en datos del cliente',
    'Firma ilegible o faltante',
    'Monto no concuerda con documentación',
    'RCC con inconsistencias',
    'Falta carta de compra de deuda',
    'Otro (especificar)'
  ],
  OBSERVADO_BACK: [
    'Documentos BCP incompletos',
    'Error en liquidación',
    'Falta título de propiedad',
    'Ficha técnica desactualizada',
    'Otro (especificar)'
  ],
  RECHAZADA_POR_SCORE: [
    'Score debajo del mínimo del convenio',
    'Calificación negativa en centrales de riesgo',
    'Monto excede capacidad de endeudamiento',
    'Otro (especificar)'
  ],
  BOLETA_NO_CALIFICA: [
    'Boleta no pertenece al convenio activo',
    'Tiempo de servicio insuficiente',
    'Tipo de contratación no aceptado',
    'Otro (especificar)'
  ]
} as const;

// Roles válidos del sistema
export const VALID_ROLES = [
  'SUPERADMIN',
  'GERENTE',
  'JEFE_ZONAL',
  'SUPERVISOR',
  'BACK_OFFICE',
  'ANALISTA',
  'VENDEDOR'
] as const;

// ══════════════════════════════════════════════════
// STATE MACHINE — Transiciones válidas por rol
// Define qué cambios de estado son permitidos y por quién
// ══════════════════════════════════════════════════

interface Transition {
  from: string;
  to: string;
  roles: string[];      // Roles que pueden ejecutar esta transición
  requiresMotivo: boolean; // Si el motivo es obligatorio
  label: string;        // Descripción legible de la transición
}

export const TRANSICIONES: Transition[] = [
  // ══════════════════════════════════════════════════
  // FLUJO ORIGINAL (9 estados) — Compatibilidad
  // ══════════════════════════════════════════════════

  // ── Flujo principal del vendedor ──────────────────────
  {
    from: 'POR INGRESAR',
    to: 'EN PROCESO',
    roles: ['VENDEDOR', 'SUPERVISOR', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Expediente en evaluación — vendedor inicia trámite'
  },
  {
    from: 'EN PROCESO',
    to: 'APROBADA',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: false,
    label: 'Expediente aprobado — listo para envío'
  },
  {
    from: 'APROBADA',
    to: 'DESEMBOLSADO',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Crédito desembolsado — operación completada'
  },

  // ── Observaciones y subsanación ───────────────────────
  {
    from: 'EN PROCESO',
    to: 'OBSERVADA',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Expediente observado — requiere correcciones'
  },
  {
    from: 'OBSERVADA',
    to: 'SUBSANADA',
    roles: ['VENDEDOR', 'SUPERVISOR', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Observaciones corregidas — vendedor resube'
  },
  {
    from: 'SUBSANADA',
    to: 'EN PROCESO',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: false,
    label: 'Subsanación validada — expediente vuelve a evaluación'
  },
  {
    from: 'SUBSANADA',
    to: 'OBSERVADA',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Subsanación insuficiente — requiere más correcciones'
  },

  // ── Rechazos ──────────────────────────────────────────
  {
    from: 'EN PROCESO',
    to: 'RECHAZADO',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Expediente rechazado — no cumple requisitos'
  },
  {
    from: 'OBSERVADA',
    to: 'RECHAZADO',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Expediente rechazado — observaciones no corregidas'
  },

  // ── Reasignación ──────────────────────────────────────
  {
    from: 'POR INGRESAR',
    to: 'REASIGNADO',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Prospecto reasignado a otro asesor'
  },
  {
    from: 'REASIGNADO',
    to: 'POR INGRESAR',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: false,
    label: 'Reasignación aceptada — nuevo asesor toma el prospecto'
  },
  {
    from: 'POR INGRESAR',
    to: 'PENDIENTE_REASIGNACION',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Solicitud de reasignación pendiente'
  },
  {
    from: 'PENDIENTE_REASIGNACION',
    to: 'REASIGNADO',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: false,
    label: 'Reasignación confirmada'
  },
  {
    from: 'PENDIENTE_REASIGNACION',
    to: 'POR INGRESAR',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Reasignación cancelada — vuelve al asesor original'
  },

  // ── Revertir rechazo (solo SUPERADMIN/GERENTE) ──────
  {
    from: 'RECHAZADO',
    to: 'EN PROCESO',
    roles: ['SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Rechazo revertido — expediente reabierto'
  },

  // ══════════════════════════════════════════════════
  // FLUJO BCP EXPANDIDO — Nuevos estados
  // ══════════════════════════════════════════════════

  // ── Flujo BCP: EN PROCESO → Pendientes de documentación/instituciones ──
  {
    from: 'EN PROCESO',
    to: 'PENDIENTE_DOCUMENTAR',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Falta documentación del cliente — vendedor debe recolectar'
  },
  {
    from: 'PENDIENTE_DOCUMENTAR',
    to: 'EN PROCESO',
    roles: ['VENDEDOR', 'SUPERVISOR', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Documentación completa — vuelve a evaluación'
  },
  {
    from: 'PENDIENTE_DOCUMENTAR',
    to: 'RECHAZADO',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Documentación no entregada — expediente rechazado'
  },

  // ── Flujo BCP: EN PROCESO → Pendiente instituciones ──
  {
    from: 'EN PROCESO',
    to: 'PENDIENTE_INSTITUCIONES',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Enviado a instituciones (RENIEC, SUNAT, ESSALUD, etc.)'
  },
  {
    from: 'PENDIENTE_INSTITUCIONES',
    to: 'EN PROCESO',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Instituciones respondieron — vuelve a evaluación'
  },
  {
    from: 'PENDIENTE_INSTITUCIONES',
    to: 'PENDIENTE_BACK_OFFICE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Instituciones OK — pasa a preparación de expediente BCP'
  },
  {
    from: 'PENDIENTE_INSTITUCIONES',
    to: 'RECHAZADO',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Institución rechazó — expediente no viable'
  },

  // ── Flujo BCP: Pendiente remesa ──
  {
    from: 'EN PROCESO',
    to: 'PENDIENTE_REMESA',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Aprobado — esperando remesa/documentos físicos'
  },
  {
    from: 'PENDIENTE_REMESA',
    to: 'PENDIENTE_BACK_OFFICE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Remesa recibida — pasa a preparación BCP'
  },

  // ── Flujo BCP: Pendiente Back Office ──
  {
    from: 'EN PROCESO',
    to: 'PENDIENTE_BACK_OFFICE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Expediente completo — pasa a back office para envío BCP'
  },
  {
    from: 'PENDIENTE_BACK_OFFICE',
    to: 'EN_EVALUACION_BCP',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Expediente enviado a BCP para evaluación'
  },
  {
    from: 'PENDIENTE_BACK_OFFICE',
    to: 'OBSERVADO_BACK',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Back office detectó error — requiere corrección antes de envío'
  },
  {
    from: 'OBSERVADO_BACK',
    to: 'PENDIENTE_BACK_OFFICE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'Error corregido — vuelve a preparación'
  },

  // ── Flujo BCP: Evaluación BCP ──
  {
    from: 'EN_EVALUACION_BCP',
    to: 'APROBADA',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'BCP aprobó el crédito — listo para desembolso'
  },
  {
    from: 'EN_EVALUACION_BCP',
    to: 'DESEMBOLSADO',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: false,
    label: 'BCP desembolsó directamente — operación completada'
  },
  {
    from: 'EN_EVALUACION_BCP',
    to: 'RECHAZADA_POR_SCORE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'BCP rechazó por score crediticio'
  },
  {
    from: 'EN_EVALUACION_BCP',
    to: 'PENDIENTE_BACK_OFFICE',
    roles: ['BACK_OFFICE', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'BCP observó — vuelve a back office para corrección'
  },

  // ── Flujo BCP: Observaciones y rechazos específicos ──
  {
    from: 'EN PROCESO',
    to: 'BOLETA_NO_CALIFICA',
    roles: ['SUPERVISOR', 'BACK_OFFICE', 'SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'],
    requiresMotivo: true,
    label: 'Boleta del cliente no califica para el convenio'
  },
  {
    from: 'BOLETA_NO_CALIFICA',
    to: 'EN PROCESO',
    roles: ['SUPERVISOR', 'SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Reevaluación — cliente presenta nueva documentación'
  },

  // ── Revertir rechazos BCP (solo SUPERADMIN/GERENTE) ──
  {
    from: 'RECHAZADA_POR_SCORE',
    to: 'EN PROCESO',
    roles: ['SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Rechazo BCP revertido — expediente reabierto para reevaluación'
  },
  {
    from: 'RECHAZADA_POR_SCORE',
    to: 'PENDIENTE_DOCUMENTAR',
    roles: ['SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Rechazo BCP revertido — requiere nueva documentación'
  },
];

// ── Funciones del StateMachine ────────────────────────

/**
 * Obtiene las transiciones válidas desde un estado dado para un rol específico
 */
export function getValidTransitions(currentEstado: string, userRole: string): Transition[] {
  return TRANSICIONES.filter(t => t.from === currentEstado && t.roles.includes(userRole));
}

/**
 * Valida si una transición es permitida
 * Retorna { valid, transition?, error? }
 */
export function validateTransition(
  currentEstado: string,
  targetEstado: string,
  userRole: string,
  motivo?: string
): { valid: boolean; transition?: Transition; error?: string } {
  // Buscar la transición que coincida
  const transition = TRANSICIONES.find(
    t => t.from === currentEstado && t.to === targetEstado
  );

  if (!transition) {
    const validTargets = TRANSICIONES
      .filter(t => t.from === currentEstado)
      .map(t => t.to);
    return {
      valid: false,
      error: `Transición no permitida: "${currentEstado}" → "${targetEstado}". Estados válidos desde "${currentEstado}": [${validTargets.join(', ')}]`
    };
  }

  // Verificar que el rol tenga permiso
  if (!transition.roles.includes(userRole)) {
    return {
      valid: false,
      error: `El rol "${userRole}" no tiene permiso para esta transición (${transition.label}). Roles permitidos: [${transition.roles.join(', ')}]`
    };
  }

  // Verificar motivo obligatorio
  if (transition.requiresMotivo && (!motivo || motivo.trim().length === 0)) {
    return {
      valid: false,
      error: `El motivo es obligatorio para: ${transition.label}`
    };
  }

  return { valid: true, transition };
}

/**
 * Obtiene el label legible de un estado
 */
export function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    'POR INGRESAR': 'Por Ingresar',
    'EN PROCESO': 'En Proceso',
    'APROBADA': 'Aprobada',
    'OBSERVADA': 'Observada',
    'SUBSANADA': 'Subsanada',
    'DESEMBOLSADO': 'Desembolsado',
    'RECHAZADO': 'Rechazado',
    'REASIGNADO': 'Reasignado',
    'PENDIENTE_REASIGNACION': 'Pendiente Reasignación',
    'PENDIENTE_REMESA': 'Pendiente Remesa',
    'PENDIENTE_INSTITUCIONES': 'Pendiente Instituciones',
    'PENDIENTE_DOCUMENTAR': 'Pendiente Documentar',
    'PENDIENTE_BACK_OFFICE': 'Pendiente Back Office',
    'EN_EVALUACION_BCP': 'En Evaluación BCP',
    'OBSERVADO_BACK': 'Observado Back Office',
    'RECHAZADA_POR_SCORE': 'Rechazada por Score',
    'BOLETA_NO_CALIFICA': 'Boleta No Califica'
  };
  return labels[estado] || estado;
}

// Campos que NUNCA deben ser modificables via PUT genérico
const PROTECTED_FIELDS = ['id', 'asesor_id', 'created_at', 'updated_at', 'password_hash'];

// ── Helpers ────────────────────────────────────────

function sanitizeString(value: any): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/<[^>]*>/g, ''); // Strip HTML tags
}

function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

// ── Validadores como Middleware ────────────────────

/**
 * Validar creación de venta
 */
export const validateCreateSale = (req: any, res: any, next: any) => {
  const { dni_cliente, nombres_cliente, maf_neto, convenio } = req.body;

  const errors: string[] = [];

  if (!dni_cliente || !isValidDni(String(dni_cliente))) {
    errors.push('DNI inválido — debe ser exactamente 8 dígitos numéricos');
  }

  if (!nombres_cliente || sanitizeString(nombres_cliente).length < 3) {
    errors.push('Nombres del cliente requeridos (mínimo 3 caracteres)');
  }

  if (maf_neto === undefined || isNaN(Number(maf_neto)) || Number(maf_neto) < 0) {
    errors.push('MAF Neto debe ser un número positivo');
  }

  if (!convenio || sanitizeString(convenio).length === 0) {
    errors.push('Convenio es requerido');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors });
  }

  // Sanitizar strings
  req.body.nombres_cliente = sanitizeString(nombres_cliente);
  req.body.convenio = sanitizeString(convenio);
  if (req.body.plaza) req.body.plaza = sanitizeString(req.body.plaza);
  if (req.body.feedback) req.body.feedback = sanitizeString(req.body.feedback);

  next();
};

/**
 * Validar cambio de estado
 */
export const validateEstadoChange = (req: any, res: any, next: any) => {
  const { nuevo_estado } = req.body;

  if (!nuevo_estado || !VALID_ESTADOS.includes(nuevo_estado)) {
    return res.status(400).json({
      error: `Estado inválido: "${nuevo_estado}"`,
      valid_states: VALID_ESTADOS
    });
  }

  next();
};

/**
 * Validar creación de usuario
 */
export const validateCreateUser = (req: any, res: any, next: any) => {
  const { username, nombre, password, role } = req.body;
  const errors: string[] = [];

  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    errors.push('Username debe tener 3-30 caracteres alfanuméricos (se permite _)');
  }

  if (!nombre || sanitizeString(nombre).length < 2) {
    errors.push('Nombre requerido (mínimo 2 caracteres)');
  }

  if (!password || password.length < 8) {
    errors.push('Password debe tener mínimo 8 caracteres');
  }

  if (!role || !VALID_ROLES.includes(role)) {
    errors.push(`Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors });
  }

  req.body.nombre = sanitizeString(nombre);
  next();
};

/**
 * Filtrar campos protegidos en updates genéricos de ventas
 */
export const filterProtectedFields = (req: any, res: any, next: any) => {
  for (const field of PROTECTED_FIELDS) {
    delete req.body[field];
  }
  next();
};
