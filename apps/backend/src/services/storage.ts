import fs from 'fs';
import path from 'path';

export const firstExistingPath = (candidates: string[]) => {
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
};

export const expedientesPath = firstExistingPath([
  path.resolve(__dirname, '../../../storage/expedientes'),
  path.resolve(__dirname, '../../../../storage/expedientes'),
  path.resolve(process.cwd(), 'storage/expedientes'),
  path.resolve(process.cwd(), '../../storage/expedientes')
]);

export const publicDownloadsPath = firstExistingPath([
  path.resolve(process.cwd(), 'storage/public'),
  path.resolve(process.cwd(), '../../storage/public'),
  path.resolve(__dirname, '../../../storage/public'),
  path.resolve(__dirname, '../../../../storage/public')
]);

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveExpedienteDocumentPath(storedPath: string, dniCliente: string): string | null {
  const filename = path.basename(storedPath);
  const candidates = [
    path.isAbsolute(storedPath) ? storedPath : path.resolve(process.cwd(), storedPath),
    path.join(expedientesPath, dniCliente, filename)
  ].map(candidate => path.normalize(candidate));

  return candidates.find(candidate => fs.existsSync(candidate) && isInside(expedientesPath, candidate)) || null;
}
