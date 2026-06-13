import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { SbiApiService, getDropletPublicIp } from '../services/sbi';

const router = Router();
const prisma = new PrismaClient();

// Helper middleware for role protection (Disabled to allow all authenticated users)
const requireSbiAdmin = (req: any, res: any, next: any) => {
  return next();
};

const requireSbiQuery = (req: any, res: any, next: any) => {
  return next();
};

// GET /api/sbi/config
router.get('/config', authMiddleware, requireSbiAdmin, async (req, res, next) => {
  try {
    const publicIp = await getDropletPublicIp();
    res.json({
      base_url: process.env.SBI_API_BASE_URL || 'https://api-sbi.work',
      legacy_url: process.env.SBI_API_LEGACY_URL || 'https://api-sbi.com.mx',
      app_url: process.env.SBI_API_APP_URL || 'https://sbi-app.com',
      allowed_ip: process.env.SBI_API_ALLOWED_IP || '34.133.21.245',
      usuario: process.env.SBI_API_USER || '',
      has_key: !!process.env.SBI_API_KEY,
      timeout_seconds: parseInt(process.env.SBI_TIMEOUT_SECONDS || '30', 10),
      verify_ssl: process.env.SBI_VERIFY_SSL !== 'false',
      auth_mode: process.env.SBI_AUTH_MODE || 'header_bearer',
      server_public_ip: publicIp
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sbi/test-connection
router.post('/test-connection', authMiddleware, requireSbiAdmin, async (req: any, res, next) => {
  try {
    const response = await SbiApiService.testConnection(req.user.id);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/sbi/query
router.post('/query', authMiddleware, requireSbiQuery, async (req: any, res, next) => {
  try {
    const { documento, meses, planilla } = req.body;

    if (!documento || !/^\d+$/.test(documento)) {
      return res.status(400).json({ error: 'El DNI o documento es obligatorio y debe contener solo dígitos.' });
    }

    const mesesNum = parseInt(meses, 10);
    if (isNaN(mesesNum) || mesesNum < 1 || mesesNum > 12) {
      return res.status(400).json({ error: 'El número de meses SBS es obligatorio y debe estar entre 1 y 12.' });
    }

    const planillaNum = planilla !== undefined ? parseInt(planilla, 10) : undefined;
    if (planillaNum !== undefined && (isNaN(planillaNum) || planillaNum < 1 || planillaNum > 12)) {
      return res.status(400).json({ error: 'El número de meses de planilla debe estar entre 1 y 12.' });
    }

    const response = await SbiApiService.queryDatos(req.user.id, documento, mesesNum, planillaNum);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/sbi/history
router.get('/history', authMiddleware, requireSbiAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.sbiApiRequest.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, nombre: true, role: true }
          }
        }
      }),
      prisma.sbiApiRequest.count()
    ]);

    res.json({
      data: requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sbi/history/:id
router.get('/history/:id', authMiddleware, requireSbiAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestLog = await prisma.sbiApiRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, nombre: true, role: true }
        },
        results: true
      }
    });

    if (!requestLog) {
      return res.status(404).json({ error: 'Registro de consulta no encontrado' });
    }

    res.json(requestLog);
  } catch (error) {
    next(error);
  }
});

// GET /api/sbi/stats
router.get('/stats', authMiddleware, requireSbiAdmin, async (req, res, next) => {
  try {
    const totalCount = await prisma.sbiApiRequest.count();
    const successCount = await prisma.sbiApiRequest.count({ where: { success: true } });
    const failCount = await prisma.sbiApiRequest.count({ where: { success: false } });
    
    const durationAggregate = await prisma.sbiApiRequest.aggregate({
      _avg: { duration_ms: true }
    });

    const lastRequest = await prisma.sbiApiRequest.findFirst({
      orderBy: { created_at: 'desc' }
    });

    const publicIp = await getDropletPublicIp();

    res.json({
      total: totalCount,
      success: successCount,
      failed: failCount,
      avg_duration_ms: Math.round(durationAggregate._avg.duration_ms || 0),
      last_request: lastRequest ? {
        status_code: lastRequest.status_code,
        success: lastRequest.success,
        error_id: lastRequest.error_id,
        error_message: lastRequest.error_message,
        executed_at: lastRequest.executed_at
      } : null,
      server_public_ip: publicIp
    });
  } catch (error) {
    next(error);
  }
});

export default router;
