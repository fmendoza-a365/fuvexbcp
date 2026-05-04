import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import path from 'path';

type RequiredDoc = {
  tipo_doc: string;
  nombre: string;
  obligatorio: boolean;
  orden: number;
};

const EXCEL_RELATIVE_PATH = '../../../Recursos/Nuevo simulador Convenios 14.04.xlsx';

const SECTORES: Record<string, string> = {
  'Ejército_del_Perú': 'FFAA',
  Policia_Nacional_del_Perú: 'FFAA',
  Marina_de_Guerra: 'FFAA',
  Fuerza_Aerea_del_Perú: 'FFAA',
  Ministerio_Defensa: 'FFAA',
  RENIEC: 'Gobierno',
  SENASA: 'Gobierno',
  ONPE: 'Gobierno',
  UE403_Morropon: 'Gobierno',
  Gobierno_Regional_Loreto: 'Gobierno',
  DIRIS_Lima_Norte: 'Salud',
  DIRIS_Lima_Centro: 'Salud',
  Hospital_de_apoyo_Iquitos: 'Salud',
  Hospital_Regional_Loreto: 'Salud',
  Red_Salud_APLAO: 'Salud',
  UTES_N6: 'Salud',
  ESSALUD: 'Salud',
  U_San_Juan_Bautista: 'Educación',
  UNAP: 'Educación',
  EPSEL: 'Otros',
};

const GENERIC_DOCS: RequiredDoc[] = [
  { tipo_doc: 'DNI_FRENTE', nombre: 'DNI (Frente)', obligatorio: true, orden: 1 },
  { tipo_doc: 'DNI_REVERSO', nombre: 'DNI (Reverso)', obligatorio: true, orden: 2 },
  { tipo_doc: 'BOLETA_PAGO', nombre: 'Boleta de pago (última)', obligatorio: true, orden: 3 },
  { tipo_doc: 'TICKET_CTS', nombre: 'Ticket de CTS', obligatorio: true, orden: 4 },
  { tipo_doc: 'RESOLUCION', nombre: 'Resolución / nombramiento / ratificación', obligatorio: true, orden: 5 },
  { tipo_doc: 'CARA_ANTES_BOLETA', nombre: 'Cara anterior a boleta de pago', obligatorio: true, orden: 6 },
];

const SECTOR_DOCS: Record<string, RequiredDoc[]> = {
  FFAA: [
    { tipo_doc: 'CARNE_IDENTIDAD', nombre: 'Carné de identidad militar/policial', obligatorio: true, orden: 7 },
    { tipo_doc: 'PRACTILLAS', nombre: 'Practillas (últimos 3 meses)', obligatorio: false, orden: 8 },
  ],
  Gobierno: [
    { tipo_doc: 'MEMORANDO', nombre: 'Memorándum de designación', obligatorio: false, orden: 7 },
  ],
  Salud: [
    { tipo_doc: 'CREDENCIAL_ESSALUD', nombre: 'Credencial ESSALUD / centro de salud', obligatorio: false, orden: 7 },
    { tipo_doc: 'DOC_ALTERNO1', nombre: 'Documento alternativo 1', obligatorio: false, orden: 8 },
    { tipo_doc: 'DOC_ALTERNO2', nombre: 'Documento alternativo 2', obligatorio: false, orden: 9 },
    { tipo_doc: 'DOC_ALTERNO3', nombre: 'Documento alternativo 3', obligatorio: false, orden: 10 },
  ],
  Educación: [
    { tipo_doc: 'DOC_ALTERNO1', nombre: 'Documento alternativo 1', obligatorio: false, orden: 7 },
    { tipo_doc: 'DOC_ALTERNO2', nombre: 'Documento alternativo 2', obligatorio: false, orden: 8 },
  ],
};

