const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    workbook.Workbook.Sheets.forEach(s => {
        console.log(`Hoja: ${s.name} | Visibilidad: ${s.Hidden === 0 ? 'Visible' : (s.Hidden === 1 ? 'Oculta' : 'Muy Oculta')}`);
    });
} catch (error) {
    console.error('Error:', error.message);
}
