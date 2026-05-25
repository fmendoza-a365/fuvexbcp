import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import {
  PDF_TEMPLATE_FIELD_OPTIONS,
  buildDefaultPdfMapping,
  extractPdfTemplateFields,
  getNextPdfTemplateVersion,
  parsePdfTemplateJson,
  storePdfTemplateBuffer
} from '../services/pdfTemplates';

const router = Router();
const ADMIN_ROLES = ['SUPERADMIN', 'GERENTE', 'BACK_OFFICE'] as const;

const uploadPdfTemplate = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      cb(new Error('Solo se aceptan archivos PDF.'));
      return;
    }
    cb(null, true);
  }
});

function requireTemplateAdmin(req: any, res: any, next: any) {
  return authorize(...ADMIN_ROLES)(req, res, next);
}

function parseMappings(input: any) {
  if (!input) return {};
  if (typeof input === 'string') return parsePdfTemplateJson<Record<string, string>>(input, {});
  if (typeof input === 'object' && !Array.isArray(input)) return input as Record<string, string>;
  return {};
}

function serializeTemplate(template: any) {
  return {
    ...template,
    fields: parsePdfTemplateJson(template.fields_json, []),
    mappings: parsePdfTemplateJson(template.mappings_json, {})
  };
}

router.get('/field-options', authMiddleware, requireTemplateAdmin, (_req, res) => {
  res.json(PDF_TEMPLATE_FIELD_OPTIONS);
});

router.get('/', authMiddleware, requireTemplateAdmin, async (req, res) => {
  try {
    const convenio = String(req.query.convenio || '').trim();
    const templates = await prisma.pdfTemplate.findMany({
      where: convenio ? { convenio } : undefined,
      include: { creator: { select: { id: true, username: true, nombre: true } } },
      orderBy: [{ convenio: 'asc' }, { version: 'desc' }]
    });

    res.json(templates.map(serializeTemplate));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener plantillas PDF' });
  }
});

router.post('/', authMiddleware, requireTemplateAdmin, uploadPdfTemplate.single('pdf'), async (req: any, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const convenio = String(req.body.convenio || '').trim();

    if (!nombre || !convenio) {
      return res.status(400).json({ error: 'Nombre y convenio son obligatorios.' });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Debes subir un archivo PDF.' });
    }

    const fields = await extractPdfTemplateFields(req.file.buffer);
    const version = await getNextPdfTemplateVersion(convenio);
    const stored = await storePdfTemplateBuffer(req.file.buffer, convenio, version, req.file.originalname || 'plantilla.pdf');
    const defaultMappings = buildDefaultPdfMapping(fields);
    const requestedMappings = parseMappings(req.body.mappings_json || req.body.mappings);
    const mappings = { ...defaultMappings, ...requestedMappings };

    const template = await prisma.$transaction(async tx => {
      await tx.pdfTemplate.updateMany({
        where: { convenio, activo: true },
        data: { activo: false }
      });

      return tx.pdfTemplate.create({
        data: {
          nombre,
          convenio,
          version,
          original_name: req.file.originalname || 'plantilla.pdf',
          file_path: stored.filePath,
          storage_provider: 'local',
          storage_key: stored.storageKey,
          fields_json: JSON.stringify(fields),
          mappings_json: JSON.stringify(mappings),
          activo: true,
          created_by: req.user.id
        },
        include: { creator: { select: { id: true, username: true, nombre: true } } }
      });
    });

    res.status(201).json(serializeTemplate(template));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error al crear plantilla PDF' });
  }
});

router.put('/:id', authMiddleware, requireTemplateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.pdfTemplate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plantilla PDF no encontrada' });
    }

    const data: any = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre || '').trim();
    if (req.body.mappings !== undefined || req.body.mappings_json !== undefined) {
      data.mappings_json = JSON.stringify(parseMappings(req.body.mappings ?? req.body.mappings_json));
    }
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    const template = await prisma.$transaction(async tx => {
      if (data.activo === true) {
        await tx.pdfTemplate.updateMany({
          where: { convenio: existing.convenio, activo: true, id: { not: id } },
          data: { activo: false }
        });
      }

      return tx.pdfTemplate.update({
        where: { id },
        data,
        include: { creator: { select: { id: true, username: true, nombre: true } } }
      });
    });

    res.json(serializeTemplate(template));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error al actualizar plantilla PDF' });
  }
});

router.delete('/:id', authMiddleware, requireTemplateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.pdfTemplate.update({
      where: { id },
      data: { activo: false },
      include: { creator: { select: { id: true, username: true, nombre: true } } }
    });
    res.json(serializeTemplate(template));
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plantilla PDF no encontrada' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al desactivar plantilla PDF' });
  }
});

export default router;
