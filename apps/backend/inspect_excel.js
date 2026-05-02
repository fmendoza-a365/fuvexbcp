const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Hojas encontradas:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n--- Previsualización de Hoja: ${sheetName} ---`);
        console.log('Primeras 3 filas:', data.slice(0, 3));
    });
} catch (error) {
    console.error('Error al leer el Excel:', error.message);
}
