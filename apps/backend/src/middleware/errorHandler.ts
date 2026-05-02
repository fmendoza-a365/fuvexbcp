// ══════════════════════════════════════════════════
// Error Handler Global — Fuvex Manager
// Captura errores no manejados y retorna respuestas uniformes
// ══════════════════════════════════════════════════

import { logger } from '../services/logger';

/**
 * Middleware de error global.
 * DEBE registrarse DESPUÉS de todas las rutas.
 * Express identifica los error handlers por tener 4 parámetros (err, req, res, next).
 */
export const globalErrorHandler = (err: any, req: any, res: any, next: any) => {
  // Error de Multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Archivo demasiado grande',
      details: 'El tamaño máximo permitido es 10MB'
    });
  }

  if (err.message?.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      error: 'Tipo de archivo no permitido',
      details: err.message
    });
  }

  // Error de CORS
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: 'Origen no permitido por CORS' });
  }

  // Error genérico
  logger.error('GLOBAL', `Error no manejado en ${req.method} ${req.url}`, {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message || 'Error interno del servidor'
  });
};
