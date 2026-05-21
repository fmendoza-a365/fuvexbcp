import { Router } from 'express';
import { getDniInfo } from '../services/dni';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/:dni', authMiddleware, async (req, res, next) => {
  try {
    const { dni } = req.params;
    if (!dni || !/^\d{8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI inválido' });
    }
    
    const result = await getDniInfo(dni);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
