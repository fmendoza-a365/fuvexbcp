import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

export const firstExistingPath = (candidates: string[]) => {
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
};

export const expedientesPath = firstExistingPath([
  process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : '',
  path.resolve(__dirname, '../../../storage/expedientes'),
  path.resolve(__dirname, '../../../../storage/expedientes'),
  path.resolve(process.cwd(), 'storage/expedientes'),
  path.resolve(process.cwd(), '../../storage/expedientes')
].filter(Boolean));

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

type StorageProvider = 'local' | 's3';

type StoredDocumentRecord = {
  file_path: string;
  original_name?: string | null;
  mime_type?: string | null;
  storage_provider?: string | null;
  storage_key?: string | null;
};

export type StoredUpload = {
  filePath: string;
  storageProvider: StorageProvider;
  storageKey: string;
  checksumSha256: string;
};

const getStorageProvider = (): StorageProvider => (
  process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local'
);

const sanitizeSegment = (value: string) => (
  value.replace(/[^0-9a-zA-Z_.-]/g, '_').slice(0, 120) || 'sin-dato'
);

const getRelativeStorageKey = (filePath: string, dniCliente: string) => {
  const normalizedFilePath = path.normalize(filePath);
  const relative = path.relative(expedientesPath, normalizedFilePath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, '/');
  }
  return `${sanitizeSegment(dniCliente)}/${sanitizeSegment(path.basename(filePath))}`;
};

let s3Client: S3Client | null = null;

const getS3Config = () => {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Storage S3 no configurado. Revisa S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY.');
  }

  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
};

const getS3Client = () => {
  if (!s3Client) {
    const config = getS3Config();
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }
  return s3Client;
};

export async function storeUploadedDocument(file: Express.Multer.File, dniCliente: string): Promise<StoredUpload> {
  const fileBuffer = await fs.promises.readFile(file.path);
  const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const storageKey = getRelativeStorageKey(file.path, dniCliente);

  if (getStorageProvider() === 's3') {
    const config = getS3Config();
    await getS3Client().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: file.mimetype,
      Metadata: {
        checksum_sha256: checksumSha256,
        original_name: encodeURIComponent(file.originalname || path.basename(file.path))
      }
    }));

    await fs.promises.unlink(file.path).catch(() => undefined);

    return {
      filePath: `s3://${config.bucket}/${storageKey}`,
      storageProvider: 's3',
      storageKey,
      checksumSha256
    };
  }

  return {
    filePath: file.path,
    storageProvider: 'local',
    storageKey,
    checksumSha256
  };
}

const responseFilename = (document: StoredDocumentRecord) => (
  sanitizeSegment(document.original_name || path.basename(document.file_path) || 'documento')
);

export async function sendStoredDocument(
  res: Response,
  document: StoredDocumentRecord,
  dniCliente: string,
  download = false
): Promise<boolean> {
  const filename = responseFilename(document);

  if ((document.storage_provider || 'local') === 's3') {
    const config = getS3Config();
    const storageKey = document.storage_key;
    if (!storageKey) return false;

    const object = await getS3Client().send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey
    }));

    res.setHeader('Content-Type', document.mime_type || object.ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);

    const body = object.Body as any;
    if (body && typeof body.pipe === 'function') {
      body.pipe(res);
      return true;
    }

    if (body && typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      res.send(Buffer.from(bytes));
      return true;
    }

    return false;
  }

  const filePath = resolveExpedienteDocumentPath(document.file_path, dniCliente);
  if (!filePath) return false;

  if (download) {
    res.download(filePath, filename);
    return true;
  }

  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.sendFile(filePath);
  return true;
}

export async function storeDocumentFromBuffer(
  buffer: Buffer,
  filename: string,
  dniCliente: string,
  mimeType: string
): Promise<StoredUpload> {
  const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storageKey = `${sanitizeSegment(dniCliente)}/${sanitizeSegment(filename)}`;

  if (getStorageProvider() === 's3') {
    const config = getS3Config();
    await getS3Client().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        checksum_sha256: checksumSha256,
        original_name: encodeURIComponent(filename)
      }
    }));

    return {
      filePath: `s3://${config.bucket}/${storageKey}`,
      storageProvider: 's3',
      storageKey,
      checksumSha256
    };
  }

  // Local storage: write directly to expedientesPath/dniCliente/filename
  const targetDir = path.join(expedientesPath, sanitizeSegment(dniCliente));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, sanitizeSegment(filename));
  await fs.promises.writeFile(targetPath, buffer);

  return {
    filePath: targetPath,
    storageProvider: 'local',
    storageKey,
    checksumSha256
  };
}
