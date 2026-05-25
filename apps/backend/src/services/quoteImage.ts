import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import puppeteer from 'puppeteer';
import { publicDownloadsPath } from './storage';

const templatePath = path.resolve(process.cwd(), 'Recursos/bcp_convenios_banner_pdf_imagen_9_inputs_cliente.html');
const fallbackTemplatePath = path.resolve(process.cwd(), '../../Recursos/bcp_convenios_banner_pdf_imagen_9_inputs_cliente.html');

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const monthFormatter = new Intl.DateTimeFormat('es-PE', { month: 'long' });

const toNumber = (...values: any[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const formatMoney = (value: number) => `S/ ${moneyFormatter.format(value || 0)}`;

const formatPercent = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  const percent = value < 1 ? value * 100 : value;
  return `${percent.toFixed(2)}%`;
};

const parseSimulationSummary = (sale: any) => {
  try {
    const parsed = typeof sale.simulacion_resultado === 'string'
      ? JSON.parse(sale.simulacion_resultado)
      : sale.simulacion_resultado;
    return parsed?.resumen || {};
  } catch {
    return {};
  }
};

const normalizePhone = (value: any) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('51') && digits.length >= 11) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`;
  return digits;
};

export function buildQuoteImageData(sale: any) {
  const summary = parseSimulationSummary(sale);
  const monto = toNumber(sale.cotizacion_monto, sale.simulacion_monto, summary.monto_solicitado, sale.monto_solicitado, sale.maf_neto);
  const cuota = toNumber(sale.cotizacion_cuota, sale.simulacion_cuota, summary.cuota_mensual);
  const plazo = toNumber(sale.cotizacion_plazo, sale.simulacion_plazo, summary.plazo, sale.plazo_deseado);
  const tea = toNumber(sale.simulacion_tea, summary.tea);
  const deuda = toNumber(sale.compra_deuda_monto, sale.rcc_monto_deuda, summary.deuda_total);
  const libre = toNumber(summary.ingreso_neto_disponible, summary.capacidad_maxima);
  const monthSource = sale.boleta_recibida_at || sale.cotizacion_enviada_at || new Date();
  const mes = monthFormatter.format(new Date(monthSource)).replace(/^\w/, (char) => char.toUpperCase());

  return {
    values: [
      String(sale.nombres_cliente || '').toUpperCase(),
      String(sale.convenio || '').toUpperCase(),
      formatMoney(monto),
      cuota ? formatMoney(cuota) : '-',
      plazo ? `${Math.round(plazo)} meses` : '-',
      formatPercent(tea),
      mes,
      formatMoney(deuda),
      libre ? formatMoney(libre) : '-'
    ],
    monto,
    cuota,
    plazo,
    phone: normalizePhone(sale.celular),
    cliente: sale.nombres_cliente || 'cliente'
  };
}

export async function generateQuoteImage(sale: any) {
  const resolvedTemplatePath = fs.existsSync(templatePath) ? templatePath : fallbackTemplatePath;
  if (!fs.existsSync(resolvedTemplatePath)) {
    throw new Error('Plantilla de cotizacion no encontrada.');
  }

  const data = buildQuoteImageData(sale);
  const dir = path.join(publicDownloadsPath, 'cotizaciones');
  await fs.promises.mkdir(dir, { recursive: true });

  const fingerprint = crypto
    .createHash('sha1')
    .update(JSON.stringify(data.values))
    .digest('hex')
    .slice(0, 14);
  const safeDni = String(sale.dni_cliente || 'cliente').replace(/\D/g, '') || 'cliente';
  const filename = `cotizacion-${safeDni}-${fingerprint}.png`;
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    return {
      filename,
      filePath,
      cached: true,
      ...data
    };
  }

  const html = await fs.promises.readFile(resolvedTemplatePath, 'utf8');
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.addStyleTag({
      content: `
        body { background: transparent !important; }
        .toolbar { display: none !important; }
        .screen { box-shadow: none !important; }
      `
    });

    await page.$$eval('.field', (fields: any[], values: string[]) => {
      fields.forEach((field, index) => {
        field.value = String(values[index] || '');
      });
    }, data.values);

    await page.$eval('#cotizacion', (screen: any) => {
      screen.classList.add('exporting');
      const cells = Array.from(screen.querySelectorAll('.value'));
      cells.forEach((cell: any) => {
        const input = cell.querySelector('input');
        if (!input) return;
        const span = screen.ownerDocument.createElement('span');
        span.className = `export-text ${input.classList.contains('red') ? 'red' : ''} ${input.classList.contains('month') ? 'month' : ''}`;
        span.textContent = input.value || input.getAttribute('placeholder') || '';
        input.remove();
        cell.appendChild(span);
      });
    });

    const element = await page.$('#cotizacion');
    if (!element) throw new Error('No se pudo renderizar la cotizacion.');

    const image = await element.screenshot({ type: 'png' });
    await fs.promises.writeFile(filePath, Buffer.from(image));

    return {
      filename,
      filePath,
      cached: false,
      ...data
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export function buildQuoteWhatsAppMessage(sale: any, imageUrl: string) {
  const data = buildQuoteImageData(sale);
  const firstName = String(data.cliente || 'cliente').split(' ')[0];
  const convenio = String(sale.convenio || 'Convenio BCP').replace(/_/g, ' ');
  return [
    '*FUVEX MANAGER BCP*',
    'Cotizacion referencial de credito por convenio',
    '',
    `Hola ${firstName}, te comparto la propuesta generada para tu evaluacion.`,
    `Cliente: ${String(data.cliente || '').toUpperCase()}`,
    `Convenio: ${convenio}`,
    `Monto solicitado: ${formatMoney(data.monto)}`,
    data.cuota ? `Cuota estimada: ${formatMoney(data.cuota)}` : '',
    data.plazo ? `Plazo: ${Math.round(data.plazo)} meses` : '',
    '',
    'Imagen oficial de la cotizacion:',
    imageUrl,
    '',
    'La aprobacion final esta sujeta a validacion documental, evaluacion BCP y condiciones vigentes al momento del tramite.'
  ].filter(Boolean).join('\n');
}
