const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath, { cellFormula: true });
    const sheet = workbook.Sheets['Cáratula'];
    
    // Buscar celdas clave según la imagen
    // El CEM parece estar en una celda específica, igual que el Dictamen
    console.log('--- ANALIZANDO FÓRMULAS DE EVALUACIÓN ---');
    
    // Vamos a recorrer un rango probable de la carátula
    for (let R = 0; R < 60; ++R) {
        for (let C = 0; C < 20; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = sheet[cellRef];
            if (cell && cell.f) {
                console.log(`${cellRef}: ${cell.f} (Valor actual: ${cell.v})`);
            } else if (cell && cell.v) {
                // También ver etiquetas para orientarnos
                if (typeof cell.v === 'string' && (cell.v.includes('CEM') || cell.v.includes('Dictamen') || cell.v.includes('Endeudamiento'))) {
                    console.log(`ETIQUETA EN ${cellRef}: ${cell.v}`);
                }
            }
        }
    }
} catch (error) {
    console.error('Error:', error.message);
}
