import type {
  AuthUser,
  AvailabilityDto,
  BookingDto,
  BookingStatus,
  CreateBookingInput,
  EmailDto,
  OverviewDto,
  PublicProfile,
  ServiceDto,
  AddonDto,
  SettingsDto,
} from '@shared/types';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'include', ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the studio server. Check that the API is running.', 0);
  }

  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export interface ServiceInput {
  name: string;
  description: string;
  basePriceCents: number;
  durationMin: number;
  active: boolean;
}

export interface AddonInput {
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  active: boolean;
}

export const api = {
  profile: () => request<PublicProfile>('/public/profile'),

  availability: (date: string, serviceId: string, addonIds: string[]) =>
    request<AvailabilityDto>(
      `/public/availability?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}&addons=${encodeURIComponent(addonIds.join(','))}`,
    ),

  createBooking: (input: CreateBookingInput) =>
    request<{ booking: BookingDto }>('/public/bookings', { method: 'POST', body: JSON.stringify(input) }),

  me: () => request<{ user: AuthUser | null }>('/auth/me'),

  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (name: string, email: string, password: string) =>
    request<{ user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  myBookings: () => request<{ bookings: BookingDto[] }>('/me/bookings'),

  admin: {
    overview: () => request<OverviewDto>('/admin/overview'),
    bookings: () => request<{ bookings: BookingDto[] }>('/admin/bookings'),
    setStatus: (id: string, status: BookingStatus) =>
      request<{ booking: BookingDto }>(`/admin/bookings/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    emails: () => request<{ emails: EmailDto[] }>('/admin/emails'),
    settings: () => request<SettingsDto>('/admin/settings'),
    saveSettings: (settings: SettingsDto) =>
      request<SettingsDto>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    services: () => request<{ services: ServiceDto[] }>('/admin/services'),
    createService: (input: ServiceInput) =>
      request<{ service: ServiceDto }>('/admin/services', { method: 'POST', body: JSON.stringify(input) }),
    updateService: (id: string, input: ServiceInput) =>
      request<{ service: ServiceDto }>(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteService: (id: string) => request<{ ok: true }>(`/admin/services/${id}`, { method: 'DELETE' }),
    addons: () => request<{ addons: AddonDto[] }>('/admin/addons'),
    createAddon: (input: AddonInput) =>
      request<{ addon: AddonDto }>('/admin/addons', { method: 'POST', body: JSON.stringify(input) }),
    updateAddon: (id: string, input: AddonInput) =>
      request<{ addon: AddonDto }>(`/admin/addons/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteAddon: (id: string) => request<{ ok: true }>(`/admin/addons/${id}`, { method: 'DELETE' }),
  },
};
