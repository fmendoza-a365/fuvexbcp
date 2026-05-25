import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { storeDocumentFromBuffer } from './storage';
import { logger } from './logger';

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
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
      logger.error('pdfService', `Sale with ID ${saleId} not found for PDF generation`);
      return null;
    }

    const templateName = getTemplateFilename(sale.convenio || '');
    if (!templateName) {
      logger.warn('pdfService', `No PDF template found for convenio: ${sale.convenio}`);
      return null;
    }
    const templatePath = resolveTemplatePath(templateName);
    if (!templatePath) {
      logger.error('pdfService', `PDF Template file not found for ${templateName}. cwd=${process.cwd()}`);
      return null;
    }

    const pdfBytes = await fs.promises.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const now = new Date();
    const day = String(now.getDate());
    const month = String(now.getMonth() + 1);
    const year = String(now.getFullYear());
    const formattedDate = `${day}/${month}/${year}`;

    const clientName = sale.nombres_cliente || '';
    const clientDni = sale.dni_cliente || '';
    const phone = sale.celular || '';
    const email = sale.correo || '';
    const address = sale.direccion || '';
    const dist = sale.distrito || '';
    const prov = sale.provincia || '';
    const dept = sale.departamento || '';
    const convName = sale.convenio || '';
    const job = sale.cargo_laboral || '';
    const amount = String(sale.cotizacion_monto || sale.monto_solicitado || sale.maf_neto || '');
    const term = String(sale.cotizacion_plazo || sale.plazo_deseado || '');
    const cuota = String(sale.cotizacion_cuota || '');
    const spouseDni = sale.conyuge_dni || '';
    const spouseName = sale.conyuge_nombres || '';

    // Fill fields
    for (const field of fields) {
      if (field.constructor.name === 'PDFTextField') {
        const txtField = form.getTextField(field.getName());
        const name = field.getName().toUpperCase();

        try {
          if (name === 'N DNI' || name === 'DNI' || name === 'DOCUMENTO') {
            txtField.setText(clientDni);
          } else if (name === 'NOMBRE CLIENTE' || name === 'NOMBRES' || name === 'NOMBRES CLIENTE') {
            txtField.setText(clientName);
          } else if (name === 'CELULAR') {
            txtField.setText(phone);
          } else if (name === 'CORREO') {
            txtField.setText(email);
          } else if (name === 'DIRECCION/DOMICILIO' || name === 'DIRECCION') {
            txtField.setText(address);
          } else if (name === 'DISTRITO') {
            txtField.setText(dist);
          } else if (name === 'PROVINCIA') {
            txtField.setText(prov);
          } else if (name === 'DEPARTAMENTO') {
            txtField.setText(dept);
          } else if (name === 'CONVENIO') {
            txtField.setText(convName);
          } else if (name === 'OCUPACION/GRADO' || name === 'CARGO') {
            txtField.setText(job);
          } else if (name === 'PLAZO') {
            txtField.setText(term);
          } else if (name === 'IMPORTE' || name === 'N CREDITO' || name === 'MONTO') {
            txtField.setText(amount);
          } else if (name === 'CUOTA' || name === 'I FIJO') {
            txtField.setText(cuota);
          } else if (name === 'DNI CONYUGE') {
            txtField.setText(spouseDni);
          } else if (name === 'NOMBRES CONYUGE') {
            txtField.setText(spouseName);
          } else if (name === 'FECHA') {
            txtField.setText(formattedDate);
          } else if (name === 'DIA') {
            txtField.setText(day);
          } else if (name === 'MES') {
            txtField.setText(month);
          } else if (name === 'AÑO') {
            txtField.setText(year);
          }
        } catch (err: any) {
          logger.error('pdfService', `Error setting field ${field.getName()}: ${err?.message || err}`);
        }
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();
    const filename = `SOLICITUD_CONVENIO_${clientDni}_${Date.now()}.pdf`;

    // Store file in local storage or S3
    const storedDoc = await storeDocumentFromBuffer(
      Buffer.from(modifiedPdfBytes),
      filename,
      clientDni,
      'application/pdf'
    );

    // Register document in DB
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
        accion: "Generación de Documento",
        detalles: `PDF de convenio ${templateName} autollenado y registrado como SOLICITUD_CONVENIO`
      }
    });

    return document;
  } catch (error: any) {
    logger.error('pdfService', `Failed to auto-fill PDF agreement for sale ${saleId}: ${error?.message || error}`);
    return null;
  }
}
