import { DateTime } from 'luxon';

export function isValidTimezone(timezone: string): boolean {
  try {
    return Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone !== undefined;
  } catch {
    return false;
  }
}

// Every stored timestamp uses this exact shape so text comparisons and sorting stay correct.
export function toIsoUtc(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
}

export function parseDateInZone(dateISO: string, timezone: string): DateTime | null {
  const day = DateTime.fromISO(dateISO, { zone: timezone }).startOf('day');
  return day.isValid ? day : null;
}

export function minutesToLabel(minutes: number): string {
  const normalized = minutes % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

export function formatInZone(iso: string, timezone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return iso;
  return dt.toFormat("ccc, LLL d · h:mm a 'UTC'ZZ");
}

export function formatDateMedium(iso: string, timezone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return iso;
  return dt.toFormat('ccc, LLL d');
}

export function formatTime(iso: string, timezone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return iso;
  return dt.toFormat('h:mm a');
}
