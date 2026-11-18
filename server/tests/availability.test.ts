import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { computeSlots } from '../src/availability';
import type { WorkingHourDto } from '../../shared/types';

const openHours: WorkingHourDto = { weekday: 5, isOpen: true, startMin: 480, endMin: 1020 };
const closedHours: WorkingHourDto = { weekday: 5, isOpen: false, startMin: 480, endMin: 1020 };

function baseArgs(overrides: Partial<Parameters<typeof computeSlots>[0]> = {}) {
  return {
    dateISO: '2026-11-20',
    timezone: 'UTC',
    hours: openHours,
    slotMinutes: 30,
    durationMin: 60,
    booked: [],
    now: DateTime.fromISO('2026-11-19T12:00:00Z', { zone: 'UTC' }),
    leadMinutes: 0,
    horizonDays: 14,
    ...overrides,
  };
}

test('generates slot starts across the working day', () => {
  const slots = computeSlots(baseArgs());
  assert.equal(slots.length, 17);
  assert.equal(slots[0].startsAt, '2026-11-20T08:00:00.000Z');
  assert.equal(slots.at(-1)?.startsAt, '2026-11-20T16:00:00.000Z');
});

test('removes every slot that would overlap an existing booking', () => {
  const slots = computeSlots(
    baseArgs({
      booked: [{ startsAt: '2026-11-20T10:00:00.000Z', endsAt: '2026-11-20T11:00:00.000Z' }],
    }),
  );
  const starts = slots.map((slot) => slot.startsAt);
  assert.ok(!starts.includes('2026-11-20T09:30:00.000Z'));
  assert.ok(!starts.includes('2026-11-20T10:00:00.000Z'));
  assert.ok(!starts.includes('2026-11-20T10:30:00.000Z'));
  assert.ok(starts.includes('2026-11-20T11:00:00.000Z'));
  assert.equal(slots.length, 14);
});

test('respects the lead time before the first bookable slot', () => {
  const slots = computeSlots(
    baseArgs({
      now: DateTime.fromISO('2026-11-20T09:15:00Z', { zone: 'UTC' }),
      leadMinutes: 30,
    }),
  );
  assert.equal(slots[0].startsAt, '2026-11-20T10:00:00.000Z');
});

test('returns no slots on closed days, past days, or beyond the horizon', () => {
  assert.deepEqual(computeSlots(baseArgs({ hours: closedHours })), []);
  assert.deepEqual(
    computeSlots(baseArgs({ now: DateTime.fromISO('2026-11-21T12:00:00Z', { zone: 'UTC' }) })),
    [],
  );
  assert.deepEqual(
    computeSlots(baseArgs({ dateISO: '2026-12-30' })),
    [],
  );
});

test('respects the provider time zone when creating day boundaries', () => {
  const slots = computeSlots(
    baseArgs({
      timezone: 'America/Los_Angeles',
      now: DateTime.fromISO('2026-11-19T12:00:00Z', { zone: 'UTC' }),
    }),
  );
  assert.equal(slots[0].startsAt, '2026-11-20T16:00:00.000Z');
});
