const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Cargos'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('--- Muestra de datos de la hoja Cargos (Filas 1-5) ---');
    data.slice(0, 5).forEach((row, i) => {
        console.log(`Fila ${i}:`, row.slice(0, 15)); // Ver las primeras 15 columnas
    });
} catch (error) {
    console.error('Error:', error.message);
}
