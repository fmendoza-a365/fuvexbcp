// Validacion y maquina de estados operativa para Fuvex Manager.

export const VALID_ESTADOS = [
  'PROSPECTO_NUEVO',
  'PENDIENTE_DATOS',
  'PENDIENTE_DOCUMENTOS',
  'LISTO_SCORE',
  'SCORE_APROBADO',
  'SIMULACION_ACEPTADA',
  'ENVIADO_CONVENIO',
  'CONVENIO_APROBADO',
  'PREPARANDO_BCP',
  'ENVIADO_BCP',
  'APROBADO_BCP',
  'DESEMBOLSADO',
  'OBSERVADO',
  'RECHAZADO',
  'REASIGNADO',
  'PENDIENTE_REASIGNACION',
] as const;

export type EstadoOperativo = typeof VALID_ESTADOS[number];

export const CATALOGO_MOTIVOS = {
  OBSERVADO: [
    'Datos del cliente incompletos',
    'Documentacion incompleta',
    'Documento ilegible o vencido',
    'Datos laborales no coinciden',
    'RCC requiere validacion',
    'Convenio solicito subsanacion',
    'BCP observo el expediente',
    'Otro (especificar)'
  ],
  RECHAZADO: [
    'Score crediticio insuficiente',
    'Cliente no cumple requisitos del convenio',
    'Ingresos insuficientes para el monto solicitado',
    'Boleta no califica',
    'Convenio rechazo el expediente',
    'BCP rechazo el expediente',
    'Cliente desistio del tramite',
    'Duplicidad de expediente',
    'Otro (especificar)'
  ],
} as const;

export const VALID_ROLES = [
  'SUPERADMIN',
  'GERENTE',
  'JEFE_ZONAL',
  'SUPERVISOR',
  'BACK_OFFICE',
  'ANALISTA',
  'VENDEDOR'
] as const;

interface Transition {
  from: string;
  to: string;
  roles: string[];
  requiresMotivo: boolean;
  label: string;
}

const TODOS = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'BACK_OFFICE', 'ANALISTA', 'VENDEDOR'];
const VENTA = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'VENDEDOR'];
const REVISION = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR', 'BACK_OFFICE', 'ANALISTA'];
const BACK = ['SUPERADMIN', 'GERENTE', 'BACK_OFFICE'];
const JEFATURA = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR'];

