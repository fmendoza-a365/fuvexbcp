// ══════════════════════════════════════════════════
// Logger Estructurado — Fuvex Manager
// Sin dependencias externas, formato consistente
// ══════════════════════════════════════════════════

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatMessage(level: LogLevel, module: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${module}] ${message}`;
  if (meta) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export const logger = {
  info(module: string, message: string, meta?: any) {
    console.log(formatMessage('INFO', module, message, meta));
  },

  warn(module: string, message: string, meta?: any) {
    console.warn(formatMessage('WARN', module, message, meta));
  },

  error(module: string, message: string, meta?: any) {
    console.error(formatMessage('ERROR', module, message, meta));
  },

  debug(module: string, message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', module, message, meta));
    }
  },

  // Log de request HTTP (para middleware)
  request(req: any) {
    const { method, url, ip } = req;
    console.log(formatMessage('INFO', 'HTTP', `${method} ${url}`, { ip }));
  }
};
