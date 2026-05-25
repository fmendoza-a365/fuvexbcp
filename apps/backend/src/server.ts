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
import crypto from 'crypto';

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
import mailRouter from './routes/mail';
import pdfTemplatesRouter from './routes/pdfTemplates';
import { consultarRCC } from './services/infoburo';
import { authMiddleware } from './middleware/auth';
import { logger } from './services/logger';
import { globalErrorHandler } from './middleware/errorHandler';
import { firstExistingPath, publicDownloadsPath } from './services/storage';
import { validateEnvironment } from './config/env';

dotenv.config();
validateEnvironment();

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.set('trust proxy', 1);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no esta configurado en las variables de entorno.');
  process.exit(1);
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isPrivateNetworkHost = (hostname: string) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
);

const isNgrokHost = (hostname: string) => (
  hostname.endsWith('.ngrok-free.app') ||
  hostname.endsWith('.ngrok-free.dev') ||
  hostname.endsWith('.ngrok.app') ||
  hostname.endsWith('.ngrok.io')
);

const isAllowedOrigin = (origin: string | undefined, requestHost: string | undefined) => {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const hostWithoutPort = String(requestHost || '').split(':')[0];

    if (originUrl.host === requestHost || originUrl.hostname === hostWithoutPort) {
      return true;
    }

    if (process.env.NODE_ENV !== 'production' && (isPrivateNetworkHost(originUrl.hostname) || isNgrokHost(originUrl.hostname))) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

app.use(cors((req: express.Request, callback: any) => {
  const origin = req.header('Origin');
  if (isAllowedOrigin(origin, req.header('Host'))) {
    callback(null, { origin: origin ? true : false, credentials: true });
    return;
  }

  console.warn(`[SECURITY] CORS bloqueado para origen: ${origin}`);
  callback(new Error('Origen no permitido por CORS'), { origin: false });
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use((req: any, res, next) => {
  req.requestId = req.header('X-Request-Id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});


const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const SUPERADMIN_LOGIN_LOCK_MS = 5 * 60 * 1000;
const STANDARD_LOGIN_LOCK_MS = 10 * 60 * 1000;

type LoginAttemptRecord = {
  failures: number;
  firstFailureAt: number;
  lastFailureAt: number;
  lockedUntil: number;
};

const loginAttempts = new Map<string, LoginAttemptRecord>();

function normalizeLoginUsername(username: unknown) {
  return String(username || '').trim().toLowerCase();
}

function getLoginClientIp(req: express.Request) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

function getLoginAttemptKey(username: string, ip: string) {
  return `${username || 'unknown'}:${ip}`;
}

function getLoginLockMs(role?: string | null) {
  return role === 'SUPERADMIN' ? SUPERADMIN_LOGIN_LOCK_MS : STANDARD_LOGIN_LOCK_MS;
}

function getActiveLoginAttempt(key: string) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return null;

  const windowExpired = now - record.firstFailureAt > LOGIN_FAILURE_WINDOW_MS;
  const lockExpired = record.lockedUntil > 0 && now >= record.lockedUntil;
  if ((windowExpired && record.lockedUntil === 0) || lockExpired) {
    loginAttempts.delete(key);
    return null;
  }

  return record;
}

function getRetryAfterSeconds(record: LoginAttemptRecord) {
  return Math.max(1, Math.ceil((record.lockedUntil - Date.now()) / 1000));
}

function registerLoginFailure(req: express.Request, username: string, role?: string | null, reason = 'invalid_credentials') {
  const now = Date.now();
  const ip = getLoginClientIp(req);
  const key = getLoginAttemptKey(username, ip);
  const existing = getActiveLoginAttempt(key);
  const record: LoginAttemptRecord = existing || {
    failures: 0,
    firstFailureAt: now,
    lastFailureAt: now,
    lockedUntil: 0
  };

  record.failures += 1;
  record.lastFailureAt = now;

  if (record.failures >= LOGIN_MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + getLoginLockMs(role);
  }

  loginAttempts.set(key, record);

  logger.warn('AUTH', 'Intento de login fallido', {
    username,
    role: role || 'UNKNOWN',
    ip,
    reason,
    failures: record.failures,
    locked_until: record.lockedUntil ? new Date(record.lockedUntil).toISOString() : null,
    user_agent: req.header('User-Agent') || null
  });

  return record;
}

function clearLoginFailures(req: express.Request, username: string) {
  loginAttempts.delete(getLoginAttemptKey(username, getLoginClientIp(req)));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: { error: 'Demasiadas peticiones desde esta IP. Intenta de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('HEALTH', 'Readiness check fallo', { error });
    res.status(503).json({
      status: 'not_ready',
      database: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

app.use((req, _res, next) => {
  logger.request(req);
  next();
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const loginUsername = String(username || '').trim();
    const normalizedUsername = normalizeLoginUsername(loginUsername);

    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'Usuario y contrasena son obligatorios' });
    }

    const user = await prisma.user.findUnique({
      where: { username: loginUsername },
      include: { zone: true }
    });

    const attemptKey = getLoginAttemptKey(normalizedUsername, getLoginClientIp(req));
    const activeAttempt = getActiveLoginAttempt(attemptKey);
    if (activeAttempt?.lockedUntil && activeAttempt.lockedUntil > Date.now()) {
      const retryAfterSeconds = getRetryAfterSeconds(activeAttempt);
      return res.status(429).json({
        error: `Demasiados intentos de login. Intenta de nuevo en ${Math.ceil(retryAfterSeconds / 60)} minutos.`,
        retry_after_seconds: retryAfterSeconds
      });
    }

    if (!user || !user.activo) {
      const failedAttempt = registerLoginFailure(req, normalizedUsername, user?.role, user ? 'inactive_user' : 'unknown_user');
      if (failedAttempt.lockedUntil) {
        const retryAfterSeconds = getRetryAfterSeconds(failedAttempt);
        return res.status(429).json({
          error: `Demasiados intentos de login. Intenta de nuevo en ${Math.ceil(retryAfterSeconds / 60)} minutos.`,
          retry_after_seconds: retryAfterSeconds
        });
      }
      return res.status(401).json({ error: 'Credenciales invalidas o usuario inactivo' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const failedAttempt = registerLoginFailure(req, normalizedUsername, user.role);
      if (failedAttempt.lockedUntil) {
        const retryAfterSeconds = getRetryAfterSeconds(failedAttempt);
        return res.status(429).json({
          error: `Demasiados intentos de login. Intenta de nuevo en ${Math.ceil(retryAfterSeconds / 60)} minutos.`,
          retry_after_seconds: retryAfterSeconds
        });
      }
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    clearLoginFailures(req, normalizedUsername);

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
app.use('/api/mail', mailRouter);
app.use('/api/pdf-templates', pdfTemplatesRouter);

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

const publicQuoteImagesPath = path.join(publicDownloadsPath, 'cotizaciones');
fs.mkdirSync(publicQuoteImagesPath, { recursive: true });
app.use('/public/cotizaciones', express.static(publicQuoteImagesPath, {
  maxAge: '7d',
  immutable: true
}));
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
