import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { createUserHandler, getUserByIdHandler } from '../controllers/user.controller';
import { updateUserSchema } from '../schemas/user.schema';

const router = Router();

// GET /api/users - List users (Protected)
router.get('/', requireAuth, (req: Request, res: Response) => {
  return res.json([{ id: 'user_1', name: 'Alice' }]);
});

// POST /api/users - Create user (Protected, External Handler & Schema)
router.post('/', requireAuth, createUserHandler);

// GET /api/users/:id - Get user by ID (Public, Path param, External Handler)
router.get('/:id', getUserByIdHandler);

// PUT /api/users/:id - Update user (Protected, Path param, Inline Handler & Schema)
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const data = updateUserSchema.parse(req.body);
  return res.json({ id: req.params.id, ...data });
});

// DELETE /api/users/:id - Delete user (Protected, Path param)
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  return res.status(204).send();
});

export default router;
