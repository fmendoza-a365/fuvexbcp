import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

// GET all zones (Todos los usuarios autenticados pueden ver la lista de zonas)
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(zones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
});

// CREATE Zone (Solo SUPERADMIN y GERENTE)
router.post('/', authMiddleware, authorize('SUPERADMIN', 'GERENTE'), async (req: any, res: any) => {
  try {
    const { nombre, departamento, provincia, distrito, ubigeo } = req.body;

    const zone = await prisma.zone.create({
      data: { nombre, departamento, provincia, distrito, ubigeo }
    });

    res.status(201).json(zone);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear zona' });
  }
});

// UPDATE Zone (Solo SUPERADMIN y GERENTE)
router.put('/:id', authMiddleware, authorize('SUPERADMIN', 'GERENTE'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nombre, departamento, provincia, distrito, ubigeo } = req.body;

    const zone = await prisma.zone.update({
      where: { id },
      data: { nombre, departamento, provincia, distrito, ubigeo }
    });

    res.json(zone);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar zona' });
  }
});

export default router;
