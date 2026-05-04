import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

import salesRouter from './routes/sales';
import usersRouter from './routes/users';
import zonesRouter from './routes/zones';
import exportRouter from './routes/export';
import rccRouter from './routes/rcc';
import analyticsRouter from './routes/analytics';
import goalsRouter from './routes/goals';
import notificationsRouter from './routes/notifications';
import simulatorRouter from './routes/simulator';
import geoRouter from './routes/geo';
import dniRouter from './routes/dni';
import checklistRouter from './routes/checklist';
import digitalizacionRouter from './routes/digitalizacion';
import { consultarRCC } from './services/infoburo';
import { authMiddleware } from './middleware/auth';
import { logger } from './services/logger';
import { globalErrorHandler } from './middleware/errorHandler';
import { firstExistingPath, publicDownloadsPath } from './services/storage';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '3001', 10);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no esta configurado en las variables de entorno.');
  process.exit(1);
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[SECURITY] CORS bloqueado para origen: ${origin}`);
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones desde esta IP. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use((req, _res, next) => {
  logger.request(req);
  next();
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { username },
      include: { zone: true }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales invalidas o usuario inactivo' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username, zone_id: user.zone_id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, nombre: user.nombre, role: user.role, zone: user.zone }
    });
  } catch (error) {
    logger.error('AUTH', 'Error en login', { error });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.use('/api/sales', salesRouter);
app.use('/api/users', usersRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/export', exportRouter);
app.use('/api/sales', rccRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/geo', geoRouter);
app.use('/api/dni', dniRouter);
app.use('/api/sales', checklistRouter);
app.use('/api/sales', digitalizacionRouter);

app.get('/api/infoburo/:dni', authMiddleware, async (req: any, res: any) => {
  try {
    const { dni } = req.params;

    if (!dni || dni.length !== 8 || !/^\d{8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI invalido. Debe ser un numero de 8 digitos.' });
    }

    logger.info('INFOBURO', `Consulta solicitada por ${req.user.username} -> DNI: ${dni}`);
    const resultado = await consultarRCC(dni);
    res.json(resultado);
  } catch (error: any) {
    logger.error('INFOBURO', `Error consultando DNI ${req.params.dni}`, { message: error.message });
    res.status(500).json({ error: error.message || 'Error al consultar Infoburo' });
  }
});

app.use('/download', authMiddleware, express.static(publicDownloadsPath));

app.get('/api/users/me', authMiddleware, async (req: any, res: any) => {
  res.json({ user: req.user });
});

const webDistPath = firstExistingPath([
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(__dirname, '../../../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
  path.resolve(process.cwd(), '../web/dist')
]);
logger.info('SERVER', `Serving web dist from: ${webDistPath}`);
logger.info('SERVER', `Path exists: ${fs.existsSync(webDistPath)}`);
app.use(express.static(webDistPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(webDistPath, 'index.html'));
});

app.use(globalErrorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logger.info('SERVER', `Servidor Fuvex Manager corriendo en http://localhost:${PORT}`);
});