const SPECIAL_RCI: Array<{ convenio: string; cargo: string; rci: number; edadMaxima?: number }> = [
  { convenio: 'DIRIS_Lima_Norte', cargo: 'CAS Indeterminado', rci: 0.4 },
  { convenio: 'DIRIS_Lima_Centro', cargo: 'CAS Indeterminado', rci: 0.4 },
  { convenio: 'RENIEC', cargo: 'CAS Indeterminado', rci: 0.45 },
  { convenio: 'Policia_Nacional_del_Perú', cargo: 'Sub Oficial de Tercera', rci: 0.4, edadMaxima: 54 },
  { convenio: 'UE403_Morropon', cargo: 'CAS Indeterminado', rci: 0.42 },
  { convenio: 'UE403_Morropon', cargo: 'Nombrado', rci: 0.49 },
  { convenio: 'Ejército_del_Perú', cargo: 'Suboficial Tercera', rci: 0.45 },
];

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCleanString = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
};

const getSector = (convenio: string) => SECTORES[convenio] || 'Otros';

const getSpecialRule = (convenio: string, cargo: string) => (
  SPECIAL_RCI.find(rule => rule.convenio === convenio && rule.cargo === cargo)
);

const getWorkbook = () => {
  const filePath = path.resolve(__dirname, EXCEL_RELATIVE_PATH);
  return {
    filePath,
    workbook: xlsx.readFile(filePath),
  };
};

const sheetRows = (workbook: xlsx.WorkBook, sheetName: string) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`No se encontro la hoja "${sheetName}" en el simulador Excel`);
  }
  return xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][];
};

async function seedGlobalConfig(prisma: PrismaClient) {
  await prisma.configuracionGlobal.upsert({
    where: { clave: 'TEA_DEFAULT' },
    update: {},
    create: {
      clave: 'TEA_DEFAULT',
      valor_numerico: 0.1099,
      descripcion: 'Tasa de interes efectiva anual por defecto (10.99%)',
    },
  });

  await prisma.configuracionGlobal.upsert({
    where: { clave: 'COSTO_ENVIO_FISICO' },
    update: {},
    create: {
      clave: 'COSTO_ENVIO_FISICO',
      valor_numerico: 10,
      descripcion: 'Costo mensual por envio de estado de cuenta fisico',
    },
  });

  await prisma.configuracionGlobal.upsert({
    where: { clave: 'TASA_DESGRAVAMEN_MENSUAL' },
    update: {},
    create: {
      clave: 'TASA_DESGRAVAMEN_MENSUAL',
      valor_numerico: 0.000767,
      descripcion: 'Tasa de seguro de desgravamen mensual (0.0767%)',
    },
  });
}

async function seedConvenios(prisma: PrismaClient, baseRows: unknown[][]) {
  const convenios = new Map<string, { id: string; rci: number }>();

  for (let rowIndex = 1; rowIndex < baseRows.length; rowIndex += 1) {
    const row = baseRows[rowIndex];
    const nombre = toCleanString(row[0]);
    if (!nombre) continue;

    const periodo_gracia = toNumber(row[1], 0);
    const rci_default = toNumber(row[5], 0.3);
    const variables_reserva = toNumber(row[10], 0);
    const sector = getSector(nombre);

    const convenio = await prisma.convenio.upsert({
      where: { nombre },
      update: { activo: true },
      create: {
        nombre,
        periodo_gracia,
        rci_default,
        variables_reserva,
        sector,
        activo: true,
      },
    });
    convenios.set(nombre, { id: convenio.id, rci: convenio.rci_default });
  }

  if (!convenios.has('ESSALUD')) {
    const essalud = await prisma.convenio.upsert({
      where: { nombre: 'ESSALUD' },
      update: { activo: true },
      create: {
        nombre: 'ESSALUD',
        periodo_gracia: 1,
        rci_default: 0.5,
        variables_reserva: 0,
        sector: getSector('ESSALUD'),
        activo: true,
      },
    });
    convenios.set('ESSALUD', { id: essalud.id, rci: essalud.rci_default });
  }

  return convenios;
}

function extractConvenioCargoMap(cargosRows: unknown[][], convenios: Map<string, { id: string; rci: number }>) {
  const header = cargosRows[0] || [];
  const convenioColumns = header
    .map((value, index) => ({ nombre: toCleanString(value), index }))
    .filter(item => item.nombre && convenios.has(item.nombre));

  const convenioCargoMap = new Map<string, string[]>();

  for (const { nombre, index } of convenioColumns) {
    const cargos = new Set<string>();
    for (let rowIndex = 1; rowIndex < cargosRows.length; rowIndex += 1) {
      const cargo = toCleanString(cargosRows[rowIndex]?.[index]);
      if (cargo) cargos.add(cargo);
    }
    convenioCargoMap.set(nombre, [...cargos]);
  }

  return convenioCargoMap;
}

