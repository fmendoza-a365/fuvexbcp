import { PDFDocument, PDFForm } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { firstExistingPath } from './storage';

export type PdfTemplateField = {
  name: string;
  normalized: string;
  type: string;
  suggested_key: string | null;
};

export type PdfTemplateMapping = Record<string, string>;

export const PDF_TEMPLATE_FIELD_OPTIONS = [
  { value: 'dni_cliente', label: 'DNI cliente', group: 'Cliente' },
  { value: 'nombres_cliente', label: 'Nombre completo cliente', group: 'Cliente' },
  { value: 'nombres_solo_cliente', label: 'Nombres cliente sin apellidos', group: 'Cliente' },
  { value: 'apellido_paterno_cliente', label: 'Apellido paterno cliente', group: 'Cliente' },
  { value: 'apellido_materno_cliente', label: 'Apellido materno cliente', group: 'Cliente' },
  { value: 'fecha_nacimiento_cliente', label: 'Fecha nacimiento cliente', group: 'Cliente' },
  { value: 'estado_civil_cliente', label: 'Estado civil cliente', group: 'Cliente' },
  { value: 'celular', label: 'Celular', group: 'Cliente' },
  { value: 'correo', label: 'Correo', group: 'Cliente' },
  { value: 'direccion', label: 'Direccion domicilio', group: 'Direccion' },
  { value: 'departamento', label: 'Departamento', group: 'Direccion' },
  { value: 'provincia', label: 'Provincia', group: 'Direccion' },
  { value: 'distrito', label: 'Distrito', group: 'Direccion' },
  { value: 'referencia', label: 'Referencia', group: 'Direccion' },
  { value: 'convenio', label: 'Convenio', group: 'Laboral' },
  { value: 'entidad_laboral', label: 'Entidad laboral', group: 'Laboral' },
  { value: 'cargo_laboral', label: 'Cargo u ocupacion', group: 'Laboral' },
  { value: 'direccion_laboral', label: 'Direccion laboral', group: 'Laboral' },
  { value: 'fecha_ingreso_laboral', label: 'Fecha ingreso laboral', group: 'Laboral' },
  { value: 'ingreso_bruto', label: 'Ingreso bruto', group: 'Laboral' },
  { value: 'monto', label: 'Monto / importe', group: 'Credito' },
  { value: 'plazo', label: 'Plazo', group: 'Credito' },
  { value: 'cuota', label: 'Cuota', group: 'Credito' },
  { value: 'tasa_iea', label: 'Tasa IEA', group: 'Credito' },
  { value: 'tasa_cea', label: 'Tasa CEA', group: 'Credito' },
  { value: 'intereses', label: 'Intereses', group: 'Credito' },
  { value: 'cuotas_ano', label: 'Cuotas por ano', group: 'Credito' },
  { value: 'periodo_gracia', label: 'Periodo de gracia', group: 'Credito' },
  { value: 'ruc_cliente', label: 'RUC cliente', group: 'Cliente' },
  { value: 'dni_conyuge', label: 'DNI conyuge', group: 'Conyuge' },
  { value: 'nombres_conyuge', label: 'Nombre completo conyuge', group: 'Conyuge' },
  { value: 'nombres_solo_conyuge', label: 'Nombres conyuge sin apellidos', group: 'Conyuge' },
  { value: 'apellido_paterno_conyuge', label: 'Apellido paterno conyuge', group: 'Conyuge' },
  { value: 'apellido_materno_conyuge', label: 'Apellido materno conyuge', group: 'Conyuge' },
  { value: 'asesor_nombre', label: 'Nombre asesor', group: 'Venta' },
  { value: 'asesor_username', label: 'Usuario asesor', group: 'Venta' },
  { value: 'dni_vendedor', label: 'DNI vendedor', group: 'Venta' },
  { value: 'fecha', label: 'Fecha actual', group: 'Sistema' },
  { value: 'dia', label: 'Dia actual', group: 'Sistema' },
  { value: 'mes', label: 'Mes actual', group: 'Sistema' },
  { value: 'ano', label: 'Ano actual', group: 'Sistema' },
  { value: 'oficina', label: 'Oficina', group: 'Sistema' },
  { value: 'sede', label: 'Sede', group: 'Sistema' },
  { value: 'cuenta', label: 'Cuenta bancaria', group: 'Banco' },
  { value: 'banco_1', label: 'Banco 1', group: 'Compra deuda' },
  { value: 'banco_2', label: 'Banco 2', group: 'Compra deuda' },
  { value: 'banco_3', label: 'Banco 3', group: 'Compra deuda' },
  { value: 'banco_4', label: 'Banco 4', group: 'Compra deuda' },
  { value: 'banco_5', label: 'Banco 5', group: 'Compra deuda' },
  { value: 'compra_deuda_monto', label: 'Monto compra deuda', group: 'Compra deuda' }
];

