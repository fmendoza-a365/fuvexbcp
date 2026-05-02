const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

const sectorMapping = {
    'FF.AA. y Policiales': ['Marina', 'Ejército', 'Policia', 'Fuerza_Aerea', 'Ministerio_Defensa'],
    'Sector Salud': ['DIRIS', 'Hospital', 'Red_Salud', 'UTES', 'ESSALUD'],
    'Organismos de Estado': ['RENIEC', 'ONPE', 'SENASA', 'Gobierno_Regional', 'UE403'],
    'Educación y Otros': ['UNAP', 'U_San_Juan_Bautista', 'EPSEL']
};

function getSector(nombre) {
    for (const [sector, keywords] of Object.entries(sectorMapping)) {
        if (keywords.some(k => nombre.toLowerCase().includes(k.toLowerCase()))) {
            return sector;
        }
    }
    return 'Otros';
}

async function sync() {
    console.log('Iniciando sincronización con SECTORES...');
    const workbook = XLSX.readFile(filePath);
    const baseSheet = workbook.Sheets['Base'];
    const baseData = XLSX.utils.sheet_to_json(baseSheet);
    
    for (const row of baseData) {
        const nombreConv = row['Convenio'];
        if (!nombreConv) continue;

        const sector = getSector(nombreConv);
        console.log(`Convenio: ${nombreConv} -> Sector: ${sector}`);
        
        await prisma.convenio.upsert({
            where: { nombre: nombreConv },
            update: {
                sector,
                rci_default: row['%RCI'] || 0.5,
                periodo_gracia: row['Periodo de Gracia'] || 0,
                variables_reserva: row['Reserva'] || 0
            },
            create: {
                nombre: nombreConv,
                sector,
                rci_default: row['%RCI'] || 0.5,
                periodo_gracia: row['Periodo de Gracia'] || 0,
                variables_reserva: row['Reserva'] || 0
            }
        });
    }
    console.log('Sincronización de sectores terminada.');
}

sync().catch(console.error).finally(() => prisma.$disconnect());
