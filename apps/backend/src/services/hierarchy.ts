import { prisma } from '../db';

// Roles que ven todo (sin filtro jerarquico)
const GLOBAL_ROLES = ['SUPERADMIN', 'GERENTE', 'BACK_OFFICE', 'ANALISTA'];

// ── Caché de Jerarquía ─────────────────────────────
// Evita N+1 queries recursivas en cada request
const hierarchyCache = new Map<string, { ids: string[]; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

/**
 * Invalidar toda la caché de jerarquía.
 * Llamar al crear, actualizar o desactivar usuarios.
 */
export function invalidateHierarchyCache(): void {
  hierarchyCache.clear();
}

// Obtener todos los IDs de subordinados recursivamente (con caché)
export async function getSubordinateIds(userId: string): Promise<string[]> {
  // Verificar caché
  const cached = hierarchyCache.get(userId);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return cached.ids;
  }

  const directSubs = await prisma.user.findMany({
    where: { supervisor_id: userId, activo: true },
    select: { id: true }
  });

  const ids: string[] = [];
  for (const sub of directSubs) {
    ids.push(sub.id);
    const subIds = await getSubordinateIds(sub.id);
    ids.push(...subIds);
  }

  // Guardar en caché
  hierarchyCache.set(userId, { ids, ts: Date.now() });

  return ids;
}

// Generar filtro Prisma WHERE para ventas segun el rol del usuario
export async function getSalesFilter(user: { id: string; role: string }): Promise<any> {
  // Roles globales ven todo
  if (GLOBAL_ROLES.includes(user.role)) {
    return {};
  }

  // VENDEDOR solo ve sus propias ventas
  if (user.role === 'VENDEDOR') {
    return { asesor_id: user.id };
  }

  // SUPERVISOR y JEFE_ZONAL ven las de sus subordinados + las propias
  if (user.role === 'SUPERVISOR' || user.role === 'JEFE_ZONAL') {
    const subIds = await getSubordinateIds(user.id);
    return {
      asesor_id: { in: [user.id, ...subIds] }
    };
  }

  // Fallback: solo propias
  return { asesor_id: user.id };
}

// Verificar si un usuario es subordinado (directo o indirecto) de otro
export async function isSubordinateOf(userId: string, potentialBossId: string): Promise<boolean> {
  const subIds = await getSubordinateIds(potentialBossId);
  return subIds.includes(userId);
}

// Obtener la cadena jerarquica hacia arriba (supervisor -> jefe zonal -> gerente)
export async function getHierarchyChain(userId: string): Promise<string[]> {
  const chain: string[] = [];
  let currentId: string | null = userId;

  while (currentId) {
    const userData: any = await prisma.user.findUnique({
      where: { id: currentId },
      select: { supervisor_id: true }
    });
    if (userData?.supervisor_id) {
      chain.push(userData.supervisor_id);
      currentId = userData.supervisor_id;
    } else {
      currentId = null;
    }
  }

  return chain;
}

