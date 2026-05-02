import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { getSubordinateIds } from '../services/hierarchy';

const router = Router();

// GET Goals for subordinates
router.get('/', authMiddleware, authorize('JEFE_ZONAL', 'GERENTE', 'SUPERADMIN'), async (req: any, res: any) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    let usersToFetch: string[] = [];

    if (req.user.role === 'GERENTE' || req.user.role === 'SUPERADMIN') {
      // Gerentes see all users with roles that can have goals
      const allUsers = await prisma.user.findMany({
        where: { role: { in: ['VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL'] }, activo: true },
        select: { id: true }
      });
      usersToFetch = allUsers.map(u => u.id);
    } else {
      // Jefe Zonal see their subordinates
      usersToFetch = await getSubordinateIds(req.user.id);
    }

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

    const result = usersWithInfo.map(user => {
      const goal = goals.find(g => g.user_id === user.id);
      return {
        user_id: user.id,
        nombre: user.nombre,
        role: user.role,
        username: user.username,
        amount: goal?.amount || 0,
        goal_id: goal?.id || null
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
    const { user_id, amount, month, year } = req.body;

    if (!user_id || amount === undefined || !month || !year) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Security check: JEFE_ZONAL can only set goals for their subordinates
    if (req.user.role === 'JEFE_ZONAL') {
      const subs = await getSubordinateIds(req.user.id);
      if (!subs.includes(user_id)) {
        return res.status(403).json({ error: 'No tienes permiso para asignar metas a este usuario' });
      }
    }

    const goal = await prisma.goal.upsert({
      where: {
        user_id_month_year: {
          user_id,
          month,
          year
        }
      },
      update: { amount: parseFloat(amount) },
      create: {
        user_id,
        amount: parseFloat(amount),
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
