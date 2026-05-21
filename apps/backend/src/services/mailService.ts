/**
 * ═══════════════════════════════════════════════════
 * Mail Service — Fuvex Manager
 * Handles sending expedition emails to BCP with attachments
 * and provides a test account (Ethereal) when no provider is configured.
 * ═══════════════════════════════════════════════════
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '../db';
import { logger } from './logger';
import { resolveExpedienteDocumentPath } from './storage';
import path from 'path';

let cachedTransporter: Transporter | null = null;

/**
 * Get or create the nodemailer transporter.
 * Uses environment variables if configured, otherwise creates
 * an Ethereal test account automatically.
 */
async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: { user, pass }
    });
    logger.info('MAIL', `Transporter configurado con ${host}:${port || 587}`);
  } else {
    // Crear cuenta de prueba Ethereal automáticamente
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    logger.info('MAIL', `Ethereal test account: ${testAccount.user}`);
    logger.info('MAIL', `Ethereal web: https://ethereal.email/login (user: ${testAccount.user}, pass: ${testAccount.pass})`);
  }

  return cachedTransporter;
}

/**
 * Build a unique subject tag for tracking responses.
 */
function buildSubjectTag(saleId: string): string {
  return `[FUVEX-${saleId.substring(0, 8).toUpperCase()}]`;
}

/**
 * Send an expedition email with all attachments for a given sale.
 */
export async function sendExpedienteEmail(
  saleId: string,
  recipientEmail: string,
  userId: string,
  options?: {
    asunto?: string;
    cuerpo?: string;
  }
): Promise<{ messageId: string; previewUrl?: string }> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      documents: {
        where: { tipo_documento: { not: 'DESTITUIDO' } },
        orderBy: { created_at: 'asc' }
      },
      asesor: { select: { nombre: true, username: true, email: true } }
    }
  });

  if (!sale) {
    throw new Error(`Sale ${saleId} no encontrada`);
  }

  const tag = buildSubjectTag(saleId);
  const asesorName = sale.asesor?.nombre || sale.asesor?.username || 'Asesor';
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'expedientes@fuvexa365.com';

  const subject = options?.asunto
    ? `${tag} ${options.asunto}`
    : `${tag} Expediente de Crédito — ${sale.nombres_cliente} — ${sale.convenio || 'Sin convenio'}`;

  const body = options?.cuerpo || [
    `Estimados,`,
    ``,
    `Adjunto el expediente de crédito del cliente:`,
    ``,
    `• Cliente: ${sale.nombres_cliente}`,
    `• DNI: ${sale.dni_cliente}`,
    `• Convenio: ${sale.convenio || 'N/A'}`,
    `• Monto solicitado: S/ ${Number(sale.monto_solicitado || sale.maf_neto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    `• Plazo: ${sale.cotizacion_plazo || sale.plazo_deseado || 'N/A'} meses`,
    `• Cuota mensual: S/ ${Number(sale.cotizacion_cuota || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
    ``,
    `Se adjuntan ${sale.documents.length} documento(s) del expediente.`,
    ``,
    `Saludos cordiales,`,
    `${asesorName}`,
    `Fuvex A365`
  ].join('\n');

  // Build attachments
  const attachments: Array<{ filename: string; path?: string; content?: Buffer }> = [];
  for (const doc of sale.documents) {
    const filePath = resolveExpedienteDocumentPath(doc.file_path, sale.dni_cliente);
    if (filePath) {
      attachments.push({
        filename: doc.original_name || `${doc.tipo_documento}.pdf`,
        path: filePath
      });
    }
  }

  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: `"Fuvex A365" <${fromEmail}>`,
    to: recipientEmail,
    subject,
    text: body,
    attachments
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

  if (previewUrl) {
    logger.info('MAIL', `Ethereal preview: ${previewUrl}`);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      sale_id: saleId,
      user_id: userId,
      accion: 'Envío de Correo',
      detalles: `Correo enviado a ${recipientEmail}. Asunto: ${subject}. Adjuntos: ${attachments.length}. MessageID: ${info.messageId}${previewUrl ? '. Preview: ' + previewUrl : ''}`
    }
  });

  logger.info('MAIL', `Correo enviado para sale ${saleId} a ${recipientEmail}. MessageID: ${info.messageId}`);

  return {
    messageId: info.messageId,
    previewUrl
  };
}

/**
 * Get the current mail configuration status.
 */
export async function getMailConfigStatus(): Promise<{
  provider: 'smtp' | 'ethereal';
  host?: string;
  from?: string;
  configured: boolean;
}> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;

  if (host && user) {
    return {
      provider: 'smtp',
      host,
      from: process.env.SMTP_FROM || user,
      configured: true
    };
  }

  return {
    provider: 'ethereal',
    host: 'smtp.ethereal.email',
    from: 'test@ethereal.email',
    configured: false
  };
}
