// Validacion y maquina de estados operativa para Fuvex Manager.

export const VALID_ESTADOS = [
  'PROSPECTO_NUEVO',
  'VERIFICACION_SISTEMA',
  'SCORE_BCP',
  'PENDIENTE_BOLETA',
  'EVALUACION_CALCULADORA',
  'COTIZACION_ENVIADA',
  'PENDIENTE_ACEPTACION_CLIENTE',
  'PENDIENTE_DATOS_FILE',
  'VALIDACION_BACK_OFFICE',
  'OBS_BACK_OFFICE',
  'FILE_VALIDADO',
  'ENVIADO_BCP_REMESA',
  'OBS_BCP',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO',
  'RECHAZADO',
  'DESISTIDO',
  'REASIGNADO',
  'PENDIENTE_REASIGNACION',
] as const;

export type EstadoOperativo = typeof VALID_ESTADOS[number];

export const REJECTION_REASONS = [
  'BURO_NO_CALIFICA',
  'CLIENTE_CON_MALA_DEUDA',
  'CONYUGE_NO_CALIFICA',
  'SCORE_BCP_NO_CALIFICA',
  'CALCULADORA_NO_CALIFICA',
  'CLIENTE_NO_ACEPTA_COTIZACION',
  'DOCUMENTOS_INVALIDOS',
  'BCP_RECHAZA',
  'REMESA_REDUCIDA_NO_ACEPTADA',
  'CLIENTE_DESISTE',
  'OTRO'
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];

export const ACTIVE_ESTADOS: EstadoOperativo[] = [
  'PROSPECTO_NUEVO',
  'VERIFICACION_SISTEMA',
  'SCORE_BCP',
  'PENDIENTE_BOLETA',
  'EVALUACION_CALCULADORA',
  'COTIZACION_ENVIADA',
  'PENDIENTE_ACEPTACION_CLIENTE',
  'PENDIENTE_DATOS_FILE',
  'VALIDACION_BACK_OFFICE',
  'OBS_BACK_OFFICE',
  'FILE_VALIDADO',
  'ENVIADO_BCP_REMESA',
  'OBS_BCP',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_ACEPTACION_REMESA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'PENDIENTE_REASIGNACION',
];

export const DOCUMENT_REQUIRED_STATES: EstadoOperativo[] = [
  'VALIDACION_BACK_OFFICE',
  'FILE_VALIDADO',
  'ENVIADO_BCP_REMESA',
  'REMESA_APROBADA',
  'REMESA_REDUCIDA',
  'PENDIENTE_DESEMBOLSO',
  'PENDIENTE_CARTA_PODER',
  'REENVIADO_BCP_COMPRA_DEUDA',
  'PENDIENTE_CARTA_NO_ADEUDO',
  'PENDIENTE_LIBERACION',
  'DESEMBOLSADO',
];

export const KANBAN_COLUMNS = [
  { key: 'PROSPECTO_NUEVO', label: 'Prospecto', color: '#64748B', seccion: 'venta' },
  { key: 'VERIFICACION_SISTEMA', label: 'Verificacion', color: '#0F766E', seccion: 'venta' },
  { key: 'SCORE_BCP', label: 'Score BCP', color: '#2563EB', seccion: 'venta' },
  { key: 'PENDIENTE_BOLETA', label: 'Pte. Boleta', color: '#D97706', seccion: 'venta' },
  { key: 'EVALUACION_CALCULADORA', label: 'Calculadora', color: '#7C3AED', seccion: 'venta' },
  { key: 'COTIZACION_ENVIADA', label: 'Cotizacion', color: '#0EA5E9', seccion: 'venta' },
  { key: 'PENDIENTE_ACEPTACION_CLIENTE', label: 'Pte. Aceptacion', color: '#0284C7', seccion: 'venta' },
  { key: 'PENDIENTE_DATOS_FILE', label: 'Datos File', color: '#D97706', seccion: 'documentos' },
  { key: 'VALIDACION_BACK_OFFICE', label: 'Val. Back Office', color: '#4F46E5', seccion: 'back_office' },
  { key: 'OBS_BACK_OFFICE', label: 'Obs. Back Office', color: '#EA580C', seccion: 'back_office' },
  { key: 'FILE_VALIDADO', label: 'File Validado', color: '#059669', seccion: 'back_office' },
  { key: 'ENVIADO_BCP_REMESA', label: 'Enviado BCP', color: '#2563EB', seccion: 'bcp' },
  { key: 'OBS_BCP', label: 'Obs. BCP', color: '#DC2626', seccion: 'bcp' },
  { key: 'REMESA_APROBADA', label: 'Remesa OK', color: '#0891B2', seccion: 'cierre' },
  { key: 'REMESA_REDUCIDA', label: 'Remesa Reducida', color: '#F59E0B', seccion: 'cierre' },
  { key: 'PENDIENTE_ACEPTACION_REMESA', label: 'Acepta Remesa', color: '#F97316', seccion: 'cierre' },
  { key: 'PENDIENTE_DESEMBOLSO', label: 'Pte. Desembolso', color: '#0D9488', seccion: 'cierre' },
  { key: 'PENDIENTE_CARTA_PODER', label: 'Carta Poder', color: '#8B5CF6', seccion: 'cierre' },
  { key: 'REENVIADO_BCP_COMPRA_DEUDA', label: 'Reenvio BCP', color: '#6366F1', seccion: 'cierre' },
  { key: 'PENDIENTE_CARTA_NO_ADEUDO', label: 'No Adeudo', color: '#A855F7', seccion: 'cierre' },
  { key: 'PENDIENTE_LIBERACION', label: 'Pte. Liberacion', color: '#9333EA', seccion: 'cierre' },
  { key: 'DESEMBOLSADO', label: 'Desembolsado', color: '#22C55E', seccion: 'final' },
  { key: 'RECHAZADO', label: 'Rechazado', color: '#EF4444', seccion: 'final' },
  { key: 'DESISTIDO', label: 'Desistido', color: '#6B7280', seccion: 'final' },
  { key: 'PENDIENTE_REASIGNACION', label: 'Pte. Reasignacion', color: '#F59E0B', seccion: 'admin' },
] as const;

