import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { getSalesFilter } from '../services/hierarchy';
import { logger } from '../services/logger';

const router = Router();

// GET Recent Notifications (based on Audit Logs)
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const filter = await getSalesFilter(req.user);
    
    // Get recent audit logs related to sales the user can see
    const notifications = await prisma.auditLog.findMany({
      where: {
        sale: filter
      },
      include: {
        sale: {
          select: {
            nombres_cliente: true,
            dni_cliente: true
          }
        },
        user: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/notifications/push-token
// Registrar o actualizar el push token del usuario
// ═══════════════════════════════════════════════════
router.post('/push-token', authMiddleware, async (req: any, res: any) => {
  try {
    const { push_token } = req.body;
    if (!push_token || typeof push_token !== 'string') {
      return res.status(400).json({ error: 'push_token es requerido' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { push_token: push_token.trim() }
    });

    logger.info('PUSH', `Push token registrado para usuario ${req.user.username}`);
    res.json({ message: 'Push token registrado exitosamente' });
  } catch (error) {
    logger.error('PUSH', 'Error al registrar push token', { error });
    res.status(500).json({ error: 'Error al registrar push token' });
  }
});

// ═══════════════════════════════════════════════════
// DELETE /api/notifications/push-token
// Eliminar el push token del usuario (logout, desregistro)
// ═══════════════════════════════════════════════════
router.delete('/push-token', authMiddleware, async (req: any, res: any) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { push_token: null }
    });

    logger.info('PUSH', `Push token eliminado para usuario ${req.user.username}`);
    res.json({ message: 'Push token eliminado' });
  } catch (error) {
    logger.error('PUSH', 'Error al eliminar push token', { error });
    res.status(500).json({ error: 'Error al eliminar push token' });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/notifications/push-token/status
// Verificar si el usuario actual tiene push token registrado
// ═══════════════════════════════════════════════════
router.get('/push-token/status', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { push_token: true }
    });

    res.json({
      has_token: !!user?.push_token,
      token_preview: user?.push_token ? `${user.push_token.substring(0, 20)}...` : null
    });
  } catch (error) {
    logger.error('PUSH', 'Error al verificar push token', { error });
    res.status(500).json({ error: 'Error al verificar estado del push token' });
  }
});

// TEST Notification
router.post('/test', authMiddleware, async (req: any, res: any) => {
  try {
    const { sendPushNotification } = require('../services/push');
    await sendPushNotification(
      req.user.id,
      '¡Prueba de Fuvex!',
      'Si estás viendo esto, tus notificaciones están configuradas correctamente. 🚀',
      { type: 'TEST' }
    );
    res.json({ message: 'Notificación de prueba enviada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar prueba' });
  }
});

export default router;
