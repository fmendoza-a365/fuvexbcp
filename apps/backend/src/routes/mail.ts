/**
 * ═══════════════════════════════════════════════════
 * Mail Routes — Fuvex Manager
 * Endpoints for sending emails and checking mail config
 * ═══════════════════════════════════════════════════
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { prisma } from '../db';
import { canAccessSale } from '../services/hierarchy';
import { sendExpedienteEmail, getMailConfigStatus } from '../services/mailService';

const router = Router();

// GET /api/mail/config — Check mail configuration status
router.get('/config', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'BACK_OFFICE', 'GERENTE', 'SUPERADMIN'), async (_req: any, res: any) => {
  try {
    const status = await getMailConfigStatus();
    res.json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar configuración de correo' });
  }
});

// POST /api/mail/send/:saleId — Send expedition email
router.post('/send/:saleId', authMiddleware, authorize('SUPERVISOR', 'JEFE_ZONAL', 'BACK_OFFICE', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { saleId } = req.params;
    const { destinatario, asunto, cuerpo } = req.body;

    if (!destinatario || typeof destinatario !== 'string' || !destinatario.includes('@')) {
      return res.status(400).json({ error: 'Debe proporcionar un correo destinatario válido.' });
    }

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    if (!(await canAccessSale(req.user, sale))) {
      return res.status(403).json({ error: 'Sin permisos para este expediente.' });
    }

    const result = await sendExpedienteEmail(saleId, destinatario.trim(), req.user.id, {
      asunto,
      cuerpo
    });

    res.json({
      message: 'Correo enviado exitosamente',
      messageId: result.messageId,
      previewUrl: result.previewUrl || null
    });
  } catch (error: any) {
    console.error('Error sending mail:', error);
    res.status(500).json({ error: error.message || 'Error al enviar correo' });
  }
});

export default router;
