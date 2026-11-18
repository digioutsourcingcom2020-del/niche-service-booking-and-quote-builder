import { Hono } from 'hono';
import type { AppEnv } from '../auth';
import { bookingsForUser } from '../bookings';
import { requireUser } from '../auth';

const router = new Hono<AppEnv>();

router.get('/bookings', requireUser, async (c) => {
  const user = c.get('user')!;
  return c.json({ bookings: await bookingsForUser(user.id, user.email) });
});

export default router;
