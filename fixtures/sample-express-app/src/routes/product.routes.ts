import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createProductSchema = z.object({
  title: z.string(),
  price: z.number(),
  inStock: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

// GET /api/products - List products (Public)
router.get('/', (req: Request, res: Response) => {
  return res.json([{ id: 'prod_1', title: 'Widget', price: 9.99 }]);
});

// POST /api/products - Create product (Protected, Local Zod Schema)
router.post('/', requireAuth, (req: Request, res: Response) => {
  const validated = createProductSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ errors: validated.error.issues });
  }
  return res.status(201).json({ id: 'prod_2', ...validated.data });
});

export default router;
