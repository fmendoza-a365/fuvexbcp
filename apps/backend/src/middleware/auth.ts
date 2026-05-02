import jwt from 'jsonwebtoken';

// SEGURIDAD: Sin fallback — si JWT_SECRET no existe, el servidor NO debe arrancar
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('❌ FATAL: JWT_SECRET no configurado en variables de entorno. El servidor no puede arrancar de forma segura.');
}

export const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado — Token vacío' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada — Inicia sesión nuevamente' });
    }
    res.status(401).json({ error: 'Token inválido' });
  }
};