export const CATALOGO_MOTIVOS = {
  OBS_BACK_OFFICE: [
    'Documentacion incompleta',
    'Documento ilegible o vencido',
    'Datos del cliente no coinciden',
    'Datos laborales incompletos',
    'Otro (especificar)'
  ],
  OBS_BCP: [
    'BCP observo documentos',
    'BCP solicito informacion adicional',
    'Datos de expediente BCP incompletos',
    'Otro (especificar)'
  ],
  RECHAZADO: [
    'BURO_NO_CALIFICA',
    'CLIENTE_CON_MALA_DEUDA',
    'CONYUGE_NO_CALIFICA',
    'SCORE_BCP_NO_CALIFICA',
    'CALCULADORA_NO_CALIFICA',
    'CLIENTE_NO_ACEPTA_COTIZACION',
    'DOCUMENTOS_INVALIDOS',
    'BCP_RECHAZA',
    'REMESA_REDUCIDA_NO_ACEPTADA',
    'CLIENTE_DESISTE',
    'OTRO'
  ],
  DESISTIDO: [
    'Cliente no acepta la propuesta',
    'Cliente no entrega documentos',
    'Cliente cancela el tramite',
    'OTRO'
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
    to: 'VERIFICACION_SISTEMA',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Iniciar verificacion de deudas y condicion del cliente'
  },
  {
    from: 'PROSPECTO_NUEVO',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'No califica en buro o calculadora'
  },
  {
    from: 'VERIFICACION_SISTEMA',
    to: 'SCORE_BCP',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Cliente y conyuge, si aplica, pasan verificacion de sistema'
  },
  {
    from: 'VERIFICACION_SISTEMA',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Cliente o conyuge no califican en verificacion de sistema'
  },
  {
    from: 'SCORE_BCP',
    to: 'PENDIENTE_BOLETA',
    roles: REVISION,
    requiresMotivo: false,
    label: 'Score BCP aprobado; solicitar boleta al cliente'
  },
  {
    from: 'SCORE_BCP',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Score BCP no califica'
  },
  {
    from: 'PENDIENTE_BOLETA',
    to: 'EVALUACION_CALCULADORA',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Boleta recibida; evaluar en calculadora'
  },
  {
    from: 'PENDIENTE_BOLETA',
    to: 'DESISTIDO',
    roles: VENTA,
    requiresMotivo: true,
    label: 'Cliente no entrega boleta o cancela'
  },
  {
    from: 'EVALUACION_CALCULADORA',
    to: 'COTIZACION_ENVIADA',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Calculadora aprobada; preparar cotizacion'
  },
  {
    from: 'EVALUACION_CALCULADORA',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Calculadora no califica'
  },
  {
    from: 'COTIZACION_ENVIADA',
    to: 'PENDIENTE_ACEPTACION_CLIENTE',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Cotizacion entregada; esperar aceptacion del cliente'
  },
  {
    from: 'COTIZACION_ENVIADA',
    to: 'PENDIENTE_DATOS_FILE',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Cliente acepta la cotizacion en el cierre'
  },
  {
    from: 'COTIZACION_ENVIADA',
    to: 'DESISTIDO',
    roles: VENTA,
    requiresMotivo: true,
    label: 'Cliente no acepta la cotizacion'
  },
  {
    from: 'PENDIENTE_ACEPTACION_CLIENTE',
    to: 'PENDIENTE_DATOS_FILE',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Cliente acepta; completar datos y documentos del file'
  },
  {
    from: 'PENDIENTE_ACEPTACION_CLIENTE',
    to: 'DESISTIDO',
    roles: VENTA,
    requiresMotivo: true,
    label: 'Cliente no continua despues de cotizacion'
  },
  {
    from: 'PENDIENTE_DATOS_FILE',
    to: 'VALIDACION_BACK_OFFICE',
    roles: TODOS,
    requiresMotivo: false,
    label: 'File cargado para validacion back office'
  },
  {
    from: 'PENDIENTE_DATOS_FILE',
    to: 'DESISTIDO',
    roles: VENTA,
    requiresMotivo: true,
    label: 'Cliente no entrega documentos o cancela'
  },
  {
    from: 'VALIDACION_BACK_OFFICE',
    to: 'OBS_BACK_OFFICE',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Back office observa documentos o datos'
  },
  {
    from: 'VALIDACION_BACK_OFFICE',
    to: 'FILE_VALIDADO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Back office valida el file'
  },
  {
    from: 'VALIDACION_BACK_OFFICE',
    to: 'RECHAZADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'Documentos o condiciones invalidas'
  },
  {
    from: 'OBS_BACK_OFFICE',
    to: 'PENDIENTE_DATOS_FILE',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Vendedor subsana observacion documental'
  },
  {
    from: 'OBS_BACK_OFFICE',
    to: 'VALIDACION_BACK_OFFICE',
    roles: TODOS,
    requiresMotivo: false,
    label: 'Observacion subsanada para nueva revision'
  },
  {
    from: 'OBS_BACK_OFFICE',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Observacion no subsanable'
  },
  {
    from: 'FILE_VALIDADO',
    to: 'ENVIADO_BCP_REMESA',
    roles: BACK,
    requiresMotivo: false,
    label: 'Enviar file al BCP para aprobacion de remesa'
  },
  {
    from: 'ENVIADO_BCP_REMESA',
    to: 'OBS_BCP',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP observo el expediente'
  },
  {
    from: 'ENVIADO_BCP_REMESA',
    to: 'REMESA_APROBADA',
    roles: BACK,
    requiresMotivo: false,
    label: 'BCP aprobo remesa'
  },
  {
    from: 'ENVIADO_BCP_REMESA',
    to: 'REMESA_REDUCIDA',
    roles: BACK,
    requiresMotivo: false,
    label: 'BCP aprobo remesa por menor monto'
  },
  {
    from: 'ENVIADO_BCP_REMESA',
    to: 'RECHAZADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP rechazo la operacion'
  },
  {
    from: 'OBS_BCP',
    to: 'ENVIADO_BCP_REMESA',
    roles: BACK,
    requiresMotivo: false,
    label: 'Subsanacion BCP lista para nueva evaluacion'
  },
  {
    from: 'OBS_BCP',
    to: 'RECHAZADO',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP rechaza despues de observacion'
  },
  {
    from: 'REMESA_APROBADA',
    to: 'PENDIENTE_DESEMBOLSO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Remesa aprobada; esperar confirmacion de desembolso'
  },
  {
    from: 'REMESA_APROBADA',
    to: 'PENDIENTE_CARTA_PODER',
    roles: BACK,
    requiresMotivo: false,
    label: 'Operacion de compra de deuda requiere carta poder'
  },
  {
    from: 'REMESA_REDUCIDA',
    to: 'PENDIENTE_ACEPTACION_REMESA',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Consultar si cliente acepta la remesa reducida'
  },
  {
    from: 'REMESA_REDUCIDA',
    to: 'RECHAZADO',
    roles: REVISION,
    requiresMotivo: true,
    label: 'Cliente no acepta la remesa reducida'
  },
  {
    from: 'PENDIENTE_ACEPTACION_REMESA',
    to: 'PENDIENTE_DESEMBOLSO',
    roles: VENTA,
    requiresMotivo: false,
    label: 'Cliente acepta remesa reducida; esperar desembolso'
  },
  {
    from: 'PENDIENTE_ACEPTACION_REMESA',
    to: 'DESISTIDO',
    roles: VENTA,
    requiresMotivo: true,
    label: 'Cliente desiste por remesa reducida'
  },
  {
    from: 'PENDIENTE_DESEMBOLSO',
    to: 'DESEMBOLSADO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Registrar desembolso libre disponibilidad'
  },
  {
    from: 'PENDIENTE_DESEMBOLSO',
    to: 'PENDIENTE_CARTA_PODER',
    roles: BACK,
    requiresMotivo: false,
    label: 'Desembolso con compra de deuda; esperar carta poder'
  },
  {
    from: 'PENDIENTE_CARTA_PODER',
    to: 'REENVIADO_BCP_COMPRA_DEUDA',
    roles: BACK,
    requiresMotivo: false,
    label: 'Carta poder recibida; reenviar file de compra de deuda al BCP'
  },
  {
    from: 'REENVIADO_BCP_COMPRA_DEUDA',
    to: 'PENDIENTE_CARTA_NO_ADEUDO',
    roles: BACK,
    requiresMotivo: false,
    label: 'BCP procesa compra de deuda; esperar carta de no adeudo'
  },
  {
    from: 'REENVIADO_BCP_COMPRA_DEUDA',
    to: 'OBS_BCP',
    roles: BACK,
    requiresMotivo: true,
    label: 'BCP observa la compra de deuda'
  },
  {
    from: 'PENDIENTE_CARTA_NO_ADEUDO',
    to: 'PENDIENTE_LIBERACION',
    roles: BACK,
    requiresMotivo: false,
    label: 'Carta de no adeudo validada; liberar monto'
  },
  {
    from: 'PENDIENTE_LIBERACION',
    to: 'DESEMBOLSADO',
    roles: BACK,
    requiresMotivo: false,
    label: 'Registrar desembolso luego de liberacion'
  },
  {
    from: 'DESISTIDO',
    to: 'PROSPECTO_NUEVO',
    roles: ['SUPERADMIN', 'GERENTE'],
    requiresMotivo: true,
    label: 'Reabrir expediente desistido'
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
    VERIFICACION_SISTEMA: 'Verificacion sistema',
    SCORE_BCP: 'Score BCP',
    PENDIENTE_BOLETA: 'Pendiente boleta',
    EVALUACION_CALCULADORA: 'Evaluacion calculadora',
    COTIZACION_ENVIADA: 'Cotizacion enviada',
    PENDIENTE_ACEPTACION_CLIENTE: 'Pendiente aceptacion cliente',
    PENDIENTE_DATOS_FILE: 'Pendiente datos file',
    VALIDACION_BACK_OFFICE: 'Validacion back office',
    OBS_BACK_OFFICE: 'Observado back office',
    FILE_VALIDADO: 'File validado',
    ENVIADO_BCP_REMESA: 'Enviado BCP remesa',
    OBS_BCP: 'Observado BCP',
    REMESA_APROBADA: 'Remesa aprobada',
    REMESA_REDUCIDA: 'Remesa reducida',
    PENDIENTE_ACEPTACION_REMESA: 'Pendiente aceptacion remesa',
    PENDIENTE_DESEMBOLSO: 'Pendiente desembolso',
    PENDIENTE_CARTA_PODER: 'Pendiente carta poder',
    REENVIADO_BCP_COMPRA_DEUDA: 'Reenviado BCP compra deuda',
    PENDIENTE_CARTA_NO_ADEUDO: 'Pendiente carta no adeudo',
    PENDIENTE_LIBERACION: 'Pendiente liberacion',
    DESEMBOLSADO: 'Desembolsado',
    RECHAZADO: 'Rechazado',
    DESISTIDO: 'Desistido',
    REASIGNADO: 'Reasignado',
    PENDIENTE_REASIGNACION: 'Pendiente reasignacion',
  };
  return labels[estado] || estado;
}

const PROTECTED_FIELDS = ['id', 'asesor_id', 'created_at', 'updated_at', 'password_hash', 'version'];

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
    consentimiento,
    estado_civil_cliente,
    conyuge_dni,
    conyuge_nombres
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

  const estadoCivilClean = sanitizeOptional(estado_civil_cliente);
  const conyugeDniClean = conyuge_dni ? String(conyuge_dni).replace(/\D/g, '') : '';
  const conyugeNombresClean = sanitizeOptional(conyuge_nombres);

  if (estadoCivilClean && /CASAD/i.test(estadoCivilClean)) {
    if (!conyugeDniClean || !isValidDni(conyugeDniClean)) {
      errors.push('El DNI del conyuge es requerido y debe tener exactamente 8 digitos para estado civil Casado');
    }
    if (!conyugeNombresClean || conyugeNombresClean.length < 3) {
      errors.push('El nombre del conyuge es requerido (minimo 3 caracteres) para estado civil Casado');
    }
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
  req.body.estado_civil_cliente = estadoCivilClean;
  req.body.conyuge_dni = conyugeDniClean || null;
  req.body.conyuge_nombres = conyugeNombresClean || null;
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