export const TRANSICIONES: Transition[] = [
  {
    from: 'PROSPECTO_NUEVO',
    to: 'PENDIENTE_DATOS',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Faltan datos operativos del cliente o del cargo'
  },
  {
    from: 'PROSPECTO_NUEVO',
    to: 'PENDIENTE_DOCUMENTOS',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Cliente registrado, falta documentacion'
  },
  {
    from: 'PROSPECTO_NUEVO',
    to: 'LISTO_SCORE',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Datos minimos completos, listo para score'
  },
  {
    from: 'PENDIENTE_DATOS',
    to: 'PENDIENTE_DOCUMENTOS',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Datos completos, falta documentacion'
  },
  {
    from: 'PENDIENTE_DATOS',
    to: 'LISTO_SCORE',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Datos completos, enviar a score'
  },
  {
    from: 'PENDIENTE_DOCUMENTOS',
    to: 'LISTO_SCORE',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Documentos completos, listo para score'
  },
  {
    from: 'LISTO_SCORE',
    to: 'SCORE_APROBADO',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Score/RCC validado'
  },
  {
    from: 'LISTO_SCORE',
    to: 'OBSERVADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Score o documentacion requieren correccion'
  },
  {
    from: 'LISTO_SCORE',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'No califica en score o RCC'
  },
  {
    from: 'SCORE_APROBADO',
    to: 'SIMULACION_ACEPTADA',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Cliente acepta simulacion'
  },
  {
    from: 'SCORE_APROBADO',
    to: 'OBSERVADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Ajustar simulacion o datos antes de continuar'
  },
  {
    from: 'SIMULACION_ACEPTADA',
    to: 'ENVIADO_CONVENIO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Expediente enviado al convenio'
  },
  {
    from: 'SIMULACION_ACEPTADA',
    to: 'OBSERVADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Falta subsanar antes del envio al convenio'
  },
  {
    from: 'ENVIADO_CONVENIO',
    to: 'CONVENIO_APROBADO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Convenio responde conforme'
  },
  {
    from: 'ENVIADO_CONVENIO',
    to: 'OBSERVADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'Convenio observo el expediente'
  },
  {
    from: 'ENVIADO_CONVENIO',
    to: 'RECHAZADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'Convenio rechazo el expediente'
  },
  {
    from: 'CONVENIO_APROBADO',
    to: 'PREPARANDO_BCP',
    roles: BACK,
    requiresMotivo: false,
    label: 'Preparar expediente fisico/digital para BCP'
  },
  {
    from: 'PREPARANDO_BCP',
    to: 'ENVIADO_BCP',
    roles: BACK,
    requiresMotivo: false,
    label: 'Expediente enviado a BCP'
  },
  {
    from: 'PREPARANDO_BCP',
    to: 'OBSERVADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'Falta corregir expediente antes de BCP'
  },
  {
    from: 'ENVIADO_BCP',
    to: 'APROBADO_BCP',
    roles: BACK,
    requiresMotivo: false,
    label: 'BCP aprobo la operacion'
  },
  {
    from: 'ENVIADO_BCP',
    to: 'OBSERVADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP observo el expediente'
  },
  {
    from: 'ENVIADO_BCP',
    to: 'RECHAZADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP rechazo la operacion'
  },
  {
    from: 'APROBADO_BCP',
    to: 'DESEMBOLSADO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Registrar desembolso'
  },
  {
    from: 'OBSERVADO',
    to: 'PENDIENTE_DATOS',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Corregir datos'
  },
  {
    from: 'OBSERVADO',
    to: 'PENDIENTE_DOCUMENTOS',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Subsanar documentos'
  },
  {
    from: 'OBSERVADO',
    to: 'LISTO_SCORE',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Observacion subsanada, volver a score'
  },
  {
    from: 'OBSERVADO',
    to: 'ENVIADO_CONVENIO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Subsanacion lista, reenviar al convenio'
  },
  {
    from: 'OBSERVADO',
    to: 'PREPARANDO_BCP',
    roles: BACK,
    requiresMotivo: false,
    label: 'Subsanacion lista, preparar BCP'
  },
  {
    from: 'RECHAZADO',
    to: 'PROSPECTO_NUEVO',
    roles: ['SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Reabrir expediente rechazado'
  },
  {
    from: 'PROSPECTO_NUEVO',
    to: 'PENDIENTE_REASIGNACION',
    roles: JEFATURA,
    requiresMotivo: true,
    label: 'Solicitar reasignacion por duplicidad'
  },
  {
    from: 'PENDIENTE_REASIGNACION',
    to: 'REASIGNADO',
    roles: JEFATURA,
    requiresMotivo: false,
    label: 'Confirmar reasignacion'
  },
  {
    from: 'PENDIENTE_REASIGNACION',
    to: 'PROSPECTO_NUEVO',
    roles: JEFATURA,
    requiresMotivo: true,
    label: 'Cancelar reasignacion'
  },
  {
    from: 'REASIGNADO',
    to: 'PROSPECTO_NUEVO',
    roles: JEFATURA,
    requiresMotivo: false,
    label: 'Nuevo asesor toma el prospecto'
  },
];

export function getValidTransitions(currentEstado: string, userRole: string): Transition[] {
  return TRANSICIONES.filter(t => t.from === currentEstado && t.roles.includes(userRole));
}

export function validateTransition(
  currentEstado: string,
  targetEstado: string,
  userRole: string,
  motivo?: string
): { valid: boolean; transition?: Transition; error?: string } {
  const transition = TRANSICIONES.find(t => t.from === currentEstado && t.to === targetEstado);

  if (!transition) {
    const validTargets = TRANSICIONES
      .filter(t => t.from === currentEstado)
      .map(t => t.to);
    return {
      valid: false,
      error: `Transicion no permitida: "${currentEstado}" -> "${targetEstado}". Estados validos desde "${currentEstado}": [${validTargets.join(', ')}]`
    };
  }

  if (!transition.roles.includes(userRole)) {
    return {
      valid: false,
      error: `El rol "${userRole}" no tiene permiso para esta transicion (${transition.label}). Roles permitidos: [${transition.roles.join(', ')}]`
    };
  }

  if (transition.requiresMotivo && (!motivo || motivo.trim().length === 0)) {
    return {
      valid: false,
      error: `El motivo es obligatorio para: ${transition.label}`
    };
  }

  return { valid: true, transition };
}

export function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    PROSPECTO_NUEVO: 'Prospecto nuevo',
    PENDIENTE_DATOS: 'Pendiente datos',
    PENDIENTE_DOCUMENTOS: 'Pendiente documentos',
    LISTO_SCORE: 'Listo para score',
    SCORE_APROBADO: 'Score aprobado',
    SIMULACION_ACEPTADA: 'Simulacion aceptada',
    ENVIADO_CONVENIO: 'Enviado a convenio',
    CONVENIO_APROBADO: 'Convenio aprobado',
    PREPARANDO_BCP: 'Preparando BCP',
    ENVIADO_BCP: 'Enviado a BCP',
    APROBADO_BCP: 'Aprobado BCP',
    DESEMBOLSADO: 'Desembolsado',
    OBSERVADO: 'Observado',
    RECHAZADO: 'Rechazado',
    REASIGNADO: 'Reasignado',
    PENDIENTE_REASIGNACION: 'Pendiente reasignacion',
  };
  return labels[estado] || estado;
}

