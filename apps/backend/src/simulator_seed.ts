import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

// Mapeo manual de columnas en la hoja "Cargos" 
// Cada convenio tiene su(s) columna(s) de cargo en el Excel
// Formato: { convenio: [col_index_cargo, ...] }
const CARGOS_COLUMNS: Record<string, number[]> = {
  'Ejército_del_Perú': [0],
  'Policia_Nacional_del_Perú': [4],
  'Marina_de_Guerra': [9],
  'RENIEC': [13],
  'DIRIS_Lima_Norte': [15],
  'Hospital_de_apoyo_Iquitos': [17],
  'ESSALUD': [19],
  'SENASA': [21],
  'ONPE': [23],
  'U_San_Juan_Bautista': [25],
  'DIRIS_Lima_Centro': [27],
  'Ministerio_Defensa': [29],
  'UE403_Morropon': [31],
  'Fuerza_Aerea_del_Perú': [33],
  'EPSEL': [35],
  'UNAP': [37],
  'Hospital_Regional_Loreto': [39],
  'Red_Salud_APLAO': [41],
  'UTES_N6': [43],
  'Gobierno_Regional_Loreto': [45],
};

// Sectores por convenio
const SECTORES: Record<string, string> = {
  'Ejército_del_Perú': 'FFAA',
  'Policia_Nacional_del_Perú': 'FFAA',
  'Marina_de_Guerra': 'FFAA',
  'Fuerza_Aerea_del_Perú': 'FFAA',
  'Ministerio_Defensa': 'FFAA',
  'RENIEC': 'Gobierno',
  'SENASA': 'Gobierno',
  'ONPE': 'Gobierno',
  'UE403_Morropon': 'Gobierno',
  'Gobierno_Regional_Loreto': 'Gobierno',
  'DIRIS_Lima_Norte': 'Salud',
  'DIRIS_Lima_Centro': 'Salud',
  'Hospital_de_apoyo_Iquitos': 'Salud',
  'Hospital_Regional_Loreto': 'Salud',
  'Red_Salud_APLAO': 'Salud',
  'UTES_N6': 'Salud',
  'ESSALUD': 'Salud',
  'U_San_Juan_Bautista': 'Educación',
  'UNAP': 'Educación',
  'EPSEL': 'Otros',
};

