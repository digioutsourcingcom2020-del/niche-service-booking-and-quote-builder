import { DateTime } from 'luxon';
import type { BookingStatus } from '@shared/types';

export { formatDuration, formatMoney } from '@shared/pricing';

export function currentZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function zoneLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(
      new Date(),
    );
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export function formatTime(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone);
  return dt.isValid ? dt.toFormat('h:mm a') : '—';
}

export function formatTimeWithZone(iso: string, zone: string): string {
  return `${formatTime(iso, zone)} ${zoneLabel(zone)}`;
}

export function formatDate(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone);
  return dt.isValid ? dt.toFormat('ccc, LLL d') : '—';
}

export function formatDateKey(dateISO: string, zone: string): string {
  const dt = DateTime.fromISO(dateISO, { zone });
  return dt.isValid ? dt.toFormat('ccc, LLL d') : '—';
}

export function formatLongDate(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone);
  return dt.isValid ? dt.toFormat('cccc, LLLL d') : '—';
}

export function formatDateTime(iso: string, zone: string): string {
  return `${formatDate(iso, zone)} · ${formatTime(iso, zone)}`;
}

export function dateKeys(zone: string, count: number): string[] {
  const start = DateTime.now().setZone(zone).startOf('day');
  return Array.from({ length: count }, (_, index) => start.plus({ days: index }).toISODate()!).filter(Boolean);
}

export function openDateKeys(zone: string, count: number, openWeekdays: number[]): string[] {
  const open = new Set(openWeekdays);
  const start = DateTime.now().setZone(zone).startOf('day');
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const day = start.plus({ days: index });
    if (open.has(day.weekday % 7)) keys.push(day.toISODate()!);
  }
  return keys;
}

export function dateKeyInZone(zone: string): string {
  return DateTime.now().setZone(zone).toISODate() ?? '';
}

export function weekdayLabel(dateISO: string, zone: string): string {
  const dt = DateTime.fromISO(dateISO, { zone });
  return dt.isValid ? dt.toFormat('ccc') : '—';
}

export function dayNumber(dateISO: string, zone: string): string {
  const dt = DateTime.fromISO(dateISO, { zone });
  return dt.isValid ? dt.toFormat('d') : '—';
}

export function monthLabel(dateISO: string, zone: string): string {
  const dt = DateTime.fromISO(dateISO, { zone });
  return dt.isValid ? dt.toFormat('LLL') : '';
}

export function relativeDay(dateISO: string, zone: string): string {
  const now = DateTime.now().setZone(zone);
  if (dateISO === now.toISODate()) return 'Today';
  if (dateISO === now.plus({ days: 1 }).toISODate()) return 'Tomorrow';
  return weekdayLabel(dateISO, zone);
}

export function hourInZone(iso: string, zone: string): number {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone);
  return dt.isValid ? dt.hour : 0;
}

export function minutesToLabel(minutes: number): string {
  const normalized = minutes % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (!match) return 0;
  return Math.min(1439, Number(match[1]) * 60 + Math.min(59, Number(match[2])));
}

export function statusLabel(status: BookingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(value: string): number {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

export const TIMEZONES: string[] =
  (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.('timeZone') ?? [
    'UTC',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'Asia/Manila',
    'Asia/Tokyo',
    'Europe/London',
    'Europe/Paris',
    'Australia/Sydney',
  ];
