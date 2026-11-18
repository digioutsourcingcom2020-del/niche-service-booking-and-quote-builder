import { randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { quoteFor } from '../../shared/pricing';
import type {
  AddonDto,
  AvailabilityDto,
  BookingAddon,
  BookingDto,
  BookingStatus,
  CreateBookingInput,
  OverviewDto,
} from '../../shared/types';
import { computeSlots } from './availability';
import { AppError, newId, query, withTransaction } from './db';
import { sendBookingEmail } from './emails';
import { getSettings, type AddonRow, type ServiceRow } from './store';
import { isValidTimezone, parseDateInZone, toIsoUtc } from './time';

interface BookingRow {
  id: string;
  reference: string;
  user_id: string | null;
  service_id: string | null;
  service_name: string;
  addons: BookingAddon[] | string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  base_price_cents: number;
  addons_price_cents: number;
  total_cents: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string;
  client_timezone: string;
  created_at: string;
  updated_at: string;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeReference(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) code += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `GW-${code}`;
}

function parseAddons(value: BookingAddon[] | string): BookingAddon[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as BookingAddon[]) : [];
  } catch {
    return [];
  }
}

export function mapBooking(row: BookingRow): BookingDto {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    durationMin: row.duration_min,
    serviceName: row.service_name,
    addons: parseAddons(row.addons),
    basePriceCents: row.base_price_cents,
    addonsPriceCents: row.addons_price_cents,
    totalCents: row.total_cents,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    notes: row.notes,
    clientTimezone: row.client_timezone,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function resolveSelection(serviceId: string, addonIds: string[]) {
  const serviceResult = await query<ServiceRow>('SELECT * FROM services WHERE id = ? AND active', [serviceId]);
  const service = serviceResult.rows[0];
  if (!service) throw new AppError(404, 'That service is not available right now.');

  const uniqueAddonIds = [...new Set(addonIds)];
  const addonRows = uniqueAddonIds.length
    ? (
        await query<AddonRow>(
          `SELECT * FROM addons WHERE id IN (${uniqueAddonIds.map(() => '?').join(', ')}) AND active`,
          uniqueAddonIds,
        )
      ).rows
    : [];
  if (addonRows.length !== uniqueAddonIds.length) {
    throw new AppError(400, 'One of those add-ons is no longer available. Please refresh and try again.');
  }

  const addons: AddonDto[] = addonRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    durationMin: row.duration_min,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  }));
  const quote = quoteFor(service.base_price_cents, service.duration_min, addons);
  return { service, addons, quote };
}

