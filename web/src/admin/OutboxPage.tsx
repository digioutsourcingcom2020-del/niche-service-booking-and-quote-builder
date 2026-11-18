import { createResource, createSignal, For, Show } from 'solid-js';
import type { EmailDto } from '@shared/types';
import { Icon } from '../components/Icon';
import { Modal, PageLoader } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime, initials } from '../lib/format';
import { PageHead } from './shared';

const KIND_LABELS: Record<string, string> = {
  booking_received: 'Request receipt',
  booking_confirmed: 'Confirmation',
  booking_completed: 'Thank you',
  booking_cancelled: 'Cancellation',
};

const STATUS_LABELS: Record<EmailDto['status'], string> = {
  sent: 'Delivered',
  logged: 'Outbox',
  failed: 'Failed',
};

export default function OutboxPage() {
  const [data] = createResource(api.admin.emails);
  const [selected, setSelected] = createSignal<EmailDto | null>(null);

  const emails = () => data()?.emails ?? [];
  const usingOutbox = () => emails().some((email) => email.provider === 'outbox');

  return (
    <div class="admin-page">
      <PageHead
        title="Outbox"
        subtitle="Every lifecycle email the studio has generated — receipts, confirmations, and follow-ups."
      />

      <Show when={usingOutbox()}>
        <div class="notice notice-info">
          <Icon name="inbox" size={16} />
          <span>
            <strong>Outbox mode.</strong> Emails are captured here locally. Set <code>RESEND_API_KEY</code> in{' '}
            <code>.env</code> to deliver them for real through Resend.
          </span>
        </div>
      </Show>

      <Show when={!data.loading} fallback={<PageLoader label="Loading the outbox…" />}>
        <div class="panel table-panel">
          <Show
            when={emails().length > 0}
            fallback={
              <div class="empty-state">
                <strong>The outbox is empty</strong>
                <p>Booking receipts and confirmations will appear here as clients book.</p>
              </div>
            }
          >
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Sent</th>
                    <th>Status</th>
                    <th class="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={emails()}>
                    {(email) => (
                      <tr>
                        <td>
                          <div class="cell-customer">
                            <span class="avatar avatar-sm">{initials(email.toEmail.split('@')[0])}</span>
                            <div>
                              <strong>{email.toEmail}</strong>
                              <small>{email.provider === 'resend' ? 'Resend' : 'Local outbox'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="cell-detail">
                            <strong>{email.subject}</strong>
                            <small>{email.bookingId ? 'Linked to a booking' : 'Studio notification'}</small>
                          </div>
                        </td>
                        <td>{KIND_LABELS[email.kind] ?? email.kind}</td>
                        <td>{formatDateTime(email.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}</td>
                        <td>
                          <span class={`badge badge-email-${email.status}`}>{STATUS_LABELS[email.status]}</span>
                        </td>
                        <td>
                          <div class="row-actions">
                            <button
                              type="button"
                              class="icon-btn"
                              title="Preview email"
                              onClick={() => setSelected(email)}
                            >
                              <Icon name="eye" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Show>

      <Modal
        open={selected() !== null}
        title={selected()?.subject ?? 'Email preview'}
        subtitle={selected() ? `To ${selected()!.toEmail} · ${STATUS_LABELS[selected()!.status]}` : undefined}
        wide
        onClose={() => setSelected(null)}
        footer={
          <button type="button" class="btn btn-ghost" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        <Show when={selected()}>
          {(email) => (
            <div class="email-frame-wrap">
              <iframe
                class="email-frame"
                title="Email preview"
                sandbox=""
                srcdoc={email().html}
              />
              <Show when={email().error}>
                <div class="notice notice-error">
                  <Icon name="alert" size={16} />
                  <span>{email().error}</span>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Modal>
    </div>
  );
}
