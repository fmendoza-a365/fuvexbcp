import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import salesRouter from './routes/sales';
import usersRouter from './routes/users';
import zonesRouter from './routes/zones';
import exportRouter from './routes/export';
import rccRouter from './routes/rcc';
import analyticsRouter from './routes/analytics';
import goalsRouter from './routes/goals';
import notificationsRouter from './routes/notifications';
import simulatorRouter from './routes/simulator';
import dniRouter from './routes/dni';
import path from 'path';
import { consultarRCC } from './services/infoburo';
import { authMiddleware } from './middleware/auth';
import { logger } from './services/logger';
import { globalErrorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Configuración de Seguridad
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET no está configurado en las variables de entorno.');
  process.exit(1);
}

// --- CORS RESTRICTIVO ---
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:5173',
  'https://yodel-thumb-veggie.ngrok-free.dev'
];
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permitir requests sin origin (mobile apps, curl, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] CORS bloqueado para origen: ${origin}`);
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// --- BLINDAJE DE SEGURIDAD ---
// 1. Helmet: Protege contra ataques web comunes configurando cabeceras seguras
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado para permitir carga de assets locales
  crossOriginEmbedderPolicy: false
}));

// 2. Rate Limiting: Doble capa de protección
// 2a. Limiter ESTRICTO para login (previene fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// 2b. Limiter GENERAL para API (previene abuso)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones desde esta IP. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);

// 3. Health Check (monitoreo)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});


// Log all requests
app.use((req, res, next) => {
  logger.request(req);
  next();
});

// Basic Login Route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { username },
      include: { zone: true }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username, zone_id: user.zone_id }, JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, role: user.role, zone: user.zone } });
  } catch (error) {
    logger.error('AUTH', 'Error en login', { error });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.use('/api/sales', salesRouter);
app.use('/api/users', usersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/export', exportRouter);
app.use('/api/sales', rccRouter); // RCC routes are under /api/sales/:id/rcc
app.use('/api/analytics', analyticsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/dni', dniRouter);

// ── Consulta Infoburo (RCC) ───────────────────────────
app.get('/api/infoburo/:dni', authMiddleware, async (req: any, res: any) => {
  try {
    const { dni } = req.params;

    if (!dni || dni.length !== 8 || !/^\d{8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI inválido. Debe ser un número de 8 dígitos.' });
    }

    logger.info('INFOBURO', `Consulta solicitada por ${req.user.username} → DNI: ${dni}`);
    const resultado = await consultarRCC(dni);
    res.json(resultado);
  } catch (error: any) {
    logger.error('INFOBURO', `Error consultando DNI ${req.params.dni}`, { message: error.message });
    res.status(500).json({ error: error.message || 'Error al consultar Infoburo' });
  }
});

// Expose static files para documentos con caché de 7 días
app.use('/files', express.static(path.join(__dirname, '../../../storage/expedientes'), {
  maxAge: '7d',
  immutable: true
}));
 
 // Ruta para descargas públicas (APK, manuales, etc.)
 app.use('/download', express.static(path.resolve(process.cwd(), '../../storage/public')));


app.get('/api/users/me', authMiddleware, async (req: any, res: any) => {
  res.json({ user: req.user });
});

// === DEPLOYMENT LOCAL: Servir la Web App desde Node.js ===
const webDistPath = path.resolve(__dirname, '../../web/dist');
logger.info('SERVER', `Serving web dist from: ${webDistPath}`);
logger.info('SERVER', `Path exists: ${require('fs').existsSync(webDistPath)}`);
app.use(express.static(webDistPath));

// Catch-all route for SPA - MUST BE LAST
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(webDistPath, 'index.html'));
});

// Error Handler Global (DEBE ser el último middleware)
app.use(globalErrorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('SERVER', `🚀 Servidor Fuvex Manager corriendo en http://localhost:${PORT}`);
});
