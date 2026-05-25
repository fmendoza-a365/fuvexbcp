import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { getSubordinateIds } from '../services/hierarchy';
import { ACTIVE_ESTADOS } from '../middleware/validate';
import { endOfMonth, startOfMonth } from 'date-fns';

const router = Router();
const GOAL_ROLES = ['VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL'];

const getMonthRange = (month: number, year: number) => {
  const base = new Date(year, month - 1, 1);
  return {
    startDate: startOfMonth(base),
    endDate: endOfMonth(base),
    daysInMonth: endOfMonth(base).getDate()
  };
};

const parsePeriod = (monthValue: unknown, yearValue: unknown) => {
  const now = new Date();
  const month = Number.parseInt(String(monthValue || now.getMonth() + 1), 10);
  const year = Number.parseInt(String(yearValue || now.getFullYear()), 10);

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
    return null;
  }

  return { month, year };
};

const getAssignableUserIds = async (user: any) => {
  if (user.role === 'GERENTE' || user.role === 'SUPERADMIN') {
    const allUsers = await prisma.user.findMany({
      where: { role: { in: GOAL_ROLES }, activo: true },
      select: { id: true }
    });
    return allUsers.map((item) => item.id);
  }

  return getSubordinateIds(user.id);
};

// GET Goals for subordinates
router.get('/', authMiddleware, authorize('JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const period = parsePeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ error: 'Periodo invalido' });
    }
    const { month, year } = period;
    const { startDate, endDate, daysInMonth } = getMonthRange(month, year);
    const usersToFetch = await getAssignableUserIds(req.user);

    const goals = await prisma.goal.findMany({
      where: {
        user_id: { in: usersToFetch },
        month,
        year
      },
      include: {
        user: { select: { nombre: true, role: true, username: true } }
      }
    });

    // Also fetch users without goals to show them in the list
    const usersWithInfo = await prisma.user.findMany({
      where: { id: { in: usersToFetch } },
      select: { id: true, nombre: true, role: true, username: true }
    });

    const sales = await prisma.sale.findMany({
      where: {
        asesor_id: { in: usersToFetch },
        fecha_ingreso: { gte: startDate, lte: endDate }
      },
      select: {
        asesor_id: true,
        estado: true,
        maf_neto: true
      }
    });

    const statsByUser = new Map<string, {
      prospects: number;
      disbursedCount: number;
      disbursedAmount: number;
      pipelineCount: number;
      pipelineAmount: number;
    }>();

    for (const sale of sales) {
      const stats = statsByUser.get(sale.asesor_id) || {
        prospects: 0,
        disbursedCount: 0,
        disbursedAmount: 0,
        pipelineCount: 0,
        pipelineAmount: 0
      };
      const amount = Number(sale.maf_neto) || 0;
      stats.prospects += 1;
      if (sale.estado === 'DESEMBOLSADO') {
        stats.disbursedCount += 1;
        stats.disbursedAmount += amount;
      }
      if ((ACTIVE_ESTADOS as readonly string[]).includes(sale.estado)) {
        stats.pipelineCount += 1;
        stats.pipelineAmount += amount;
      }
      statsByUser.set(sale.asesor_id, stats);
    }

    const today = new Date();
    const elapsedDays = today.getMonth() === month - 1 && today.getFullYear() === year
      ? Math.max(today.getDate(), 1)
      : daysInMonth;

    const result = usersWithInfo.map(user => {
      const goal = goals.find(g => g.user_id === user.id);
      const amount = Number(goal?.amount || 0);
      const stats = statsByUser.get(user.id) || {
        prospects: 0,
        disbursedCount: 0,
        disbursedAmount: 0,
        pipelineCount: 0,
        pipelineAmount: 0
      };
      const projectedAmount = elapsedDays > 0 ? (stats.disbursedAmount / elapsedDays) * daysInMonth : 0;
      return {
        user_id: user.id,
        nombre: user.nombre,
        role: user.role,
        username: user.username,
        amount,
        goal_id: goal?.id || null,
        prospects_count: stats.prospects,
        disbursed_count: stats.disbursedCount,
        disbursed_amount: Math.round(stats.disbursedAmount * 100) / 100,
        pipeline_count: stats.pipelineCount,
        pipeline_amount: Math.round(stats.pipelineAmount * 100) / 100,
        projected_amount: Math.round(projectedAmount * 100) / 100,
        gap_amount: Math.max(Math.round((amount - stats.disbursedAmount) * 100) / 100, 0),
        completion_rate: amount > 0 ? Math.round((stats.disbursedAmount / amount) * 1000) / 10 : 0,
        conversion_rate: stats.prospects > 0 ? Math.round((stats.disbursedCount / stats.prospects) * 1000) / 10 : 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener metas' });
  }
});

// POST/UPDATE Goal
router.post('/', authMiddleware, authorize('JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const { user_id } = req.body;
    const period = parsePeriod(req.body.month, req.body.year);
    const amount = Number(req.body.amount);

    if (!user_id || !period || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const { month, year } = period;

    // Security check: JEFE_ZONAL can only set goals for their subordinates
    if (req.user.role === 'JEFE_ZONAL') {
      const subs = await getSubordinateIds(req.user.id);
      if (!subs.includes(user_id)) {
        return res.status(403).json({ error: 'No tienes permiso para asignar metas a este usuario' });
      }
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: user_id, activo: true, role: { in: GOAL_ROLES } },
      select: { id: true }
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no disponible para metas' });
    }

    const goal = await prisma.goal.upsert({
      where: {
        user_id_month_year: {
          user_id,
          month,
          year
        }
      },
      update: { amount },
      create: {
        user_id,
        amount,
        month,
        year
      }
    });

    res.json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar meta' });
  }
});

export default router;