const PROTECTED_FIELDS = ['id', 'asesor_id', 'created_at', 'updated_at', 'password_hash'];

function sanitizeString(value: any): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/<[^>]*>/g, '');
}

function sanitizeOptional(value: any): string | undefined {
  const clean = sanitizeString(value);
  return clean.length > 0 ? clean : undefined;
}

function toNumber(value: any): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 7;
}

export const validateCreateSale = (req: any, res: any, next: any) => {
  const {
    dni_cliente,
    nombres_cliente,
    celular,
    maf_neto,
    monto_solicitado,
    plazo_deseado,
    convenio,
    cargo_laboral,
    consentimiento
  } = req.body;

  const errors: string[] = [];
  const monto = toNumber(monto_solicitado ?? maf_neto);
  const plazo = toNumber(plazo_deseado);
  const celularClean = sanitizeString(celular);

  if (!dni_cliente || !isValidDni(String(dni_cliente))) {
    errors.push('DNI invalido: debe tener exactamente 8 digitos numericos');
  }

  if (!nombres_cliente || sanitizeString(nombres_cliente).length < 3) {
    errors.push('Nombres del cliente requeridos (minimo 3 caracteres)');
  }

  if (!celularClean || !isValidPhone(celularClean)) {
    errors.push('Celular/WhatsApp requerido (minimo 7 digitos)');
  }

  if (!convenio || sanitizeString(convenio).length === 0) {
    errors.push('Convenio es requerido');
  }

  if (!cargo_laboral || sanitizeString(cargo_laboral).length === 0) {
    errors.push('Cargo laboral es requerido');
  }

  if (!monto || monto <= 0) {
    errors.push('Monto solicitado debe ser mayor a 0');
  }

  if (!plazo || plazo <= 0) {
    errors.push('Plazo deseado debe ser mayor a 0');
  }

  if (consentimiento !== true && consentimiento !== 'true' && consentimiento !== 1 && consentimiento !== '1') {
    errors.push('Consentimiento del cliente requerido');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos invalidos', details: errors });
  }

  req.body.dni_cliente = String(dni_cliente).replace(/\D/g, '');
  req.body.nombres_cliente = sanitizeString(nombres_cliente);
  req.body.celular = celularClean;
  req.body.telefono_alt = sanitizeOptional(req.body.telefono_alt);
  req.body.correo = sanitizeOptional(req.body.correo);
  req.body.direccion = sanitizeOptional(req.body.direccion);
  req.body.plaza = sanitizeOptional(req.body.plaza);
  req.body.departamento = sanitizeOptional(req.body.departamento) || 'LIMA';
  req.body.provincia = sanitizeOptional(req.body.provincia);
  req.body.distrito = sanitizeOptional(req.body.distrito);
  req.body.zona_comercial = sanitizeOptional(req.body.zona_comercial);
  req.body.convenio = sanitizeString(convenio);
  req.body.entidad_laboral = sanitizeOptional(req.body.entidad_laboral);
  req.body.cargo_laboral = sanitizeString(cargo_laboral);
  req.body.origen_prospecto = sanitizeOptional(req.body.origen_prospecto);
  req.body.feedback = sanitizeOptional(req.body.feedback);
  req.body.maf_neto = monto;
  req.body.monto_solicitado = monto;
  req.body.plazo_deseado = Math.trunc(plazo);
  req.body.consentimiento = true;
  req.body.consentimiento_at = req.body.consentimiento_at || new Date().toISOString();

  next();
};

export const validateEstadoChange = (req: any, res: any, next: any) => {
  const { nuevo_estado } = req.body;

  if (!nuevo_estado || !VALID_ESTADOS.includes(nuevo_estado as EstadoOperativo)) {
    return res.status(400).json({
      error: `Estado invalido: "${nuevo_estado}"`,
      valid_states: VALID_ESTADOS
    });
  }

  next();
};

export const validateCreateUser = (req: any, res: any, next: any) => {
  const { username, nombre, password, role } = req.body;
  const errors: string[] = [];

  if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    errors.push('Username debe tener 3-30 caracteres alfanumericos (se permite _)');
  }

  if (!nombre || sanitizeString(nombre).length < 2) {
    errors.push('Nombre requerido (minimo 2 caracteres)');
  }

  if (!password || password.length < 8) {
    errors.push('Password debe tener minimo 8 caracteres');
  }

  if (!role || !VALID_ROLES.includes(role)) {
    errors.push(`Rol invalido. Roles validos: ${VALID_ROLES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos invalidos', details: errors });
  }

  req.body.nombre = sanitizeString(nombre);
  next();
};

export const filterProtectedFields = (req: any, _res: any, next: any) => {
  for (const field of PROTECTED_FIELDS) {
    delete req.body[field];
  }
  next();
};