async function main() {
  console.log('🌱 Iniciando seeding del Simulador BCP...');

  const filePath = path.resolve(__dirname, '../../../Recursos/Nuevo simulador Convenios 14.04.xlsx');
  console.log(`Leyendo Excel desde: ${filePath}`);

  const workbook = xlsx.readFile(filePath);

  // ═══════════════════════════════════════════════════
  // 1. CONFIGURACIÓN GLOBAL
  // ═══════════════════════════════════════════════════
  console.log('📌 Configurando variables globales...');
  
  await prisma.configuracionGlobal.upsert({
    where: { clave: 'TEA_DEFAULT' },
    update: { valor_numerico: 0.1099, descripcion: 'Tasa de Interés Efectiva Anual (10.99%)' },
    create: { clave: 'TEA_DEFAULT', valor_numerico: 0.1099, descripcion: 'Tasa de Interés Efectiva Anual (10.99%)' }
  });

  await prisma.configuracionGlobal.upsert({
    where: { clave: 'COSTO_ENVIO_FISICO' },
    update: { valor_numerico: 10.00, descripcion: 'Costo mensual por envío de estado de cuenta físico' },
    create: { clave: 'COSTO_ENVIO_FISICO', valor_numerico: 10.00, descripcion: 'Costo mensual por envío de estado de cuenta físico' }
  });

  await prisma.configuracionGlobal.upsert({
    where: { clave: 'TASA_DESGRAVAMEN_MENSUAL' },
    update: { valor_numerico: 0.000767, descripcion: 'Tasa de seguro de desgravamen mensual (0.0767%)' },
    create: { clave: 'TASA_DESGRAVAMEN_MENSUAL', valor_numerico: 0.000767, descripcion: 'Tasa de seguro de desgravamen mensual (0.0767%)' }
  });

  // ═══════════════════════════════════════════════════
  // 2. LIMPIAR DATOS ANTERIORES
  // ═══════════════════════════════════════════════════
  console.log('🗑️  Limpiando datos anteriores...');
  await prisma.convenioCargoRegla.deleteMany({});
  await prisma.cargo.deleteMany({});
  await prisma.convenio.deleteMany({});

  // ═══════════════════════════════════════════════════
  // 3. EXTRAER CONVENIOS (hoja "Base")
  // ═══════════════════════════════════════════════════
  console.log('📌 Extrayendo Convenios de la hoja Base...');
  const baseSheet = workbook.Sheets['Base'];
  const baseData = xlsx.utils.sheet_to_json(baseSheet, { header: 1 });

  const conveniosDb = new Map<string, string>(); // name -> id

  for (let i = 1; i < baseData.length; i++) {
    const row: any = baseData[i];
    if (!row || !row[0]) continue;

    const nombre = String(row[0]).trim();
    const periodo_gracia = Number(row[1]) || 0;
    const rci = Number(row[5]) || 0.30; // Columna F = %RCI
    const reserva = Number(row[10]) || 0.0; // Columna K = Reserva
    const rci_global = Number(row[11]) || null; // Columna L = RCI global
    const sector = SECTORES[nombre] || 'Otros';

    const conv = await prisma.convenio.create({
      data: {
        nombre,
        periodo_gracia,
        rci_default: rci,
        variables_reserva: reserva,
        sector
      }
    });
    conveniosDb.set(nombre, conv.id);
    console.log(`  ✅ ${nombre} | PG: ${periodo_gracia} | RCI: ${rci} | Reserva: ${reserva} | Sector: ${sector}`);
  }
  // ESSALUD no está en la hoja Base, crearlo manualmente
  if (!conveniosDb.has('ESSALUD')) {
    const essalud = await prisma.convenio.create({
      data: {
        nombre: 'ESSALUD',
        periodo_gracia: 1,
        rci_default: 0.50,
        variables_reserva: 0,
        sector: 'Salud'
      }
    });
    conveniosDb.set('ESSALUD', essalud.id);
    console.log(`  ✅ ESSALUD (manual) | PG: 1 | RCI: 0.50 | Reserva: 0 | Sector: Salud`);
  }

  console.log(`✅ ${conveniosDb.size} Convenios insertados.`);

  // ═══════════════════════════════════════════════════
  // 4. EXTRAER CARGOS Y ASIGNAR A CONVENIOS (hoja "Cargos")
  // ═══════════════════════════════════════════════════
  console.log('📌 Extrayendo Cargos de la hoja Cargos...');
  const cargosSheet = workbook.Sheets['Cargos'];
  const cargosData = xlsx.utils.sheet_to_json(cargosSheet, { header: 1 });

  // Primero recopilar TODOS los cargos únicos y su mapeo a convenios
  const convenioCargosMap = new Map<string, string[]>(); // convenio -> [cargos]
  const allCargosSet = new Set<string>();

  for (const [convenioName, colIndices] of Object.entries(CARGOS_COLUMNS)) {
    const cargosForConvenio: string[] = [];
    for (let rowIdx = 1; rowIdx < cargosData.length; rowIdx++) {
      const row: any = cargosData[rowIdx];
      if (!row) continue;
      for (const colIdx of colIndices) {
        if (row[colIdx] && String(row[colIdx]).trim() !== '') {
          const cargoName = String(row[colIdx]).trim();
          cargosForConvenio.push(cargoName);
          allCargosSet.add(cargoName);
        }
      }
    }
    convenioCargosMap.set(convenioName, cargosForConvenio);
  }

  // Crear registros de Cargo únicos
  const cargosDb = new Map<string, string>(); // name -> id
  for (const cargoNombre of Array.from(allCargosSet)) {
    const car = await prisma.cargo.create({
      data: { nombre: cargoNombre }
    });
    cargosDb.set(cargoNombre, car.id);
  }
  console.log(`✅ ${cargosDb.size} Cargos únicos insertados.`);

  // ═══════════════════════════════════════════════════
  // 5. CREAR RELACIONES CONVENIO-CARGO (ConvenioCargoRegla)
  // ═══════════════════════════════════════════════════
  console.log('📌 Creando relaciones Convenio-Cargo con RCI...');

  let reglasInsertadas = 0;
  let reglasOmitidas = 0;

  for (const [convenioName, cargosList] of convenioCargosMap.entries()) {
    const convId = conveniosDb.get(convenioName);
    if (!convId) {
      console.log(`  ⚠️ Convenio "${convenioName}" no encontrado en DB`);
      continue;
    }

    // Obtener el RCI default del convenio
    const convenioData = await prisma.convenio.findUnique({ where: { id: convId } });
    const rciDefault = convenioData?.rci_default || 0.30;

    for (const cargoName of cargosList) {
      const cargoId = cargosDb.get(cargoName);
      if (!cargoId) {
        console.log(`  ⚠️ Cargo "${cargoName}" no encontrado en DB`);
        continue;
      }

      // RCI específico basado en reglas del Excel (Cáratula)
      let rciEspecifico = rciDefault; // Default: usar el RCI del convenio

      // Reglas especiales del Excel Cáratula
      if (convenioName === 'DIRIS_Lima_Norte' && cargoName === 'CAS Indeterminado') rciEspecifico = 0.40;
      else if (convenioName === 'DIRIS_Lima_Centro' && cargoName === 'CAS Indeterminado') rciEspecifico = 0.40;
      else if (convenioName === 'RENIEC' && cargoName === 'CAS Indeterminado') rciEspecifico = 0.45;
      else if (convenioName === 'Policia_Nacional_del_Perú' && cargoName === 'Sub Oficial de Tercera') rciEspecifico = 0.40;
      else if (convenioName === 'UE403_Morropon' && cargoName === 'CAS Indeterminado') rciEspecifico = 0.42;
      else if (convenioName === 'UE403_Morropon' && cargoName === 'Nombrado') rciEspecifico = 0.49;
      else if (convenioName === 'Ejército_del_Perú' && cargoName === 'Suboficial Tercera') rciEspecifico = 0.45;

      // Edad máxima (solo PNP Sub Oficial de Tercera)
      let edadMaxima: number | null = null;
      if (convenioName === 'Policia_Nacional_del_Perú' && cargoName === 'Sub Oficial de Tercera') {
        edadMaxima = 54; // "menor a 55"
      }

      try {
        await prisma.convenioCargoRegla.create({
          data: {
            convenio_id: convId,
            cargo_id: cargoId,
            rci_especifico: rciEspecifico,
            edad_maxima: edadMaxima
          }
        });
        reglasInsertadas++;
      } catch (e: any) {
        // Ignorar duplicados
        if (e.code === 'P2002') {
          reglasOmitidas++;
        } else {
          console.log(`  ❌ Error insertando regla ${convenioName}/${cargoName}: ${e.message}`);
        }
      }
    }
  }

  console.log(`✅ ${reglasInsertadas} relaciones Convenio-Cargo insertadas.`);
  if (reglasOmitidas > 0) console.log(`  ℹ️  ${reglasOmitidas} duplicados omitidos.`);

  // ═══════════════════════════════════════════════════
  // 6. RESUMEN FINAL
  // ═══════════════════════════════════════════════════
  const totalConvenios = await prisma.convenio.count();
  const totalCargos = await prisma.cargo.count();
  const totalReglas = await prisma.convenioCargoRegla.count();
  const totalConfig = await prisma.configuracionGlobal.count();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 RESUMEN DEL SEEDING');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Convenios:            ${totalConvenios}`);
  console.log(`  Cargos únicos:        ${totalCargos}`);
  console.log(`  Reglas Convenio-Cargo: ${totalReglas}`);
  console.log(`  Configuración Global: ${totalConfig}`);
  console.log('═══════════════════════════════════════════════════');

  // Listar convenios con su conteo de cargos
  console.log('\n📋 Detalle por Convenio:');
  for (const [convName, cargosList] of convenioCargosMap.entries()) {
    const conv = await prisma.convenio.findUnique({ where: { nombre: convName } });
    const reglasCount = await prisma.convenioCargoRegla.count({ where: { convenio_id: conv?.id } });
    console.log(`  ${convName} (${conv?.sector}): ${cargosList.length} cargos, RCI: ${conv?.rci_default}, PG: ${conv?.periodo_gracia} meses, Reserva: ${conv?.variables_reserva}`);
  }

  console.log('\n✅ Seeding del simulador completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });