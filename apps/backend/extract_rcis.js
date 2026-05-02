const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Base'];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const rciMapping = data.map(row => ({
        convenio: row['Convenio'],
        rci: row['%RCI'] ? (row['%RCI'] * 100).toFixed(0) + '%' : 'N/A',
        gracia: row['Periodo de Gracia'] || 0
    }));

    console.log(JSON.stringify(rciMapping, null, 2));
} catch (error) {
    console.error('Error:', error.message);
}
