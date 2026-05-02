import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import bcrypt from 'bcryptjs';
import { getSubordinateIds, getHierarchyChain } from '../services/hierarchy';
import { validateCreateUser } from '../middleware/validate';

const router = Router();

// GET all users (Filtered by role permissions)
router.get('/', authMiddleware, authorize('SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'BACK_OFFICE', 'ANALISTA'), async (req: any, res: any) => {
  try {
    let whereClause: any = {};
    
    // JEFE_ZONAL can only see users in their zone
    if (req.user.role === 'JEFE_ZONAL') {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (currentUser?.zone_id) {
        whereClause.zone_id = currentUser.zone_id;
      } else {
        // If they don't have a zone, they see nobody but themselves
        whereClause.id = req.user.id;
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        nombre: true,
        role: true,
        activo: true,
        zone_id: true,
        supervisor_id: true,
        created_at: true,
        zone: true,
        supervisor: { select: { nombre: true, username: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET direct team (Subordinados directos)
router.get('/team', authMiddleware, async (req: any, res: any) => {
  try {
    const team = await prisma.user.findMany({
      where: { supervisor_id: req.user.id },
      select: {
        id: true,
        username: true,
        nombre: true,
        role: true,
        activo: true,
        zone: true
      }
    });
    res.json(team);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// CREATE User (Solo SUPERADMIN y JEFE_ZONAL)
router.post('/', authMiddleware, authorize('SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'), validateCreateUser, async (req: any, res: any) => {
  try {
    const { username, nombre, password, role, zone_id, supervisor_id } = req.body;

    // Validation for JEFE_ZONAL: can only create VENDEDOR and SUPERVISOR in their own zone
    if (req.user.role === 'JEFE_ZONAL') {
      if (!['VENDEDOR', 'SUPERVISOR'].includes(role)) {
        return res.status(403).json({ error: 'Solo puedes crear roles Vendedor o Supervisor' });
      }
      
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (zone_id !== currentUser?.zone_id) {
        return res.status(403).json({ error: 'Solo puedes asignar usuarios a tu propia zona' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        nombre,
        password_hash,
        role,
        zone_id,
        supervisor_id
      },
      select: { id: true, username: true, nombre: true, role: true }
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// GET current user profile
router.get('/me', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        telefono: true,
        avatar_url: true,
        role: true,
        activo: true,
        zone: true,
        supervisor: { select: { nombre: true, username: true } }
      }
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// UPDATE current user profile
router.put('/me', authMiddleware, async (req: any, res: any) => {
  try {
    const { nombre, email, telefono, avatar_url, password } = req.body;
    
    const data: any = {};
    if (nombre) data.nombre = nombre;
    if (email !== undefined) data.email = email;
    if (telefono !== undefined) data.telefono = telefono;
    if (avatar_url !== undefined) data.avatar_url = avatar_url;
    
    if (password) {
      data.password_hash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        telefono: true,
        avatar_url: true,
        role: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// UPDATE push token
router.post('/push-token', authMiddleware, async (req: any, res: any) => {
  try {
    const { push_token } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { push_token }
    });
    res.json({ message: 'Token actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar token de notificación' });
  }
});

// UPDATE User (SUPERADMIN, GERENTE) y JEFE_ZONAL (solo su equipo)
router.put('/:id', authMiddleware, authorize('SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nombre, password, role, zone_id, supervisor_id, activo } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Validation for JEFE_ZONAL
    if (req.user.role === 'JEFE_ZONAL') {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (targetUser.zone_id !== currentUser?.zone_id) {
        return res.status(403).json({ error: 'Solo puedes editar usuarios de tu zona' });
      }
      if (role && !['VENDEDOR', 'SUPERVISOR'].includes(role)) {
        return res.status(403).json({ error: 'No puedes cambiar a roles superiores' });
      }
    }

    const data: any = {};
    if (nombre) data.nombre = nombre;
    if (role) data.role = role;
    if (zone_id !== undefined) data.zone_id = zone_id;
    if (supervisor_id !== undefined) data.supervisor_id = supervisor_id;
    if (activo !== undefined) data.activo = activo;
    
    if (password) {
      data.password_hash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, nombre: true, role: true, activo: true }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

export default router;
