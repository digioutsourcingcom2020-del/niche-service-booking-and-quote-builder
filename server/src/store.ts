import type { AddonDto, PublicProfile, ServiceDto, SettingsDto, WorkingHourDto } from '../../shared/types';
import { query } from './db';

export interface SettingsRow {
  business_name: string;
  tagline: string;
  phone: string;
  address: string;
  timezone: string;
  slot_minutes: number;
  lead_minutes: number;
  horizon_days: number;
}

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  base_price_cents: number;
  duration_min: number;
  active: boolean;
  sort_order: number;
}

export interface AddonRow {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  active: boolean;
  sort_order: number;
}

export interface HourRow {
  weekday: number;
  is_open: boolean;
  start_min: number;
  end_min: number;
}

export function mapService(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    basePriceCents: row.base_price_cents,
    durationMin: row.duration_min,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export function mapAddon(row: AddonRow): AddonDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    durationMin: row.duration_min,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export function mapSettings(row: SettingsRow, hours: HourRow[]): SettingsDto {
  return {
    businessName: row.business_name,
    tagline: row.tagline,
    phone: row.phone,
    address: row.address,
    timezone: row.timezone,
    slotMinutes: row.slot_minutes,
    leadMinutes: row.lead_minutes,
    horizonDays: row.horizon_days,
    hours: hours.map<WorkingHourDto>((hour) => ({
      weekday: hour.weekday,
      isOpen: hour.is_open,
      startMin: hour.start_min,
      endMin: hour.end_min,
    })),
  };
}

export async function getSettings(): Promise<SettingsDto> {
  const [settingsResult, hoursResult] = await Promise.all([
    query<SettingsRow>('SELECT * FROM settings WHERE id = 1'),
    query<HourRow>('SELECT weekday, is_open, start_min, end_min FROM working_hours ORDER BY weekday'),
  ]);
  return mapSettings(settingsResult.rows[0], hoursResult.rows);
}

export async function listServices(activeOnly = false): Promise<ServiceDto[]> {
  const result = await query<ServiceRow>(
    `SELECT * FROM services ${activeOnly ? 'WHERE active' : ''} ORDER BY sort_order, name`,
  );
  return result.rows.map(mapService);
}

export async function listAddons(activeOnly = false): Promise<AddonDto[]> {
  const result = await query<AddonRow>(
    `SELECT * FROM addons ${activeOnly ? 'WHERE active' : ''} ORDER BY sort_order, name`,
  );
  return result.rows.map(mapAddon);
}

export async function getProfile(): Promise<PublicProfile> {
  const [settings, services, addons] = await Promise.all([getSettings(), listServices(true), listAddons(true)]);
  return { settings, services, addons };
}
