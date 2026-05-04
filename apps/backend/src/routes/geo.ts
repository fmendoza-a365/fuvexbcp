import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

type Departamento = { id: number; departamento: string; ubigeo: string };
type Provincia = { id: number; provincia: string; ubigeo: string; departamento_id: number };
type Distrito = { id: number; distrito: string; ubigeo: string; provincia_id: number; departamento_id: number };

type GeoDataset = {
  departamentos: Departamento[];
  provincias: Provincia[];
  distritos: Distrito[];
  source: 'remote' | 'fallback';
  loadedAt: number;
};

const DATASET_URLS = {
  departamentos: 'https://raw.githubusercontent.com/RitchieRD/ubigeos-peru-data/main/json/1_ubigeo_departamentos.json',
  provincias: 'https://raw.githubusercontent.com/RitchieRD/ubigeos-peru-data/main/json/2_ubigeo_provincias.json',
  distritos: 'https://raw.githubusercontent.com/RitchieRD/ubigeos-peru-data/main/json/3_ubigeo_distritos.json'
};

const FALLBACK_DEPARTAMENTOS: Departamento[] = [
  { id: 1, departamento: 'AMAZONAS', ubigeo: '01' },
  { id: 2, departamento: 'ANCASH', ubigeo: '02' },
  { id: 3, departamento: 'APURIMAC', ubigeo: '03' },
  { id: 4, departamento: 'AREQUIPA', ubigeo: '04' },
  { id: 5, departamento: 'AYACUCHO', ubigeo: '05' },
  { id: 6, departamento: 'CAJAMARCA', ubigeo: '06' },
  { id: 7, departamento: 'CALLAO', ubigeo: '07' },
  { id: 8, departamento: 'CUSCO', ubigeo: '08' },
  { id: 9, departamento: 'HUANCAVELICA', ubigeo: '09' },
  { id: 10, departamento: 'HUANUCO', ubigeo: '10' },
  { id: 11, departamento: 'ICA', ubigeo: '11' },
  { id: 12, departamento: 'JUNIN', ubigeo: '12' },
  { id: 13, departamento: 'LA LIBERTAD', ubigeo: '13' },
  { id: 14, departamento: 'LAMBAYEQUE', ubigeo: '14' },
  { id: 15, departamento: 'LIMA', ubigeo: '15' },
  { id: 16, departamento: 'LORETO', ubigeo: '16' },
  { id: 17, departamento: 'MADRE DE DIOS', ubigeo: '17' },
  { id: 18, departamento: 'MOQUEGUA', ubigeo: '18' },
  { id: 19, departamento: 'PASCO', ubigeo: '19' },
  { id: 20, departamento: 'PIURA', ubigeo: '20' },
  { id: 21, departamento: 'PUNO', ubigeo: '21' },
  { id: 22, departamento: 'SAN MARTIN', ubigeo: '22' },
  { id: 23, departamento: 'TACNA', ubigeo: '23' },
  { id: 24, departamento: 'TUMBES', ubigeo: '24' },
  { id: 25, departamento: 'UCAYALI', ubigeo: '25' }
];

const FALLBACK_PROVINCIAS: Provincia[] = [
  { id: 1, provincia: 'LIMA', ubigeo: '1501', departamento_id: 15 },
  { id: 2, provincia: 'CALLAO', ubigeo: '0701', departamento_id: 7 }
];

