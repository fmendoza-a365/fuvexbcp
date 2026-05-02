const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Base'];
    // Convertir a JSON con todos los datos
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('--- CONTENIDO COMPLETO DE LA HOJA OCULTA "BASE" ---');
    data.forEach((row, index) => {
        // Mostrar solo filas con datos
        if (row.length > 0) {
            console.log(`Fila ${index}:`, row);
        }
    });
} catch (error) {
    console.error('Error:', error.message);
}
