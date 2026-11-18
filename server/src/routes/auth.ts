import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../../../shared/types';
import { endSession, hashPassword, startSession, verifyPassword, type AppEnv } from '../auth';
import { AppError, newId, query } from '../db';

const router = new Hono<AppEnv>();

const credentials = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

const registerSchema = credentials.extend({
  name: z.string().trim().min(2).max(120),
});

router.post('/register', async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const email = body.email.toLowerCase();

  const existing = await query('SELECT 1 FROM users WHERE email = ?', [email]);
  if (existing.rowCount) throw new AppError(409, 'An account with that email already exists. Try signing in.');

  const inserted = await query<AuthUser>(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'client')
     RETURNING id, name, email, role`,
    [newId(), body.name, email, hashPassword(body.password)],
  );
  const user = inserted.rows[0];
  await startSession(c, user.id);
  return c.json({ user }, 201);
});

router.post('/login', async (c) => {
  const body = credentials.parse(await c.req.json());
  const email = body.email.toLowerCase();

  const result = await query<AuthUser & { password_hash: string }>(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
    [email],
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(body.password, row.password_hash)) {
    throw new AppError(401, 'Email or password is incorrect.');
  }

  await startSession(c, row.id);
  return c.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } });
});

router.post('/logout', async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

router.get('/me', (c) => {
  return c.json({ user: c.get('user') ?? null });
});

export default router;
