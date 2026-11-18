import { DateTime } from 'luxon';
import type { SlotDto, WorkingHourDto } from '../../shared/types';
import { toIsoUtc } from './time';

export interface BookedRange {
  startsAt: string;
  endsAt: string;
}

export interface ComputeSlotsArgs {
  dateISO: string;
  timezone: string;
  hours: WorkingHourDto;
  slotMinutes: number;
  durationMin: number;
  booked: BookedRange[];
  now: DateTime;
  leadMinutes: number;
  horizonDays: number;
}

export function computeSlots(args: ComputeSlotsArgs): SlotDto[] {
  const { dateISO, timezone, hours, slotMinutes, durationMin, booked, now, leadMinutes, horizonDays } = args;
  if (!hours.isOpen) return [];

  const day = DateTime.fromISO(dateISO, { zone: timezone }).startOf('day');
  if (!day.isValid) return [];

  const today = now.setZone(timezone).startOf('day');
  if (day < today) return [];
  if (day > today.plus({ days: horizonDays - 1 }).endOf('day')) return [];

  const close = day.plus({ minutes: hours.endMin });
  const earliest = now.plus({ minutes: leadMinutes });
  const ranges = booked
    .map((range) => ({
      start: DateTime.fromISO(range.startsAt, { zone: 'utc' }).toMillis(),
      end: DateTime.fromISO(range.endsAt, { zone: 'utc' }).toMillis(),
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end));

  const slots: SlotDto[] = [];
  let cursor = day.plus({ minutes: hours.startMin });

  while (cursor.plus({ minutes: durationMin }) <= close) {
    const end = cursor.plus({ minutes: durationMin });
    const startMs = cursor.toMillis();
    const endMs = end.toMillis();
    const blocked = ranges.some((range) => range.start < endMs && range.end > startMs);
    if (!blocked && cursor >= earliest) {
      slots.push({
        startsAt: toIsoUtc(cursor),
        endsAt: toIsoUtc(end),
      });
    }
    cursor = cursor.plus({ minutes: slotMinutes });
  }

  return slots;
}
