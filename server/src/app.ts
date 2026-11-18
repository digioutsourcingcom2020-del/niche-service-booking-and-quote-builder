import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { ZodError } from 'zod';
import { sessionMiddleware, type AppEnv } from './auth';
import { AppError } from './db';
import { config } from './env';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import publicRoutes from './routes/public';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', logger());
  app.use('*', sessionMiddleware);

  app.route('/api/auth', authRoutes);
  app.route('/api/public', publicRoutes);
  app.route('/api/me', meRoutes);
  app.route('/api/admin', adminRoutes);
  app.get('/api/health', (c) => c.json({ ok: true }));

  app.all('/api/*', (c) => c.json({ error: 'Endpoint not found.' }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.status as 400 | 401 | 403 | 404 | 409 | 500);
    }
    if (err instanceof ZodError) {
      return c.json({ error: err.issues[0]?.message ?? 'Please check the form and try again.' }, 400);
    }
    if (err instanceof SyntaxError) {
      return c.json({ error: 'The request body was not valid JSON.' }, 400);
    }
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'That record already exists.' }, 409);
    }
    console.error(err);
    return c.json({ error: 'Something went wrong on our side.' }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
