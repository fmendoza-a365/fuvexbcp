const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

async function sync() {
    console.log('Iniciando sincronización masiva...');
    const workbook = XLSX.readFile(filePath);
    
    // 1. Cargar Hoja Base (Convenios y RCIs)
    const baseSheet = workbook.Sheets['Base'];
    const baseData = XLSX.utils.sheet_to_json(baseSheet);
    
    // 2. Cargar Hoja Cargos (Mapeo)
    const cargoSheet = workbook.Sheets['Cargos'];
    const cargoData = XLSX.utils.sheet_to_json(cargoSheet, { header: 1 });
    
    // Limpiar datos previos de simulación para evitar conflictos de llaves foráneas si es necesario
    // Pero mejor hacemos upserts
    
    for (const row of baseData) {
        const nombreConv = row['Convenio'];
        if (!nombreConv) continue;

        console.log(`Procesando convenio: ${nombreConv}`);
        
        const convenio = await prisma.convenio.upsert({
            where: { nombre: nombreConv },
            update: {
                rci_default: row['%RCI'] || 0.5,
                periodo_gracia: row['Periodo de Gracia'] || 0,
                variables_reserva: row['Reserva'] || 0
            },
            create: {
                nombre: nombreConv,
                rci_default: row['%RCI'] || 0.5,
                periodo_gracia: row['Periodo de Gracia'] || 0,
                variables_reserva: row['Reserva'] || 0
            }
        });

        // Buscar cargos para este convenio en la hoja Cargos
        const headers = cargoData[0];
        const colIndex = headers.indexOf(nombreConv);
        
        if (colIndex !== -1) {
            for (let i = 1; i < cargoData.length; i++) {
                const nombreCargo = cargoData[i][colIndex];
                if (nombreCargo && typeof nombreCargo === 'string') {
                    const cargo = await prisma.cargo.upsert({
                        where: { nombre: nombreCargo },
                        update: {},
                        create: { nombre: nombreCargo }
                    });

                    // Crear la regla de relación
                    await prisma.convenioCargoRegla.upsert({
                        where: {
                            convenio_id_cargo_id: {
                                convenio_id: convenio.id,
                                cargo_id: cargo.id
                            }
                        },
                        update: {
                            rci_especifico: row['%RCI'] || 0.5 // Por ahora usamos el RCI base del convenio
                        },
                        create: {
                            convenio_id: convenio.id,
                            cargo_id: cargo.id,
                            rci_especifico: row['%RCI'] || 0.5
                        }
                    });
                }
            }
        }
    }

    console.log('--- SINCRONIZACIÓN COMPLETADA CON ÉXITO ---');
}

sync()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
