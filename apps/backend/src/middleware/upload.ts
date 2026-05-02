import multer from 'multer';
import fs from 'fs';
import path from 'path';

const firstExistingPath = (candidates: string[]) => {
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
};

// Define the root storage directory. Supports ts-node and compiled dist paths.
const rootStoragePath = firstExistingPath([
  path.resolve(__dirname, '../../../../storage/expedientes'),
  path.resolve(__dirname, '../../../../../storage/expedientes'),
  path.resolve(process.cwd(), 'storage/expedientes'),
  path.resolve(process.cwd(), '../../storage/expedientes')
]);

// SEGURIDAD: Tipos MIME permitidos
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg'
];

// SEGURIDAD: Tamaño máximo de archivo (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usamos el DNI desde query, body o params para crear la carpeta
    const rawDni = req.query.dni || req.body.dni_cliente || req.params.dni || 'sin-dni';
    // SEGURIDAD: Sanitizar DNI para prevenir path traversal
    const dni = String(rawDni).replace(/[^0-9a-zA-Z\-]/g, '');
    
    const dir = path.join(rootStoragePath, dni);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Formato: DNI_FECHA_TIPO.ext
    const rawDni = req.query.dni || req.body.dni_cliente || req.params.dni || 'sin-dni';
    const dni = String(rawDni).replace(/[^0-9a-zA-Z\-]/g, '');
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const tipo = (req.body.tipo_documento || 'DOC').replace(/[^a-zA-Z0-9]/g, '');
    const ext = path.extname(file.originalname).toLowerCase();
    
    cb(null, `${dni}_${date}_${tipo}${ext}`);
  }
});

// Filtro de archivos por tipo MIME
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan PDF e imágenes.`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Máximo 5 archivos por request
  }
});
