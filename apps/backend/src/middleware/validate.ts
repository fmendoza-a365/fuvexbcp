// ══════════════════════════════════════════════════
// Middleware de Validación — Fuvex Manager
// Validadores puros sin dependencias externas
// ══════════════════════════════════════════════════

// Estados válidos del sistema
export const VALID_ESTADOS = [
  'POR INGRESAR',
  'EN PROCESO',
  'APROBADA',
  'OBSERVADA',
  'SUBSANADA',
  'DESEMBOLSADO',
  'RECHAZADO',
  'REASIGNADO',
  'PENDIENTE_REASIGNACION'
] as const;

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
