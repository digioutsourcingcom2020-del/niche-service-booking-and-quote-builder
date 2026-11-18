import { DateTime } from 'luxon';
import { quoteFor } from '../../shared/pricing.js';
import { hashPassword } from './auth.js';
import { newId, query } from './db.js';
import { mapBooking } from './bookings.js';
import { deliverEmail } from './emails.js';
import { getSettings } from './store.js';
import { toIsoUtc } from './time.js';

const PROVIDER_EMAIL = 'provider@gleamworks.studio';
const CLIENT_EMAIL = 'client@example.com';
const DEMO_PASSWORD = 'demo1234';

function nextOpenDay(zone: string, minDaysAhead: number, hour: number, minute = 0): DateTime {
  let day = DateTime.now().setZone(zone).plus({ days: minDaysAhead }).startOf('day');
  while (![2, 3, 4, 5, 6].includes(day.weekday % 7)) day = day.plus({ days: 1 });
  return day.set({ hour, minute, second: 0, millisecond: 0 });
}

export async function seed(): Promise<void> {
  const existing = await query('SELECT 1 FROM settings WHERE id = 1');
  if (existing.rowCount) return;

  const provider = await query<{ id: string }>(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'provider') RETURNING id`,
    [newId(), 'Maya Chen', PROVIDER_EMAIL, hashPassword(DEMO_PASSWORD)],
  );
  const client = await query<{ id: string }>(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'client') RETURNING id`,
    [newId(), 'Jordan Blake', CLIENT_EMAIL, hashPassword(DEMO_PASSWORD)],
  );

  await query(
    `INSERT INTO settings (id, business_name, tagline, phone, address, timezone, slot_minutes, lead_minutes, horizon_days)
     VALUES (1, ?, ?, ?, ?, ?, 30, 120, 14)`,
    [
      'Gleamworks Mobile Detailing',
      'Showroom shine, delivered to your driveway.',
      '(415) 555-0134',
      'Mobile studio · Greater San Francisco',
      'America/Los_Angeles',
    ],
  );

  const hours: Array<[number, boolean, number, number]> = [
    [0, false, 480, 1020],
    [1, false, 480, 1020],
    [2, true, 480, 1020],
    [3, true, 480, 1020],
    [4, true, 480, 1020],
    [5, true, 480, 1020],
    [6, true, 540, 960],
  ];
  for (const [weekday, isOpen, startMin, endMin] of hours) {
    await query(
      'INSERT INTO working_hours (weekday, is_open, start_min, end_min) VALUES (?, ?, ?, ?)',
      [weekday, isOpen, startMin, endMin],
    );
  }

  const services = [
    {
      name: 'Signature Wash & Wax',
      description: 'Hand wash, clay bar decontamination, and a carnauba wax for deep gloss.',
      basePriceCents: 14000,
      durationMin: 90,
      sortOrder: 1,
    },
    {
      name: 'Interior Deep Clean',
      description: 'Steam extraction on seats and carpets, leather conditioning, and a full sanitize.',
      basePriceCents: 18000,
      durationMin: 120,
      sortOrder: 2,
    },
    {
      name: 'Full Detail — In & Out',
      description: 'Our complete reset: paint decontamination, machine polish, and interior extraction.',
      basePriceCents: 29000,
      durationMin: 180,
      sortOrder: 3,
    },
  ];
  const serviceIds: string[] = [];
  for (const service of services) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO services (id, name, description, base_price_cents, duration_min, sort_order)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [newId(), service.name, service.description, service.basePriceCents, service.durationMin, service.sortOrder],
    );
    serviceIds.push(inserted.rows[0].id);
  }

  const addons = [
    { name: 'Ceramic Spray Sealant', description: '12 months of hydrophobic protection on paint and glass.', priceCents: 4500, durationMin: 30, sortOrder: 1 },
    { name: 'Pet Hair Removal', description: 'Specialized extraction for embedded fur and dander.', priceCents: 4000, durationMin: 30, sortOrder: 2 },
    { name: 'Engine Bay Detail', description: 'Degreased, rinsed, and dressed for a factory-fresh bay.', priceCents: 6500, durationMin: 45, sortOrder: 3 },
    { name: 'Odor Bomb Treatment', description: 'Ozone cycle that neutralizes smoke, pets, and spills.', priceCents: 3000, durationMin: 15, sortOrder: 4 },
  ];
  const addonIds: string[] = [];
  for (const addon of addons) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO addons (id, name, description, price_cents, duration_min, sort_order)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [newId(), addon.name, addon.description, addon.priceCents, addon.durationMin, addon.sortOrder],
    );
    addonIds.push(inserted.rows[0].id);
  }

  const tz = 'America/Los_Angeles';
  const settings = await getSettings();
  const seededAddon = {
    id: addonIds[0],
    name: addons[0].name,
    priceCents: addons[0].priceCents,
    durationMin: addons[0].durationMin,
  };

  const entries = [
    {
      reference: 'GW-DEMO01',
      userId: client.rows[0].id,
      serviceIndex: 1,
      status: 'confirmed',
      start: nextOpenDay(tz, 1, 10, 0),
      customerName: 'Jordan Blake',
      customerEmail: CLIENT_EMAIL,
      customerPhone: '(415) 555-0198',
      notes: 'Daily driver with a dog — please focus on the rear bench.',
      addonList: [seededAddon, { id: addonIds[1], name: addons[1].name, priceCents: addons[1].priceCents, durationMin: addons[1].durationMin }],
    },
    {
      reference: 'GW-DEMO02',
      serviceIndex: 0,
      status: 'pending',
      start: nextOpenDay(tz, 2, 13, 30),
      customerName: 'Priya Raman',
      customerEmail: 'priya.raman@example.com',
      customerPhone: '(415) 555-0117',
      notes: 'New car, mostly highway miles.',
      addonList: [seededAddon],
    },
    {
      reference: 'GW-DEMO03',
      serviceIndex: 2,
      status: 'pending',
      start: nextOpenDay(tz, 4, 9, 0),
      customerName: 'Marcus Webb',
      customerEmail: 'marcus.webb@example.com',
      customerPhone: '(415) 555-0162',
      notes: 'Three-row SUV. Two child seats to work around.',
      addonList: [],
    },
    {
      reference: 'GW-DEMO04',
      serviceIndex: 1,
      status: 'completed',
      start: DateTime.now().setZone(tz).minus({ days: 6 }).set({ hour: 11, minute: 0 }),
      customerName: 'Elena Cortez',
      customerEmail: 'elena.cortez@example.com',
      customerPhone: '(415) 555-0183',
      notes: '',
      addonList: [],
    },
    {
      reference: 'GW-DEMO05',
      serviceIndex: 0,
      status: 'cancelled',
      start: DateTime.now().setZone(tz).minus({ days: 3 }).set({ hour: 14, minute: 0 }),
      customerName: 'Sam Ortiz',
      customerEmail: 'sam.ortiz@example.com',
      customerPhone: '',
      notes: 'Rescheduling to next month.',
      addonList: [],
    },
  ];

  const insertedBookings: Array<{ row: any; status: string }> = [];
  for (const entry of entries) {
    const service = services[entry.serviceIndex];
    const quote = quoteFor(service.basePriceCents, service.durationMin, entry.addonList);
    const startIso = toIsoUtc(entry.start);
    const endIso = toIsoUtc(entry.start.plus({ minutes: quote.durationMin }));
    const inserted = await query(
      `INSERT INTO bookings (
         id, reference, user_id, service_id, service_name, addons, status,
         starts_at, ends_at, duration_min, base_price_cents, addons_price_cents, total_cents,
         customer_name, customer_email, customer_phone, notes, client_timezone
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Asia/Manila')
       RETURNING *`,
      [
        newId(),
        entry.reference,
        entry.userId ?? null,
        serviceIds[entry.serviceIndex],
        service.name,
        JSON.stringify(entry.addonList),
        entry.status,
        startIso,
        endIso,
        quote.durationMin,
        quote.basePriceCents,
        quote.addonsPriceCents,
        quote.totalCents,
        entry.customerName,
        entry.customerEmail,
        entry.customerPhone,
        entry.notes,
      ],
    );
    insertedBookings.push({ row: inserted.rows[0], status: entry.status });
  }

  // Mirror the lifecycle emails into the outbox so the studio dashboard has history on first boot.
  for (const { row, status } of insertedBookings) {
    const booking = mapBooking(row);
    if (status === 'pending' || status === 'confirmed') {
      await deliverEmail({ bookingId: booking.id, to: booking.customerEmail, kind: 'booking_received', booking, settings });
    }
    if (status === 'confirmed') {
      await deliverEmail({ bookingId: booking.id, to: booking.customerEmail, kind: 'booking_confirmed', booking, settings });
    }
    if (status === 'completed') {
      await deliverEmail({ bookingId: booking.id, to: booking.customerEmail, kind: 'booking_completed', booking, settings });
    }
  }

  console.log(`Seeded demo studio · provider ${PROVIDER_EMAIL} / ${DEMO_PASSWORD}`);
}
