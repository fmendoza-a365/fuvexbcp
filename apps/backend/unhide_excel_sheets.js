const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join('..', '..', 'Recursos', 'Nuevo simulador Convenios 14.04.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    
    // 1. Hacer todas las hojas visibles
    if (workbook.Workbook && workbook.Workbook.Sheets) {
        workbook.Workbook.Sheets.forEach(s => {
            console.log(`Haciendo visible la hoja: ${s.name}`);
            s.Hidden = 0; // 0 = Visible
        });
    }

    // 2. Guardar los cambios en el archivo original
    XLSX.writeFile(workbook, filePath);
    
    console.log('--- ÉXITO: El Excel ha sido modificado ---');
    console.log('Ahora todas las hojas (Base, Cargos, etc.) son visibles.');
} catch (error) {
    console.error('Error al modificar el Excel:', error.message);
}
