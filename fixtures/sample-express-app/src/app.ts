import express, { Request, Response } from 'express';
import userRoutes from './routes/user.routes';
import productRoutes from './routes/product.routes';
import { loginSchema } from './schemas/auth.schema';

const app = express();
app.use(express.json());

// Direct inline route: Health check (Public)
app.get('/api/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Direct inline route: Auth Login (Public, Body Schema validation)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);
  return res.json({ token: 'jwt_mock_token', email: data.email });
});

// Mount Routers
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

export default app;
