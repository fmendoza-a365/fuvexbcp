import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { getSalesFilter } from '../services/hierarchy';

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
