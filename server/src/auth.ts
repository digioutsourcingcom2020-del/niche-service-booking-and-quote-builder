import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AuthUser } from '../../shared/types.js';
import { AppError, query } from './db.js';
import { config } from './env.js';

export const SESSION_COOKIE = 'gw_session';
const SESSION_DAYS = 30;

export type AppEnv = {
  Variables: {
    user?: AuthUser;
  };
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: config.appUrl.startsWith('https://'),
  });
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const result = await query<AuthUser>(
      `SELECT u.id, u.name, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
      [hashToken(token), new Date().toISOString()],
    );
    if (result.rows[0]) c.set('user', result.rows[0]);
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw new AppError(401, 'Please sign in to continue.');
  await next();
};

export const requireProvider: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) throw new AppError(401, 'Please sign in to continue.');
  if (user.role !== 'provider') throw new AppError(403, 'This area is for studio providers only.');
  await next();
};
