import { Request, Response } from 'express';
import { createUserSchema } from '../schemas/user.schema';

export const createUserHandler = (req: Request, res: Response) => {
  const parsed = createUserSchema.parse(req.body);
  return res.status(201).json({ id: 'user_123', ...parsed });
};

export const getUserByIdHandler = (req: Request, res: Response) => {
  const { id } = req.params;
  return res.json({ id, name: 'Sample User' });
};
