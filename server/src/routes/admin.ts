import { Hono } from 'hono';
import { z } from 'zod';
import type { BookingStatus } from '../../../shared/types';
import { requireProvider, type AppEnv } from '../auth';
import { getOverview, listBookings, updateBookingStatus } from '../bookings';
import { AppError, query, withTransaction } from '../db';
import { listEmails } from '../emails';
import {
  getSettings,
  listAddons,
  listServices,
  mapAddon,
  mapService,
  type AddonRow,
  type ServiceRow,
} from '../store';
import { isValidTimezone } from '../time';

const router = new Hono<AppEnv>();
router.use('*', requireProvider);

router.get('/overview', async (c) => {
  return c.json(await getOverview());
});

router.get('/bookings', async (c) => {
  return c.json({ bookings: await listBookings() });
});

router.post('/bookings/:id/status', async (c) => {
  const id = z.string().uuid().parse(c.req.param('id'));
  const body = z
    .object({ status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']) })
    .parse(await c.req.json());
  return c.json({ booking: await updateBookingStatus(id, body.status as BookingStatus) });
});

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Give the service a name.').max(80),
  description: z.string().trim().max(400).default(''),
  basePriceCents: z.number().int().min(0).max(1_000_000),
  durationMin: z.number().int().min(15).max(480),
  active: z.boolean().default(true),
});

router.get('/services', async (c) => {
  return c.json({ services: await listServices(false) });
});

router.post('/services', async (c) => {
  const body = serviceSchema.parse(await c.req.json());
  const inserted = await query<ServiceRow>(
    `INSERT INTO services (name, description, base_price_cents, duration_min, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(sort_order), 0) + 1 FROM services))
     RETURNING *`,
    [body.name, body.description, body.basePriceCents, body.durationMin, body.active],
  );
  return c.json({ service: mapService(inserted.rows[0]) }, 201);
});

router.put('/services/:id', async (c) => {
  const id = z.string().uuid().parse(c.req.param('id'));
  const body = serviceSchema.parse(await c.req.json());
  const updated = await query<ServiceRow>(
    `UPDATE services
        SET name = $2, description = $3, base_price_cents = $4, duration_min = $5, active = $6, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, body.name, body.description, body.basePriceCents, body.durationMin, body.active],
  );
  if (!updated.rows[0]) throw new AppError(404, 'Service not found.');
  return c.json({ service: mapService(updated.rows[0]) });
});

router.delete('/services/:id', async (c) => {
  const id = z.string().uuid().parse(c.req.param('id'));
  const deleted = await query('DELETE FROM services WHERE id = $1', [id]);
  if (!deleted.rowCount) throw new AppError(404, 'Service not found.');
  return c.json({ ok: true });
});

const addonSchema = z.object({
  name: z.string().trim().min(2, 'Give the add-on a name.').max(80),
  description: z.string().trim().max(400).default(''),
  priceCents: z.number().int().min(0).max(1_000_000),
  durationMin: z.number().int().min(0).max(240),
  active: z.boolean().default(true),
});

router.get('/addons', async (c) => {
  return c.json({ addons: await listAddons(false) });
});

router.post('/addons', async (c) => {
  const body = addonSchema.parse(await c.req.json());
  const inserted = await query<AddonRow>(
    `INSERT INTO addons (name, description, price_cents, duration_min, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, (SELECT coalesce(max(sort_order), 0) + 1 FROM addons))
     RETURNING *`,
    [body.name, body.description, body.priceCents, body.durationMin, body.active],
  );
  return c.json({ addon: mapAddon(inserted.rows[0]) }, 201);
});

router.put('/addons/:id', async (c) => {
  const id = z.string().uuid().parse(c.req.param('id'));
  const body = addonSchema.parse(await c.req.json());
  const updated = await query<AddonRow>(
    `UPDATE addons
        SET name = $2, description = $3, price_cents = $4, duration_min = $5, active = $6, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, body.name, body.description, body.priceCents, body.durationMin, body.active],
  );
  if (!updated.rows[0]) throw new AppError(404, 'Add-on not found.');
  return c.json({ addon: mapAddon(updated.rows[0]) });
});

router.delete('/addons/:id', async (c) => {
  const id = z.string().uuid().parse(c.req.param('id'));
  const deleted = await query('DELETE FROM addons WHERE id = $1', [id]);
  if (!deleted.rowCount) throw new AppError(404, 'Add-on not found.');
  return c.json({ ok: true });
});

router.get('/settings', async (c) => {
  return c.json(await getSettings());
});

const settingsSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the studio name.').max(80),
  tagline: z.string().trim().max(140).default(''),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(200).default(''),
  timezone: z.string().min(1).max(80),
  slotMinutes: z.number().int().min(15).max(120),
  leadMinutes: z.number().int().min(0).max(10080),
  horizonDays: z.number().int().min(1).max(60),
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        startMin: z.number().int().min(0).max(1439),
        endMin: z.number().int().min(1).max(1440),
      }),
    )
    .length(7),
});

router.put('/settings', async (c) => {
  const body = settingsSchema.parse(await c.req.json());
  if (!isValidTimezone(body.timezone)) throw new AppError(400, 'That time zone is not recognized.');
  if (new Set(body.hours.map((hour) => hour.weekday)).size !== 7) {
    throw new AppError(400, 'Working hours must cover all seven days.');
  }
  for (const hour of body.hours) {
    if (hour.endMin <= hour.startMin) throw new AppError(400, 'Each day needs an end time after its start time.');
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE settings
          SET business_name = $1, tagline = $2, phone = $3, address = $4, timezone = $5,
              slot_minutes = $6, lead_minutes = $7, horizon_days = $8
        WHERE id = 1`,
      [
        body.businessName,
        body.tagline,
        body.phone,
        body.address,
        body.timezone,
        body.slotMinutes,
        body.leadMinutes,
        body.horizonDays,
      ],
    );
    for (const hour of body.hours) {
      await client.query(
        `INSERT INTO working_hours (weekday, is_open, start_min, end_min)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (weekday) DO UPDATE
           SET is_open = EXCLUDED.is_open, start_min = EXCLUDED.start_min, end_min = EXCLUDED.end_min`,
        [hour.weekday, hour.isOpen, hour.startMin, hour.endMin],
      );
    }
  });

  return c.json(await getSettings());
});

router.get('/emails', async (c) => {
  return c.json({ emails: await listEmails() });
});

export default router;
