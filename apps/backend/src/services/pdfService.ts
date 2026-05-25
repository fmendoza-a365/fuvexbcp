import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { storeDocumentFromBuffer } from './storage';
import { logger } from './logger';
import {
  applyPdfTemplateMapping,
  buildDefaultPdfMapping,
  buildPdfFieldValueMap,
  extractPdfTemplateFields,
  findActivePdfTemplate,
  parsePdfTemplateJson,
  resolvePdfTemplateFilePath
} from './pdfTemplates';

function normalizeTemplateKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}

function resolveTemplatePath(templateName: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'apps/backend/templates', templateName),
    path.resolve(process.cwd(), 'templates', templateName),
    path.resolve(__dirname, '..', '..', '..', 'templates', templateName),
    path.resolve(__dirname, '..', '..', 'templates', templateName)
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

export function getTemplateFilename(convenio: string): string | null {
  const conv = normalizeTemplateKey(convenio);
  if (!conv) return null;

  if (conv.includes('DIRIS')) return 'EDITABLE DIRIS NORTE.pdf';
  if (conv.includes('EJERCITO')) return 'EDITABLE EJERCITO.pdf';
  if (conv.includes('ESSALUD')) return 'EDITABLE ESSALUD1.pdf';
  if (conv.includes('HAI') || (conv.includes('HOSPITAL') && (conv.includes('ALMENARA') || conv.includes('IRIGOYEN')))) return 'EDITABLE HAI.pdf';
  if (conv.includes('MARINA')) return 'EDITABLE MARINA.pdf';
  if (conv.includes('ONPE')) return 'EDITABLE ONPE.pdf';
  if (conv.includes('PNP') || conv.includes('POLICIA')) return 'EDITABLE PNP.pdf';
  if (conv.includes('RENIEC')) return 'EDITABLE RENIEC.pdf';
  if (conv.includes('SENASA')) return 'EDITABLE SENASA.pdf';
  if (conv.includes('UPSJB') || conv.includes('SAN JUAN BAUTISTA')) return 'EDITABLE UPSJB.pdf';

  return null;
}

export async function generateAndStoreFilledAgreement(saleId: string, userId: string): Promise<any> {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { asesor: { select: { id: true, username: true, nombre: true } } }
    });

    if (!sale) {
      logger.error('pdfService', `Sale with ID ${saleId} not found for PDF generation`);
      return null;
    }

    const managedTemplate = await findActivePdfTemplate(sale.convenio || '');
    let templateName = '';
    let pdfBytes: Buffer;
    let mappings: Record<string, string>;

    if (managedTemplate) {
      const templatePath = resolvePdfTemplateFilePath(managedTemplate);
      if (!templatePath) {
        logger.error('pdfService', `Managed PDF template file not found for ${managedTemplate.nombre}. cwd=${process.cwd()}`);
        return null;
      }

      templateName = `${managedTemplate.nombre} v${managedTemplate.version}`;
      pdfBytes = await fs.promises.readFile(templatePath);
      const fields = parsePdfTemplateJson<any[]>(managedTemplate.fields_json, []);
      const parsedMappings = parsePdfTemplateJson<Record<string, string>>(managedTemplate.mappings_json, {});
      mappings = Object.keys(parsedMappings).length ? parsedMappings : buildDefaultPdfMapping(fields);
    } else {
      const staticTemplateName = getTemplateFilename(sale.convenio || '');
      if (!staticTemplateName) {
        logger.warn('pdfService', `No PDF template found for convenio: ${sale.convenio}`);
        return null;
      }

      const templatePath = resolveTemplatePath(staticTemplateName);
      if (!templatePath) {
        logger.error('pdfService', `PDF Template file not found for ${staticTemplateName}. cwd=${process.cwd()}`);
        return null;
      }

      templateName = staticTemplateName;
      pdfBytes = await fs.promises.readFile(templatePath);
      mappings = buildDefaultPdfMapping(await extractPdfTemplateFields(Buffer.from(pdfBytes)));
    }

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const values = buildPdfFieldValueMap(sale);
    applyPdfTemplateMapping(form, mappings, values);

    const modifiedPdfBytes = await pdfDoc.save();
    const filename = `SOLICITUD_CONVENIO_${values.dni_cliente || 'sin-dni'}_${Date.now()}.pdf`;

    const storedDoc = await storeDocumentFromBuffer(
      Buffer.from(modifiedPdfBytes),
      filename,
      values.dni_cliente || 'sin-dni',
      'application/pdf'
    );

    const document = await prisma.document.create({
      data: {
        sale_id: saleId,
        tipo_documento: 'SOLICITUD_CONVENIO',
        file_path: storedDoc.filePath,
        original_name: filename,
        mime_type: 'application/pdf',
        size_bytes: modifiedPdfBytes.length,
        checksum_sha256: storedDoc.checksumSha256,
        storage_provider: storedDoc.storageProvider,
        storage_key: storedDoc.storageKey,
        uploaded_by: userId
      }
    });

    await prisma.auditLog.create({
      data: {
        sale_id: saleId,
        user_id: userId,
        accion: 'Generacion de Documento',
        detalles: `PDF de convenio ${templateName} autollenado y registrado como SOLICITUD_CONVENIO`
      }
    });

    return document;
  } catch (error: any) {
    logger.error('pdfService', `Failed to auto-fill PDF agreement for sale ${saleId}: ${error?.message || error}`);
    return null;
  }
}
