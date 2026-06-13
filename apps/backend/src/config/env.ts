type EnvIssue = {
  key: string;
  message: string;
};

const PLACEHOLDER_PATTERNS = [
  /^replace/i,
  /replace_me/i,
  /change.?me/i,
  /tu[-_ ]?dominio/i,
  /tu[-_ ]?secreto/i,
  /password/i
];

const isProduction = () => process.env.NODE_ENV === 'production';

const hasPlaceholder = (value: string) => (
  PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
);

const isLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.startsWith('192.168.') ||
      url.hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
  } catch {
    return true;
  }
};

const requireValue = (issues: EnvIssue[], key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    issues.push({ key, message: 'Variable requerida no configurada.' });
    return '';
  }
  if (hasPlaceholder(value)) {
    issues.push({ key, message: 'La variable parece contener un valor placeholder.' });
  }
  return value;
};

const requireStrongSecret = (issues: EnvIssue[], key: string, minLength = 16) => {
  const value = requireValue(issues, key);
  if (value && value.length < minLength) {
    issues.push({ key, message: `Debe tener al menos ${minLength} caracteres.` });
  }
  return value;
};

export const validateEnvironment = () => {
  const issues: EnvIssue[] = [];

  const jwtSecret = requireValue(issues, 'JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 64) {
    issues.push({ key: 'JWT_SECRET', message: 'Debe tener al menos 64 caracteres aleatorios.' });
  }

  if (isProduction()) {
    const databaseUrl = requireValue(issues, 'DATABASE_URL');
    if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
      issues.push({ key: 'DATABASE_URL', message: 'Produccion debe usar PostgreSQL, no SQLite.' });
    }

    const corsOrigins = requireValue(issues, 'CORS_ORIGINS');
    if (corsOrigins) {
      const origins = corsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);
      if (origins.length === 0 || origins.includes('*')) {
        issues.push({ key: 'CORS_ORIGINS', message: 'Define dominios exactos; no uses *.' });
      }
      if (origins.some(isLocalOrigin)) {
        issues.push({ key: 'CORS_ORIGINS', message: 'Produccion no debe permitir localhost ni redes privadas.' });
      }
    }

    requireValue(issues, 'INFOBURO_USER');
    requireValue(issues, 'INFOBURO_PASS');
    requireStrongSecret(issues, 'SEED_ADMIN_PASSWORD', 12);

    requireValue(issues, 'SBI_API_USER');
    requireValue(issues, 'SBI_API_KEY');

    const storageProvider = process.env.STORAGE_PROVIDER?.trim() || 'local';
    if (!['local', 's3'].includes(storageProvider)) {
      issues.push({ key: 'STORAGE_PROVIDER', message: 'Valores permitidos: local, s3.' });
    }
    if (storageProvider === 's3') {
      requireValue(issues, 'S3_ENDPOINT');
      requireValue(issues, 'S3_REGION');
      requireValue(issues, 'S3_BUCKET');
      requireValue(issues, 'S3_ACCESS_KEY_ID');
      requireStrongSecret(issues, 'S3_SECRET_ACCESS_KEY', 16);
      const forcePathStyle = process.env.S3_FORCE_PATH_STYLE?.trim();
      if (forcePathStyle && !['true', 'false'].includes(forcePathStyle)) {
        issues.push({ key: 'S3_FORCE_PATH_STYLE', message: 'Valores permitidos: true, false.' });
      }
    }
  }

  if (issues.length > 0) {
    const details = issues.map((issue) => `- ${issue.key}: ${issue.message}`).join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${details}`);
  }
};
