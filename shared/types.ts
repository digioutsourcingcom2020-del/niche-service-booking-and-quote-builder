export type Role = 'provider' | 'client';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ServiceDto {
  id: string;
  name: string;
  description: string;
  basePriceCents: number;
  durationMin: number;
  active: boolean;
  sortOrder: number;
}

export interface AddonDto {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  active: boolean;
  sortOrder: number;
}

export interface WorkingHourDto {
  weekday: number;
  isOpen: boolean;
  startMin: number;
  endMin: number;
}

export interface SettingsDto {
  businessName: string;
  tagline: string;
  phone: string;
  address: string;
  timezone: string;
  slotMinutes: number;
  leadMinutes: number;
  horizonDays: number;
  hours: WorkingHourDto[];
}

export interface PublicProfile {
  settings: SettingsDto;
  services: ServiceDto[];
  addons: AddonDto[];
}

export interface SlotDto {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityDto {
  date: string;
  timezone: string;
  durationMin: number;
  slots: SlotDto[];
}

export interface BookingAddon {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
}

export interface BookingDto {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  serviceName: string;
  addons: BookingAddon[];
  basePriceCents: number;
  addonsPriceCents: number;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  clientTimezone: string;
  createdAt: string;
}

export interface OverviewDto {
  stats: {
    pending: number;
    upcoming: number;
    completed: number;
    customers: number;
    revenueCents: number;
    completionRate: number;
  };
  today: BookingDto[];
  next: BookingDto[];
}

export interface EmailDto {
  id: string;
  bookingId: string | null;
  toEmail: string;
  subject: string;
  html: string;
  kind: string;
  status: 'logged' | 'sent' | 'failed';
  provider: string;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface CreateBookingInput {
  serviceId: string;
  addonIds: string[];
  startsAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };
  timezone: string;
}