async function seedCargosAndRules(
  prisma: PrismaClient,
  convenios: Map<string, { id: string; rci: number }>,
  convenioCargoMap: Map<string, string[]>,
) {
  const allCargos = new Set<string>();
  convenioCargoMap.forEach(cargos => cargos.forEach(cargo => allCargos.add(cargo)));

  const cargosDb = new Map<string, string>();
  for (const cargoNombre of allCargos) {
    const cargo = await prisma.cargo.upsert({
      where: { nombre: cargoNombre },
      update: { activo: true },
      create: { nombre: cargoNombre, activo: true },
    });
    cargosDb.set(cargoNombre, cargo.id);
  }

  let reglasProcesadas = 0;
  for (const [convenioNombre, cargos] of convenioCargoMap.entries()) {
    const convenio = convenios.get(convenioNombre);
    if (!convenio) continue;

    for (const cargoNombre of cargos) {
      const cargoId = cargosDb.get(cargoNombre);
      if (!cargoId) continue;

      const specialRule = getSpecialRule(convenioNombre, cargoNombre);
      await prisma.convenioCargoRegla.upsert({
        where: {
          convenio_id_cargo_id: {
            convenio_id: convenio.id,
            cargo_id: cargoId,
          },
        },
        update: {},
        create: {
          convenio_id: convenio.id,
          cargo_id: cargoId,
          rci_especifico: specialRule?.rci ?? convenio.rci,
          edad_maxima: specialRule?.edadMaxima ?? null,
        },
      });
      reglasProcesadas += 1;
    }
  }

  return { cargos: allCargos.size, reglasProcesadas };
}

async function seedDocumentosRequeridos(prisma: PrismaClient, convenios: Iterable<string>) {
  const allConvenios = [...convenios, '*'];
  let upserts = 0;

  for (const convenio of allConvenios) {
    const sector = convenio === '*' ? 'Otros' : getSector(convenio);
    const docs = convenio === '*'
      ? GENERIC_DOCS
      : [...GENERIC_DOCS, ...(SECTOR_DOCS[sector] || [])];

    for (const doc of docs) {
      await prisma.documentoRequerido.upsert({
        where: {
          convenio_tipo_doc: {
            convenio,
            tipo_doc: doc.tipo_doc,
          },
        },
        update: {
          nombre: doc.nombre,
          obligatorio: doc.obligatorio,
          orden: doc.orden,
          activo: true,
        },
        create: {
          convenio,
          ...doc,
          activo: true,
        },
      });
      upserts += 1;
    }
  }

  return upserts;
}

export async function seedOperationalCatalogs(prisma: PrismaClient) {
  const { filePath, workbook } = getWorkbook();
  console.log(`Leyendo catalogos operativos desde: ${filePath}`);

  await seedGlobalConfig(prisma);

  const baseRows = sheetRows(workbook, 'Base');
  const cargosRows = sheetRows(workbook, 'Cargos');

  const convenios = await seedConvenios(prisma, baseRows);
  const convenioCargoMap = extractConvenioCargoMap(cargosRows, convenios);
  const { reglasProcesadas } = await seedCargosAndRules(prisma, convenios, convenioCargoMap);
  const documentos = await seedDocumentosRequeridos(prisma, convenios.keys());

  const [totalConvenios, totalCargos, totalReglas, totalConfig] = await Promise.all([
    prisma.convenio.count({ where: { activo: true } }),
    prisma.cargo.count({ where: { activo: true } }),
    prisma.convenioCargoRegla.count(),
    prisma.configuracionGlobal.count(),
  ]);

  console.log(
    `Catalogos listos: ${totalConvenios} convenios, ${totalCargos} cargos, ` +
    `${totalReglas} reglas RCI, ${totalConfig} variables globales, ${documentos} documentos requeridos.`
  );
  console.log(`Reglas RCI procesadas en esta corrida: ${reglasProcesadas}.`);

  return {
    convenios: totalConvenios,
    cargos: totalCargos,
    reglas: totalReglas,
    configuracion: totalConfig,
    documentos,
  };
}
