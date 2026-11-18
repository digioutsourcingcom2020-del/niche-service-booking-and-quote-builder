import type { BookingDto, EmailDto, SettingsDto } from '../../shared/types';
import { formatMoney } from '../../shared/pricing';
import { config } from './env';
import { newId, query } from './db';
import { formatInZone } from './time';

export type EmailKind = 'booking_received' | 'booking_confirmed' | 'booking_completed' | 'booking_cancelled';

interface EmailRow {
  id: string;
  booking_id: string | null;
  to_email: string;
  subject: string;
  html: string;
  kind: string;
  status: EmailDto['status'];
  provider: string;
  error: string | null;
  created_at: Date;
  sent_at: Date | null;
}

export function mapEmail(row: EmailRow): EmailDto {
  return {
    id: row.id,
    bookingId: row.booking_id,
    toEmail: row.to_email,
    subject: row.subject,
    html: row.html,
    kind: row.kind,
    status: row.status,
    provider: row.provider,
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const KINDS: Record<EmailKind, { subject: (b: BookingDto, s: SettingsDto) => string; intro: string }> = {
  booking_received: {
    subject: (b) => `Request received — ${b.reference}`,
    intro:
      'Your booking request is in. We hold the slot while the studio reviews it, and you will get a confirmation email as soon as it is approved.',
  },
  booking_confirmed: {
    subject: (b) => `Confirmed: ${b.reference}`,
    intro: 'You are on the schedule. Here are the details, and what to have ready before we arrive.',
  },
  booking_completed: {
    subject: (b) => `Thanks for choosing ${b.reference}`,
    intro: 'Your detail is complete. Thanks for trusting us with the paint — a quick review helps other drivers find the studio.',
  },
  booking_cancelled: {
    subject: (b) => `Cancelled: ${b.reference}`,
    intro: 'This appointment has been cancelled and the time slot has been released. You are welcome to rebook any time.',
  },
};

function renderHtml(kind: EmailKind, booking: BookingDto, settings: SettingsDto): string {
  const meta = KINDS[kind];
  const addonLines = booking.addons.length
    ? booking.addons
        .map(
          (addon) =>
            `<tr><td style="padding:4px 0;color:#5f665f;font-size:14px;">${escapeHtml(addon.name)}</td><td align="right" style="padding:4px 0;font-size:14px;">${formatMoney(addon.priceCents)}</td></tr>`,
        )
        .join('')
    : '<tr><td style="padding:4px 0;color:#8a8f86;font-size:14px;">No add-ons</td><td></td></tr>';

  const providerTime = formatInZone(booking.startsAt, settings.timezone);
  const clientTime = formatInZone(booking.startsAt, booking.clientTimezone);
  const zoneNote =
    booking.clientTimezone !== settings.timezone
      ? `<tr><td style="padding:4px 0;color:#8a8f86;font-size:13px;">Your time zone</td><td align="right" style="padding:4px 0;font-size:13px;">${escapeHtml(clientTime)}</td></tr>`
      : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f3f0e9;font-family:'Helvetica Neue',Arial,sans-serif;color:#1c211d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fffdf8;border-radius:18px;overflow:hidden;border:1px solid #e5e0d4;">
          <tr>
            <td style="background:#12160f;padding:22px 28px;">
              <div style="color:#d8f071;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(settings.businessName)}</div>
              <div style="color:#fffdf8;font-family:Georgia,serif;font-size:24px;margin-top:6px;">Appointment ${kind === 'booking_cancelled' ? 'update' : 'details'}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 6px;font-size:13px;color:#8a8f86;letter-spacing:1px;text-transform:uppercase;">Booking ${escapeHtml(booking.reference)}</p>
              <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;line-height:1.3;">Hi ${escapeHtml(booking.customerName.split(' ')[0] || booking.customerName)},</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#3c433d;">${meta.intro}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3eb;border-radius:12px;padding:4px;">
                <tr><td style="padding:14px 16px 4px;color:#8a8f86;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Appointment</td></tr>
                <tr><td style="padding:0 16px 14px;">
                  <div style="font-size:16px;font-weight:600;">${escapeHtml(booking.serviceName)}</div>
                  <div style="font-size:14px;color:#5f665f;margin-top:4px;">${escapeHtml(providerTime)}</div>
                  ${zoneNote}
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                <tr><td style="padding:0 0 6px;color:#8a8f86;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Add-ons</td><td></td></tr>
                ${addonLines}
                <tr><td style="padding-top:10px;border-top:1px solid #e5e0d4;font-weight:600;font-size:15px;">Total</td><td align="right" style="padding-top:10px;border-top:1px solid #e5e0d4;font-weight:600;font-size:15px;">${formatMoney(booking.totalCents)}</td></tr>
              </table>
              <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b726b;">
                ${escapeHtml(settings.address || 'Mobile service — we come to you.')}<br />
                ${escapeHtml(settings.phone || '')}${settings.phone ? '<br />' : ''}
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f6f3eb;color:#8a8f86;font-size:11px;letter-spacing:0.4px;">
              ${escapeHtml(settings.businessName)} · ${escapeHtml(settings.tagline || 'Care in every panel.')}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function deliverEmail(params: {
  bookingId: string;
  to: string;
  kind: EmailKind;
  booking: BookingDto;
  settings: SettingsDto;
}): Promise<EmailDto> {
  const meta = KINDS[params.kind];
  const subject = meta.subject(params.booking, params.settings);
  const html = renderHtml(params.kind, params.booking, params.settings);

  let status: EmailDto['status'] = 'logged';
  let provider = 'outbox';
  let error: string | null = null;
  let sentAt: Date | null = null;

  if (config.resendApiKey) {
    provider = 'resend';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: config.mailFrom, to: [params.to], subject, html }),
      });
      if (!response.ok) throw new Error(`Resend responded ${response.status}`);
      status = 'sent';
      sentAt = new Date();
    } catch (cause) {
      status = 'failed';
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const result = await query<EmailRow>(
    `INSERT INTO emails (id, booking_id, to_email, subject, html, kind, status, provider, error, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [newId(), params.bookingId, params.to, subject, html, params.kind, status, provider, error, sentAt],
  );
  return mapEmail(result.rows[0]);
}

export async function sendBookingEmail(
  kind: EmailKind,
  booking: BookingDto,
  settings: SettingsDto,
): Promise<void> {
  try {
    await deliverEmail({
      bookingId: booking.id,
      to: booking.customerEmail,
      kind,
      booking,
      settings,
    });
  } catch (cause) {
    console.error('Failed to record notification email', cause);
  }
}

export async function listEmails(): Promise<EmailDto[]> {
  const result = await query<EmailRow>('SELECT * FROM emails ORDER BY created_at DESC LIMIT 100');
  return result.rows.map(mapEmail);
}
