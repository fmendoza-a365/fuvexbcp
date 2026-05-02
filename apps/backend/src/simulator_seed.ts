import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeding del Simulador BCP...');

  const filePath = path.resolve(__dirname, '../../../Recursos/Nuevo simulador Convenios 14.04.xlsx');
  console.log(`Leyendo Excel desde: ${filePath}`);

  const workbook = xlsx.readFile(filePath);

  // 1. Configuración Global
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

  // 2. Extraer Convenios ("Base")
  console.log('📌 Extrayendo Convenios de la hoja Base...');
  const baseSheet = workbook.Sheets['Base'];
  // Convert sheet to JSON, skip header row manually if needed
  const baseData = xlsx.utils.sheet_to_json(baseSheet, { header: 1 });
  
  // Limpiar tablas para evitar duplicados en el seed (Opcional, pero util en desarrollo)
  await prisma.convenioCargoRegla.deleteMany({});
  await prisma.cargo.deleteMany({});
  await prisma.convenio.deleteMany({});

  const conveniosDb = new Map<string, string>(); // name -> id

  // La fila 0 es header. Filas 1+ son datos.
  for (let i = 1; i < baseData.length; i++) {
    const row: any = baseData[i];
    if (!row || !row[0]) continue; // Convenio name
    
    const nombre = String(row[0]).trim();
    const periodo_gracia = Number(row[1]) || 0;
    const rci = Number(row[5]) || 0.30; // Columna F es RCI?
    // According to python dump, Columna F was 6. But let's check:
    // 0: Convenio, 1: Periodo de Gracia, ... 5: RCI? The python output showed J11 uses column 6 (1-indexed, so index 5).
    // Reserve variable: VLOOKUP column 11 (index 10).
    const variables_reserva = Number(row[10]) || 0.0;

    const conv = await prisma.convenio.create({
      data: {
        nombre,
        periodo_gracia,
        rci_default: rci,
        variables_reserva: variables_reserva
      }
    });
    conveniosDb.set(nombre, conv.id);
  }
  console.log(`✅ ${conveniosDb.size} Convenios insertados.`);

  // 3. Extraer Cargos ("Cargos")
  console.log('📌 Extrayendo Cargos de la hoja Cargos...');
  const cargosSheet = workbook.Sheets['Cargos'];
  const cargosData = xlsx.utils.sheet_to_json(cargosSheet, { header: 1 });
  
  const cargosSet = new Set<string>();
  
  // Encontrar todos los cargos únicos en la hoja
  for (let i = 1; i < cargosData.length; i++) {
    const row: any = cargosData[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      if (row[j] && String(row[j]).trim() !== '') {
        cargosSet.add(String(row[j]).trim());
      }
    }
  }

  const cargosDb = new Map<string, string>(); // name -> id
  for (const cargoNombre of Array.from(cargosSet)) {
    const car = await prisma.cargo.create({
      data: { nombre: cargoNombre }
    });
    cargosDb.set(cargoNombre, car.id);
  }
  console.log(`✅ ${cargosDb.size} Cargos insertados.`);

  // 4. Reglas Especiales (Hardcoded de Cáratula)
  console.log('📌 Insertando reglas especiales (RCI por cargo)...');
  
  // Según las fórmulas de Cáratula J11, K11, L11, J13, K13, L13
  const reglasEspeciales = [
    { convenio: "DIRIS_Lima_Norte", cargo: "CAS Indeterminado", rci: 0.40 },
    { convenio: "DIRIS_Lima_Centro", cargo: "CAS Indeterminado", rci: 0.40 },
    { convenio: "RENIEC", cargo: "CAS Indeterminado", rci: 0.45 },
    { convenio: "Policia_Nacional_del_Perú", cargo: "Sub Oficial de Tercera", rci: 0.40 },
    // El excel tiene "Policia_Nacional_del_Perú" pero a veces pierde tilde. Mapeamos por nombre
    { convenio: "UE403_Morropon", cargo: "CAS Indeterminado", rci: 0.42 },
    { convenio: "UE403_Morropon", cargo: "Nombrado", rci: 0.49 },
    { convenio: "Ejército_del_Perú", cargo: "Suboficial Tercera", rci: 0.45 },
  ];

  let reglasInsertadas = 0;
  for (const regla of reglasEspeciales) {
    // Buscar convenio (ignorar tildes o casos)
    const convEntry = Array.from(conveniosDb.entries()).find(([name]) => 
      name.replace(/ú/g, 'u').toLowerCase() === regla.convenio.replace(/ú/g, 'u').toLowerCase()
    );
    const convId = convEntry ? convEntry[1] : undefined;

    const cargoEntry = Array.from(cargosDb.entries()).find(([name]) => 
      name.toLowerCase() === regla.cargo.toLowerCase()
    );
    const cargoId = cargoEntry ? cargoEntry[1] : undefined;

    if (convId && cargoId) {
      await prisma.convenioCargoRegla.create({
        data: {
          convenio_id: convId,
          cargo_id: cargoId,
          rci_especifico: regla.rci
        }
      });
      reglasInsertadas++;
    }
  }

  // Insertar regla de edad máxima (Policia PNP < 55)
  const pnpEntry = Array.from(conveniosDb.entries()).find(([name]) => name.includes("Policia") || name.includes("PNP"));
  const pnpId = pnpEntry ? pnpEntry[1] : undefined;
  
  const subOficialEntry = Array.from(cargosDb.entries()).find(([name]) => name.includes("Tercera"));
  const subOficialTerceraId = subOficialEntry ? subOficialEntry[1] : undefined;

  
  if (pnpId && subOficialTerceraId) {
    // Check if rule already exists to add edad_maxima
    const rule = await prisma.convenioCargoRegla.findFirst({
      where: { convenio_id: pnpId, cargo_id: subOficialTerceraId }
    });
    if (rule) {
      await prisma.convenioCargoRegla.update({
        where: { id: rule.id },
        data: { edad_maxima: 54 } // "menor a 55"
      });
    }
  }

  console.log(`✅ ${reglasInsertadas} Reglas especiales insertadas.`);
  console.log('✅ Seeding del simulador completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