const VALUE_KEYS = new Set(PDF_TEMPLATE_FIELD_OPTIONS.map(option => option.value));

export const pdfTemplatesPath = firstExistingPath([
  process.env.PDF_TEMPLATE_ROOT ? path.resolve(process.env.PDF_TEMPLATE_ROOT) : '',
  path.resolve(process.cwd(), 'storage/pdf-templates'),
  path.resolve(process.cwd(), '../../storage/pdf-templates'),
  path.resolve(__dirname, '../../../storage/pdf-templates'),
  path.resolve(__dirname, '../../../../storage/pdf-templates')
].filter(Boolean));

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function normalizePdfTemplateKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}

function sanitizeSegment(value: string) {
  return String(value || 'sin-dato').replace(/[^0-9a-zA-Z_.-]/g, '_').slice(0, 120) || 'sin-dato';
}

function formatDate(value?: Date | string | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
}

function hasAny(value: string, fragments: string[]) {
  return fragments.some(fragment => value.includes(fragment));
}

function splitPersonName(value?: string | null) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { nombres: '', paterno: '', materno: '' };

  const commaParts = clean.split(',').map(part => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const surnameParts = commaParts[0].split(' ').filter(Boolean);
    return {
      nombres: commaParts.slice(1).join(' '),
      paterno: surnameParts[0] || '',
      materno: surnameParts.slice(1).join(' ')
    };
  }

  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 3) {
    return {
      nombres: parts.slice(0, -2).join(' '),
      paterno: parts[parts.length - 2] || '',
      materno: parts[parts.length - 1] || ''
    };
  }

  if (parts.length === 2) {
    return {
      nombres: parts[0] || '',
      paterno: parts[1] || '',
      materno: ''
    };
  }

  return { nombres: clean, paterno: '', materno: '' };
}

function suggestSourceKey(fieldName: string, fieldType: string): string | null {
  if (fieldType !== 'PDFTextField') return null;

  const name = normalizePdfTemplateKey(fieldName);
  const isSpouse = hasAny(name, ['CONYUGE', 'CONYUGUE', 'ESPOSA', 'ESPOSO']);
  const isPaternal = hasAny(name, ['PATERNO', 'APELLIDO P', 'AP P', 'AP PAT']);
  const isMaternal = hasAny(name, ['MATERNO', 'APELLIDO M', 'AP M', 'AP MAT']);
  const isDocument = hasAny(name, ['DNI', 'DOCUMENTO', 'DOC IDENTIDAD', 'NUM DOC', 'NRO DOC']);
  const isFullName = hasAny(name, ['NOMBRE COMPLETO', 'NOMBRES Y APELLIDOS', 'APELLIDOS Y NOMBRES', 'APELLIDO Y NOMBRE'])
    || name === 'CLIENTE'
    || name === 'TITULAR';
  const isGivenName = hasAny(name, ['NOMBRE', 'NOMBRES']);

  if (isSpouse && isDocument) return 'dni_conyuge';
  if (isSpouse && isPaternal) return 'apellido_paterno_conyuge';
  if (isSpouse && isMaternal) return 'apellido_materno_conyuge';
  if (isSpouse && isFullName) return 'nombres_conyuge';
  if (isSpouse && isGivenName) return 'nombres_solo_conyuge';
  if (isDocument) return 'dni_cliente';
  if (isPaternal) return 'apellido_paterno_cliente';
  if (isMaternal) return 'apellido_materno_cliente';
  if (isFullName) return 'nombres_cliente';
  if (name === 'NOMBRE CLIENTE' || name === 'NOMBRES CLIENTE' || name === 'NOMBRES' || name === 'NOMBRE') return 'nombres_solo_cliente';
  if (name.includes('NACIM') || name.includes('NACI')) return 'fecha_nacimiento_cliente';
  if (name === 'CELULAR') return 'celular';
  if (name === 'CORREO') return 'correo';
  if (name.includes('DIRECCION') && name.includes('LABORAL')) return 'direccion_laboral';
  if (name.includes('DIRECCION') || name.includes('JR AV CALLE') || name.includes('DOMICILIO')) return 'direccion';
  if (name === 'DISTRITO') return 'distrito';
  if (name === 'PROVINCIA') return 'provincia';
  if (name === 'DEPARTAMENTO') return 'departamento';
  if (name === 'REFERENCIA') return 'referencia';
  if (name === 'CONVENIO') return 'convenio';
  if (name.includes('OCUPACION') || name === 'CARGO' || name === 'PROFESION' || name.includes('PUESTO')) return 'cargo_laboral';
  if ((name.includes('FECHA') || name.startsWith('F ')) && name.includes('INGRESO')) return 'fecha_ingreso_laboral';
  if ((name.includes('INGRESO') || name.includes('REMUNERACION') || name.includes('SUELDO')) && !name.includes('FECHA')) return 'ingreso_bruto';
  if (name === 'I BRUTO') return 'ingreso_bruto';
  if (name === 'PLAZO') return 'plazo';
  if (name === 'CUOTA' || name === 'I FIJO') return 'cuota';
  if (name === 'IMPORTE' || name === 'MONTO' || name === 'N CREDITO') return 'monto';
  if (name === 'TASA IEA') return 'tasa_iea';
  if (name === 'TASA CEA') return 'tasa_cea';
  if (name === 'INTERESES') return 'intereses';
  if (name === 'CUOTAS ANO') return 'cuotas_ano';
  if (name === 'P GRACIA') return 'periodo_gracia';
  if (name === 'RUC') return 'ruc_cliente';
  if (name === 'DNI VENDEDOR') return 'dni_vendedor';
  if (name.includes('EJECUTIVO') || name.includes('COORDINADOR')) return 'asesor_nombre';
  if (name === 'FECHA') return 'fecha';
  if (name === 'DIA') return 'dia';
  if (name === 'MES') return 'mes';
  if (name === 'ANO') return 'ano';
  if (name === 'OFICINA') return 'oficina';
  if (name === 'SEDE') return 'sede';
  if (name === 'CUENTA') return 'cuenta';
  if (name.startsWith('BANCO ')) return `banco_${name.replace('BANCO ', '')}`;
  if (name.startsWith('COMPRA ') || name === 'TOTAL CD') return 'compra_deuda_monto';

  return null;
}

export async function extractPdfTemplateFields(buffer: Buffer): Promise<PdfTemplateField[]> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdfDoc.getForm().getFields().map(field => {
    const type = field.constructor.name;
    const name = field.getName();
    return {
      name,
      normalized: normalizePdfTemplateKey(name),
      type,
      suggested_key: suggestSourceKey(name, type)
    };
  });
}

export function buildDefaultPdfMapping(fields: PdfTemplateField[]): PdfTemplateMapping {
  return fields.reduce<PdfTemplateMapping>((acc, field) => {
    if (field.suggested_key) acc[field.name] = field.suggested_key;
    return acc;
  }, {});
}

export function parsePdfTemplateJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getNextPdfTemplateVersion(convenio: string) {
  const last = await prisma.pdfTemplate.findFirst({
    where: { convenio },
    orderBy: { version: 'desc' },
    select: { version: true }
  });
  return (last?.version || 0) + 1;
}

export async function storePdfTemplateBuffer(buffer: Buffer, convenio: string, version: number, originalName: string) {
  const convenioDir = sanitizeSegment(normalizePdfTemplateKey(convenio).toLowerCase());
  const targetDir = path.join(pdfTemplatesPath, convenioDir);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const filename = `${convenioDir}_v${version}_${Date.now()}${path.extname(originalName).toLowerCase() || '.pdf'}`;
  const targetPath = path.join(targetDir, filename);
  await fs.promises.writeFile(targetPath, buffer);

  return {
    filePath: targetPath,
    storageKey: `${convenioDir}/${filename}`
  };
}

export function resolvePdfTemplateFilePath(template: { file_path: string; storage_key?: string | null }) {
  const candidates = [
    path.isAbsolute(template.file_path) ? template.file_path : path.resolve(process.cwd(), template.file_path),
    template.storage_key ? path.join(pdfTemplatesPath, template.storage_key) : '',
    path.join(pdfTemplatesPath, path.basename(template.file_path))
  ].filter(Boolean).map(candidate => path.normalize(candidate));

  return candidates.find(candidate => fs.existsSync(candidate) && isInside(pdfTemplatesPath, candidate)) || null;
}

export async function findActivePdfTemplate(convenio: string) {
  const target = normalizePdfTemplateKey(convenio);
  if (!target) return null;

  const templates = await prisma.pdfTemplate.findMany({
    where: { activo: true },
    orderBy: [{ convenio: 'asc' }, { version: 'desc' }]
  });

  return templates.find(template => normalizePdfTemplateKey(template.convenio) === target)
    || templates.find(template => {
      const current = normalizePdfTemplateKey(template.convenio);
      return current && (target.includes(current) || current.includes(target));
    })
    || null;
}

export function buildPdfFieldValueMap(sale: any): Record<string, string> {
  const now = new Date();
  const amount = firstValue(sale.cotizacion_monto, sale.monto_solicitado, sale.maf_neto);
  const term = firstValue(sale.cotizacion_plazo, sale.plazo_deseado);
  const cuota = firstValue(sale.cotizacion_cuota, sale.simulacion_cuota);
  const clienteName = splitPersonName(sale.nombres_cliente);
  const conyugeName = splitPersonName(sale.conyuge_nombres);

  return {
    dni_cliente: firstValue(sale.dni_cliente),
    nombres_cliente: firstValue(sale.nombres_cliente),
    nombres_solo_cliente: firstValue(sale.nombres_solo_cliente, clienteName.nombres, sale.nombres_cliente),
    apellido_paterno_cliente: firstValue(sale.apellido_paterno_cliente, clienteName.paterno),
    apellido_materno_cliente: firstValue(sale.apellido_materno_cliente, clienteName.materno),
    fecha_nacimiento_cliente: firstValue(sale.fecha_nacimiento_cliente),
    estado_civil_cliente: firstValue(sale.estado_civil_cliente),
    celular: firstValue(sale.celular),
    correo: firstValue(sale.correo),
    direccion: firstValue(sale.direccion),
    departamento: firstValue(sale.departamento),
    provincia: firstValue(sale.provincia),
    distrito: firstValue(sale.distrito),
    referencia: firstValue(sale.referencia),
    convenio: firstValue(sale.convenio),
    entidad_laboral: firstValue(sale.entidad_laboral, sale.convenio),
    cargo_laboral: firstValue(sale.cargo_laboral),
    direccion_laboral: firstValue(sale.direccion_laboral),
    fecha_ingreso_laboral: firstValue(sale.fecha_ingreso_laboral),
    ingreso_bruto: firstValue(sale.ingreso_bruto),
    monto: amount,
    plazo: term,
    cuota,
    tasa_iea: firstValue(sale.tasa_iea, sale.simulacion_tea),
    tasa_cea: firstValue(sale.tasa_cea),
    intereses: firstValue(sale.intereses),
    cuotas_ano: firstValue(sale.cuotas_ano),
    periodo_gracia: firstValue(sale.periodo_gracia),
    ruc_cliente: firstValue(sale.ruc_cliente),
    dni_conyuge: firstValue(sale.conyuge_dni),
    nombres_conyuge: firstValue(sale.conyuge_nombres),
    nombres_solo_conyuge: firstValue(sale.conyuge_nombres_solo, conyugeName.nombres, sale.conyuge_nombres),
    apellido_paterno_conyuge: firstValue(sale.conyuge_apellido_paterno, conyugeName.paterno),
    apellido_materno_conyuge: firstValue(sale.conyuge_apellido_materno, conyugeName.materno),
    asesor_nombre: firstValue(sale.asesor?.nombre, sale.asesor_nombre),
    asesor_username: firstValue(sale.asesor?.username),
    dni_vendedor: firstValue(sale.dni_vendedor),
    fecha: formatDate(now),
    dia: String(now.getDate()),
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
    oficina: firstValue(sale.oficina),
    sede: firstValue(sale.sede),
    cuenta: firstValue(sale.cuenta),
    banco_1: firstValue(sale.banco_1),
    banco_2: firstValue(sale.banco_2),
    banco_3: firstValue(sale.banco_3),
    banco_4: firstValue(sale.banco_4),
    banco_5: firstValue(sale.banco_5),
    compra_deuda_monto: firstValue(sale.compra_deuda_monto)
  };
}

export function applyPdfTemplateMapping(form: PDFForm, mapping: PdfTemplateMapping, values: Record<string, string>) {
  for (const field of form.getFields()) {
    if (field.constructor.name !== 'PDFTextField') continue;

    const fieldName = field.getName();
    const sourceKey = mapping[fieldName];
    if (!sourceKey || !VALUE_KEYS.has(sourceKey)) continue;

    try {
      form.getTextField(fieldName).setText(values[sourceKey] || '');
    } catch {
      // A corrupt or incompatible field should not block the full document.
    }
  }
}
