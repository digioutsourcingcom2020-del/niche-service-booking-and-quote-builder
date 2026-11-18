import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth';
import { computeAvailability, createBooking } from '../bookings';
import { AppError } from '../db';
import { getProfile } from '../store';

const router = new Hono<AppEnv>();

const bookSchema = z.object({
  serviceId: z.string().uuid(),
  addonIds: z.array(z.string().uuid()).max(10).default([]),
  startsAt: z.string().min(10).max(40),
  timezone: z.string().min(1).max(80),
  customer: z.object({
    name: z.string().trim().min(2, 'Please enter your full name.').max(120),
    email: z.string().trim().email('Please enter a valid email address.').max(200),
    phone: z.string().trim().max(40).default(''),
    notes: z.string().trim().max(1000).default(''),
  }),
});

router.get('/profile', async (c) => {
  return c.json(await getProfile());
});

router.get('/availability', async (c) => {
  const date = c.req.query('date') ?? '';
  const serviceId = c.req.query('serviceId') ?? '';
  const addonIds = (c.req.query('addons') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, 'Please provide a date in YYYY-MM-DD format.');
  if (!z.string().uuid().safeParse(serviceId).success) throw new AppError(400, 'Please choose a service first.');

  const availability = await computeAvailability(date, serviceId, addonIds);
  return c.json(availability);
});

router.post('/bookings', async (c) => {
  const body = bookSchema.parse(await c.req.json());
  const booking = await createBooking(
    {
      serviceId: body.serviceId,
      addonIds: body.addonIds,
      startsAt: body.startsAt,
      timezone: body.timezone,
      customer: {
        name: body.customer.name,
        email: body.customer.email.toLowerCase(),
        phone: body.customer.phone,
        notes: body.customer.notes,
      },
    },
    c.get('user')?.id,
  );
  return c.json({ booking }, 201);
});

export default router;
