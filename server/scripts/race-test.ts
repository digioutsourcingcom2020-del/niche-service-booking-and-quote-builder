import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import type { AvailabilityDto, PublicProfile } from '../../shared/types';
import { closeDb, query } from '../src/db';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:8787';

async function request<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

async function main() {
  const profile = await request<PublicProfile>('/api/public/profile');
  assert.equal(profile.status, 200);
  const service = profile.body.services[0];
  assert.ok(service, 'Seed data must include at least one active service.');

  const timezone = profile.body.settings.timezone;
  const today = DateTime.now().setZone(timezone).startOf('day');
  let target: { date: string; startsAt: string } | null = null;

  for (let offset = 1; offset <= profile.body.settings.horizonDays; offset += 1) {
    const date = today.plus({ days: offset }).toISODate()!;
    const availability = await request<AvailabilityDto>(
      `/api/public/availability?date=${date}&serviceId=${service.id}`,
    );
    if (availability.status === 200 && availability.body.slots.length > 0) {
      target = { date, startsAt: availability.body.slots.at(-1)!.startsAt };
      break;
    }
  }

  assert.ok(target, 'Expected at least one open slot in the booking horizon.');
  console.log(`Race target: ${target.startsAt} (${target.date})`);

  const payload = (email: string) =>
    JSON.stringify({
      serviceId: service.id,
      addonIds: [],
      startsAt: target!.startsAt,
      timezone: 'Asia/Manila',
      customer: { name: 'Race Test', email, phone: '', notes: 'concurrency probe' },
    });

  const [first, second] = await Promise.all([
    request('/api/public/bookings', { method: 'POST', body: payload('race+1@gleamworks.test') }),
    request('/api/public/bookings', { method: 'POST', body: payload('race+2@gleamworks.test') }),
  ]);

  const statuses = [first.status, second.status].sort((a, b) => a - b);
  console.log(`Concurrent booking statuses: ${statuses.join(', ')}`);
  assert.deepEqual(statuses, [201, 409], 'Exactly one request must win and the other must get 409.');

  await query("DELETE FROM emails WHERE to_email LIKE 'race+%'");
  await query("DELETE FROM bookings WHERE customer_email LIKE 'race+%'");
  closeDb();
  console.log('Race test passed: no double booking under concurrent requests.');
}

main().catch((error) => {
  console.error(error);
  closeDb();
  process.exit(1);
});
