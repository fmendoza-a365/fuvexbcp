import { prisma } from '../db';
import { ACTIVE_ESTADOS, getEstadoLabel } from '../middleware/validate';
import { getHierarchyChain } from './hierarchy';
import { getSlaInfo, SlaLevel } from './sla';
import { sendPushNotifications } from './push';
import { logger } from './logger';

const ALERT_LEVELS = new Set<SlaLevel>(['POR_VENCER', 'VENCIDO', 'CRITICO']);
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_REPEAT_MINUTES = 240;
const DEFAULT_INITIAL_DELAY_SECONDS = 60;

const sentAlerts = new Map<string, number>();
let timer: NodeJS.Timeout | null = null;
let running = false;

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const shouldSendAlert = (key: string, repeatMs: number) => {
  const lastSent = sentAlerts.get(key);
  return !lastSent || Date.now() - lastSent >= repeatMs;
};

const markAlertSent = (key: string) => {
  sentAlerts.set(key, Date.now());
};

const cleanupAlertMemory = (repeatMs: number) => {
  const maxAge = repeatMs * 2;
  const now = Date.now();
  for (const [key, timestamp] of sentAlerts.entries()) {
    if (now - timestamp > maxAge) {
      sentAlerts.delete(key);
    }
  }
};

const getCriticalWatchers = async () => {
  const users = await prisma.user.findMany({
    where: {
      activo: true,
      role: { in: ['SUPERADMIN', 'GERENTE'] },
      push_token: { not: null }
    },
    select: { id: true }
  });
  return users.map((user) => user.id);
};

const getTitle = (level: SlaLevel) => {
  if (level === 'CRITICO') return 'SLA critico';
  if (level === 'VENCIDO') return 'SLA vencido';
  return 'SLA por vencer';
};

export async function runSlaPushSweep() {
  if (running) return;
  running = true;

  const repeatMinutes = parsePositiveNumber(process.env.PUSH_SLA_REPEAT_MINUTES, DEFAULT_REPEAT_MINUTES);
  const repeatMs = repeatMinutes * 60 * 1000;
  const now = new Date();

  try {
    cleanupAlertMemory(repeatMs);

    const sales = await prisma.sale.findMany({
      where: {
        estado: { in: ACTIVE_ESTADOS as unknown as string[] }
      },
      select: {
        id: true,
        estado: true,
        fecha_estado_desde: true,
        created_at: true,
        nombres_cliente: true,
        dni_cliente: true,
        asesor_id: true,
        asesor: {
          select: {
            nombre: true,
            username: true
          }
        }
      },
      orderBy: [
        { fecha_estado_desde: 'asc' },
        { created_at: 'asc' }
      ],
      take: 250
    });

    const criticalWatchers = await getCriticalWatchers();
    let sent = 0;

    for (const sale of sales) {
      const sla = getSlaInfo(sale.estado, sale.fecha_estado_desde || sale.created_at, now);
      if (!ALERT_LEVELS.has(sla.nivel)) continue;

      const alertKey = `${sale.id}:${sla.nivel}`;
      if (!shouldSendAlert(alertKey, repeatMs)) continue;

      const hierarchyIds = await getHierarchyChain(sale.asesor_id);
      const targetIds = sla.nivel === 'CRITICO'
        ? [sale.asesor_id, ...hierarchyIds, ...criticalWatchers]
        : [sale.asesor_id, ...hierarchyIds];

      const estadoLabel = getEstadoLabel(sale.estado);
      const asesorName = sale.asesor?.nombre || sale.asesor?.username || 'Sin asesor';
      const body = `${sale.nombres_cliente} (${estadoLabel}): ${sla.siguiente_accion || 'Revisar expediente'}. Responsable: ${asesorName}.`;

      const result = await sendPushNotifications(
        targetIds,
        getTitle(sla.nivel),
        body,
        {
          type: 'SLA_ALERT',
          screen: 'sale',
          saleId: sale.id,
          level: sla.nivel,
          estado: sale.estado
        }
      );

      if (result.sent > 0) {
        markAlertSent(alertKey);
        sent += result.sent;
      }
    }

    if (sent > 0) {
      logger.info('PUSH_SCHEDULER', `Alertas SLA enviadas: ${sent}`);
    }
  } catch (error) {
    logger.error('PUSH_SCHEDULER', 'Error ejecutando barrido SLA push', { error });
  } finally {
    running = false;
  }
}

export function startPushNotificationScheduler() {
  if (process.env.PUSH_SLA_ENABLED === 'false') {
    logger.info('PUSH_SCHEDULER', 'Scheduler SLA push desactivado por configuracion');
    return;
  }

  if (timer) return;

  const intervalMinutes = parsePositiveNumber(process.env.PUSH_SLA_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES);
  const initialDelaySeconds = parsePositiveNumber(
    process.env.PUSH_SLA_INITIAL_DELAY_SECONDS,
    DEFAULT_INITIAL_DELAY_SECONDS
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  logger.info('PUSH_SCHEDULER', `Scheduler SLA push activo cada ${intervalMinutes} min`);

  setTimeout(() => {
    runSlaPushSweep();
  }, initialDelaySeconds * 1000);

  timer = setInterval(runSlaPushSweep, intervalMs);
}
