import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  bio: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
});
