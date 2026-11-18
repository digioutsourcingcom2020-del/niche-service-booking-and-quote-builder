import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { ZodError } from 'zod';
import { sessionMiddleware, type AppEnv } from './auth';
import { AppError } from './db';
import { config } from './env';
import { initDb } from './init';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import publicRoutes from './routes/public';

await initDb();

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', sessionMiddleware);

app.route('/api/auth', authRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/me', meRoutes);
app.route('/api/admin', adminRoutes);
app.get('/api/health', (c) => c.json({ ok: true }));

app.all('/api/*', (c) => c.json({ error: 'Endpoint not found.' }, 404));

const distPath = './dist/web';
if (existsSync(`${distPath}/index.html`)) {
  app.use('*', serveStatic({ root: distPath }));
  app.get('*', serveStatic({ path: `${distPath}/index.html` }));
} else {
  app.get('/', (c) =>
    c.text('Gleamworks API is running. Start the frontend with "npm run dev:web" or build with "npm run build".'),
  );
}

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
  const code = (err as { code?: string }).code;
  if (code === '23P01') {
    return c.json({ error: 'That slot was just taken. Please choose another time.' }, 409);
  }
  if (code === '23505') {
    return c.json({ error: 'That record already exists.' }, 409);
  }
  console.error(err);
  return c.json({ error: 'Something went wrong on our side.' }, 500);
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Gleamworks API listening on http://localhost:${info.port}`);
});