const FALLBACK_DISTRITOS: Distrito[] = [
  { id: 1, distrito: 'LIMA', ubigeo: '150101', provincia_id: 1, departamento_id: 15 },
  { id: 2, distrito: 'ANCON', ubigeo: '150102', provincia_id: 1, departamento_id: 15 },
  { id: 3, distrito: 'ATE', ubigeo: '150103', provincia_id: 1, departamento_id: 15 },
  { id: 4, distrito: 'BARRANCO', ubigeo: '150104', provincia_id: 1, departamento_id: 15 },
  { id: 5, distrito: 'BRENA', ubigeo: '150105', provincia_id: 1, departamento_id: 15 },
  { id: 6, distrito: 'COMAS', ubigeo: '150110', provincia_id: 1, departamento_id: 15 },
  { id: 7, distrito: 'INDEPENDENCIA', ubigeo: '150112', provincia_id: 1, departamento_id: 15 },
  { id: 8, distrito: 'LOS OLIVOS', ubigeo: '150117', provincia_id: 1, departamento_id: 15 },
  { id: 9, distrito: 'MIRAFLORES', ubigeo: '150122', provincia_id: 1, departamento_id: 15 },
  { id: 10, distrito: 'SAN ISIDRO', ubigeo: '150131', provincia_id: 1, departamento_id: 15 },
  { id: 11, distrito: 'SAN MARTIN DE PORRES', ubigeo: '150135', provincia_id: 1, departamento_id: 15 },
  { id: 12, distrito: 'CALLAO', ubigeo: '070101', provincia_id: 2, departamento_id: 7 }
];

let cache: GeoDataset | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const fallbackDataset = (): GeoDataset => ({
  departamentos: FALLBACK_DEPARTAMENTOS,
  provincias: FALLBACK_PROVINCIAS,
  distritos: FALLBACK_DISTRITOS,
  source: 'fallback',
  loadedAt: Date.now()
});

async function fetchJsonArray<T>(url: string, key: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Geo dataset ${key} respondio ${response.status}`);
  const payload = await response.json() as Record<string, T[]>;
  const rows = payload[key];
  return Array.isArray(rows) ? rows : [];
}

async function getDataset(): Promise<GeoDataset> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  try {
    const [departamentos, provincias, distritos] = await Promise.all([
      fetchJsonArray<Departamento>(DATASET_URLS.departamentos, 'ubigeo_departamentos'),
      fetchJsonArray<Provincia>(DATASET_URLS.provincias, 'ubigeo_provincias'),
      fetchJsonArray<Distrito>(DATASET_URLS.distritos, 'ubigeo_distritos')
    ]);

    cache = { departamentos, provincias, distritos, source: 'remote', loadedAt: Date.now() };
  } catch (error) {
    console.warn('[GEO] No se pudo cargar UBIGEO remoto. Usando fallback local.', error);
    cache = fallbackDataset();
  }

  return cache;
}

router.get('/departamentos', authMiddleware, async (_req, res, next) => {
  try {
    const data = await getDataset();
    res.json({ data: data.departamentos, source: data.source });
  } catch (error) {
    next(error);
  }
});

router.get('/provincias', authMiddleware, async (req, res, next) => {
  try {
    const data = await getDataset();
    let departamentoId = Number(req.query.departamento_id);

    if (!departamentoId && req.query.departamento) {
      const dept = data.departamentos.find(d => normalize(d.departamento) === normalize(req.query.departamento));
      departamentoId = dept?.id || 0;
    }

    const provincias = departamentoId
      ? data.provincias.filter(p => p.departamento_id === departamentoId)
      : data.provincias;

    res.json({ data: provincias, source: data.source });
  } catch (error) {
    next(error);
  }
});

router.get('/distritos', authMiddleware, async (req, res, next) => {
  try {
    const data = await getDataset();
    let departamentoId = Number(req.query.departamento_id);
    let provinciaId = Number(req.query.provincia_id);

    if (!departamentoId && req.query.departamento) {
      const dept = data.departamentos.find(d => normalize(d.departamento) === normalize(req.query.departamento));
      departamentoId = dept?.id || 0;
    }

    if (!provinciaId && req.query.provincia) {
      const province = data.provincias.find(p => (
        normalize(p.provincia) === normalize(req.query.provincia) &&
        (!departamentoId || p.departamento_id === departamentoId)
      ));
      provinciaId = province?.id || 0;
    }

    const distritos = data.distritos.filter(d => (
      (!departamentoId || d.departamento_id === departamentoId) &&
      (!provinciaId || d.provincia_id === provinciaId)
    ));

    res.json({ data: distritos, source: data.source });
  } catch (error) {
    next(error);
  }
});

export default router;
