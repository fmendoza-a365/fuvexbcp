const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Cargos'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // El Excel tiene convenios en los encabezados de columnas (Col 0, 4, 9, 13, 15, etc.)
    const mapping = {};
    const headers = data[0];
    
    headers.forEach((cell, index) => {
        if (cell && typeof cell === 'string' && !cell.startsWith('Bonificación') && cell !== 'Remuneración Consolidada') {
            const convenio = cell;
            mapping[convenio] = [];
            
            // Buscar cargos en las filas de abajo para esta columna
            for (let i = 1; i < data.length; i++) {
                const cargo = data[i][index];
                if (cargo && typeof cargo === 'string') {
                    mapping[convenio].push(cargo);
                }
            }
        }
    });

    console.log(JSON.stringify(mapping, null, 2));
} catch (error) {
    console.error('Error:', error.message);
}
