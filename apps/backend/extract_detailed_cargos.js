const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Cargos'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const detailedMapping = {};
    const headers = data[0];
    
    headers.forEach((cell, colIndex) => {
        if (cell && typeof cell === 'string' && !cell.startsWith('Bonificación') && cell !== 'Remuneración Consolidada') {
            const convenio = cell;
            detailedMapping[convenio] = [];
            
            for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
                const row = data[rowIndex];
                const cargo = row[colIndex];
                if (cargo && typeof cargo === 'string') {
                    detailedMapping[convenio].push({
                        perfil: cargo,
                        remuneracion: row[colIndex + 1] || 0,
                        bonos: [row[colIndex + 2], row[colIndex + 3]].filter(b => b && typeof b === 'number')
                    });
                }
            }
        }
    });

    console.log(JSON.stringify(detailedMapping, null, 2));
} catch (error) {
    console.error('Error:', error.message);
}