export async function computeAvailability(
  dateISO: string,
  serviceId: string,
  addonIds: string[],
): Promise<AvailabilityDto> {
  const settings = await getSettings();
  const day = parseDateInZone(dateISO, settings.timezone);
  if (!day) throw new AppError(400, 'That date is not valid.');

  const { quote } = await resolveSelection(serviceId, addonIds);
  const hours = settings.hours.find((hour) => hour.weekday === day.weekday % 7);
  if (!hours) throw new AppError(400, 'Working hours are not configured.');

  const dayStart = toIsoUtc(day);
  const dayEnd = toIsoUtc(day.plus({ days: 1 }));
  const booked = await query<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM bookings
      WHERE status <> 'cancelled' AND starts_at < ? AND ends_at > ?`,
    [dayEnd, dayStart],
  );

  const slots = computeSlots({
    dateISO,
    timezone: settings.timezone,
    hours,
    slotMinutes: settings.slotMinutes,
    durationMin: quote.durationMin,
    booked: booked.rows.map((row) => ({
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
    })),
    now: DateTime.now(),
    leadMinutes: settings.leadMinutes,
    horizonDays: settings.horizonDays,
  });

  return { date: dateISO, timezone: settings.timezone, durationMin: quote.durationMin, slots };
}

export async function createBooking(input: CreateBookingInput, userId?: string): Promise<BookingDto> {
  const settings = await getSettings();
  if (!isValidTimezone(input.timezone)) throw new AppError(400, 'That time zone is not recognized.');

  const { service, addons, quote } = await resolveSelection(input.serviceId, input.addonIds);

  const starts = DateTime.fromISO(input.startsAt, { zone: 'utc' });
  if (!starts.isValid) throw new AppError(400, 'That start time is not valid.');

  const local = starts.setZone(settings.timezone);
  const ends = local.plus({ minutes: quote.durationMin });
  const dayStart = local.startOf('day');
  const today = DateTime.now().setZone(settings.timezone).startOf('day');

  if (dayStart < today) throw new AppError(409, 'That date has already passed.');
  if (dayStart.diff(today, 'days').days >= settings.horizonDays) {
    throw new AppError(409, 'That date is too far out. Please pick a closer day.');
  }

  const weekday = local.weekday % 7;
  const hours = settings.hours.find((hour) => hour.weekday === weekday);
  if (!hours?.isOpen) throw new AppError(409, 'The studio is closed that day.');

  const open = dayStart.plus({ minutes: hours.startMin });
  const close = dayStart.plus({ minutes: hours.endMin });
  if (local < open || ends > close) throw new AppError(409, 'That time falls outside working hours.');

  if (local.toMillis() < DateTime.now().plus({ minutes: settings.leadMinutes }).toMillis()) {
    throw new AppError(409, 'That slot is too soon to book online. Please choose a later time.');
  }

  const startIso = toIsoUtc(local);
  const endIso = toIsoUtc(ends);
  const addonSnapshot = addons.map<BookingAddon>((addon) => ({
    id: addon.id,
    name: addon.name,
    priceCents: addon.priceCents,
    durationMin: addon.durationMin,
  }));

  const row = await withTransaction(async (client) => {
    // BEGIN IMMEDIATE already holds SQLite's write lock, so the clash check cannot race an insert.
    const clash = await client.query(
      `SELECT 1 FROM bookings
        WHERE status <> 'cancelled' AND starts_at < ? AND ends_at > ?
        LIMIT 1`,
      [endIso, startIso],
    );
    if (clash.rowCount) {
      throw new AppError(409, 'That time was just taken. Please pick another slot.');
    }

    const inserted = await client.query<BookingRow>(
      `INSERT INTO bookings (
         id, reference, user_id, service_id, service_name, addons, status,
         starts_at, ends_at, duration_min, base_price_cents, addons_price_cents, total_cents,
         customer_name, customer_email, customer_phone, notes, client_timezone
       ) VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?)
       RETURNING *`,
      [
        newId(),
        makeReference(),
        userId ?? null,
        service.id,
        service.name,
        JSON.stringify(addonSnapshot),
        startIso,
        endIso,
        quote.durationMin,
        quote.basePriceCents,
        quote.addonsPriceCents,
        quote.totalCents,
        input.customer.name,
        input.customer.email.toLowerCase(),
        input.customer.phone,
        input.customer.notes,
        input.timezone,
      ],
    );
    return inserted.rows[0];
  });

  const booking = mapBooking(row);
  await sendBookingEmail('booking_received', booking, settings);
  return booking;
}

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function updateBookingStatus(id: string, next: BookingStatus): Promise<BookingDto> {
  const current = await query<BookingRow>('SELECT * FROM bookings WHERE id = ?', [id]);
  const row = current.rows[0];
  if (!row) throw new AppError(404, 'Booking not found.');
  if (!TRANSITIONS[row.status].includes(next)) {
    throw new AppError(409, `A ${row.status} booking cannot be marked ${next}.`);
  }

  const updated = await query<BookingRow>(
    'UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? RETURNING *',
    [next, new Date().toISOString(), id],
  );
  const booking = mapBooking(updated.rows[0]);
  const settings = await getSettings();
  const kind =
    next === 'confirmed' ? 'booking_confirmed' : next === 'completed' ? 'booking_completed' : 'booking_cancelled';
  await sendBookingEmail(kind, booking, settings);
  return booking;
}

export async function listBookings(): Promise<BookingDto[]> {
  const result = await query<BookingRow>('SELECT * FROM bookings ORDER BY starts_at DESC LIMIT 200');
  return result.rows.map(mapBooking);
}

export async function bookingsForUser(userId: string, email: string): Promise<BookingDto[]> {
  const result = await query<BookingRow>(
    `SELECT * FROM bookings
      WHERE user_id = ? OR lower(customer_email) = lower(?)
      ORDER BY starts_at DESC
      LIMIT 100`,
    [userId, email],
  );
  return result.rows.map(mapBooking);
}

export async function getOverview(): Promise<OverviewDto> {
  const settings = await getSettings();
  const now = DateTime.now();
  const zonedNow = now.setZone(settings.timezone);
  const monthStart = toIsoUtc(zonedNow.startOf('month'));
  const dayStart = toIsoUtc(zonedNow.startOf('day'));
  const dayEnd = toIsoUtc(zonedNow.plus({ days: 1 }).startOf('day'));
  const nowIso = toIsoUtc(now);

  const [statsResult, todayResult, nextResult] = await Promise.all([
    query<{
      pending: number;
      upcoming: number;
      completed: number;
      cancelled: number;
      customers: number;
      revenue_cents: number;
    }>(
      `SELECT
         count(*) FILTER (WHERE status = 'pending') AS pending,
         count(*) FILTER (WHERE status IN ('pending','confirmed') AND starts_at >= ?) AS upcoming,
         count(*) FILTER (WHERE status = 'completed') AS completed,
         count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
         count(DISTINCT lower(customer_email)) AS customers,
         coalesce(sum(total_cents) FILTER (WHERE status IN ('confirmed','completed') AND starts_at >= ?), 0) AS revenue_cents
       FROM bookings`,
      [nowIso, monthStart],
    ),
    query<BookingRow>(
      'SELECT * FROM bookings WHERE starts_at >= ? AND starts_at < ? ORDER BY starts_at ASC',
      [dayStart, dayEnd],
    ),
    query<BookingRow>(
      `SELECT * FROM bookings
        WHERE status IN ('pending','confirmed') AND starts_at >= ?
        ORDER BY starts_at ASC LIMIT 6`,
      [nowIso],
    ),
  ]);

  const stats = statsResult.rows[0];
  const completed = Number(stats.completed);
  const cancelled = Number(stats.cancelled);
  const finished = completed + cancelled;

  return {
    stats: {
      pending: Number(stats.pending),
      upcoming: Number(stats.upcoming),
      completed,
      customers: Number(stats.customers),
      revenueCents: Number(stats.revenue_cents),
      completionRate: finished === 0 ? 0 : Math.round((completed / finished) * 100),
    },
    today: todayResult.rows.map(mapBooking),
    next: nextResult.rows.map(mapBooking),
  };
}
