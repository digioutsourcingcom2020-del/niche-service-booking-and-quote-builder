import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import type { BookingDto, BookingStatus } from '@shared/types';
import { formatDuration, formatMoney } from '@shared/pricing';
import { Icon } from '../components/Icon';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageLoader,
  Spinner,
  StatusBadge,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate, formatDateTime, formatLongDate, formatTime, initials, zoneLabel } from '../lib/format';
import { useStudio } from '../lib/studio';
import { useToast } from '../lib/toast';
import { PageHead } from './shared';

const FILTERS: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function BookingsPage() {
  const studio = useStudio();
  const toast = useToast();
  const [data, { refetch }] = createResource(api.admin.bookings);
  const [filter, setFilter] = createSignal<'all' | BookingStatus>('all');
  const [search, setSearch] = createSignal('');
  const [selected, setSelected] = createSignal<BookingDto | null>(null);
  const [cancelling, setCancelling] = createSignal<BookingDto | null>(null);
  const [busyId, setBusyId] = createSignal<string | null>(null);

  const tz = () => studio.settings()?.timezone ?? 'UTC';
  const bookings = () => data()?.bookings ?? [];

  const counts = createMemo(() => {
    const list = bookings();
    return {
      all: list.length,
      pending: list.filter((booking) => booking.status === 'pending').length,
      confirmed: list.filter((booking) => booking.status === 'confirmed').length,
      completed: list.filter((booking) => booking.status === 'completed').length,
      cancelled: list.filter((booking) => booking.status === 'cancelled').length,
    };
  });

  const filtered = createMemo(() => {
    const query = search().trim().toLowerCase();
    return bookings().filter((booking) => {
      if (filter() !== 'all' && booking.status !== filter()) return false;
      if (!query) return true;
      return [booking.customerName, booking.customerEmail, booking.reference, booking.serviceName]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  const advance = async (booking: BookingDto, next: BookingStatus) => {
    setBusyId(booking.id);
    try {
      await api.admin.setStatus(booking.id, next);
      toast(
        next === 'confirmed'
          ? `Confirmed ${booking.reference} — the customer has been emailed.`
          : `Marked ${booking.reference} completed — a thank-you email is on its way.`,
      );
      await refetch();
    } catch (cause) {
      toast(cause instanceof ApiError ? cause.message : 'Could not update the booking.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async () => {
    const booking = cancelling();
    if (!booking) return;
    await api.admin.setStatus(booking.id, 'cancelled');
    toast(`Cancelled ${booking.reference} — the slot has been released.`);
    await refetch();
  };

  return (
    <div class="admin-page">
      <PageHead
        title="Bookings"
        subtitle="Requests, confirmations, and completed details — all with email notifications."
      >
        <a class="btn btn-outline btn-sm" href="/#book" target="_blank" rel="noreferrer">
          <Icon name="external" size={15} /> Public booking page
        </a>
      </PageHead>

      <div class="toolbar">
        <div class="segmented" role="tablist" aria-label="Filter bookings">
          <For each={FILTERS}>
            {(item) => (
              <button
                type="button"
                role="tab"
                class="seg-btn"
                classList={{ active: filter() === item.value }}
                aria-selected={filter() === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span class="seg-count">{counts()[item.value]}</span>
              </button>
            )}
          </For>
        </div>
        <label class="search-box">
          <Icon name="eye" size={15} />
          <input
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search name, email, reference…"
            aria-label="Search bookings"
          />
        </label>
      </div>

      <Show when={!data.loading} fallback={<PageLoader label="Loading bookings…" />}>
        <Show
          when={!data.error}
          fallback={
            <div class="panel loader-panel">
              <strong>Bookings could not load.</strong>
              <span class="muted">Try refreshing the page.</span>
            </div>
          }
        >
          <div class="panel table-panel">
            <Show
              when={filtered().length > 0}
              fallback={
                <EmptyState
                  icon="inbox"
                  title={search() ? 'No matches' : 'Nothing in this view'}
                  message={
                    search()
                      ? 'Try a different name, email, or reference.'
                      : 'New booking requests will land here automatically.'
                  }
                />
              }
            >
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Detail</th>
                      <th>When</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th class="th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={filtered()}>
                      {(booking) => (
                        <tr>
                          <td>
                            <div class="cell-customer">
                              <span class="avatar avatar-sm">{initials(booking.customerName)}</span>
                              <div>
                                <strong>{booking.customerName}</strong>
                                <small>{booking.customerEmail}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div class="cell-detail">
                              <strong>{booking.serviceName}</strong>
                              <small>
                                {booking.addons.length > 0
                                  ? `+${booking.addons.length} add-on${booking.addons.length > 1 ? 's' : ''}`
                                  : 'No add-ons'}{' '}
                                · {formatDuration(booking.durationMin)}
                              </small>
                            </div>
                          </td>
                          <td>
                            <div class="cell-when">
                              <strong>{formatDate(booking.startsAt, tz())}</strong>
                              <small>{formatTime(booking.startsAt, tz())}</small>
                            </div>
                          </td>
                          <td class="cell-total">{formatMoney(booking.totalCents)}</td>
                          <td>
                            <StatusBadge status={booking.status} />
                          </td>
                          <td>
                            <div class="row-actions">
                              <button
                                type="button"
                                class="icon-btn"
                                title="View details"
                                onClick={() => setSelected(booking)}
                              >
                                <Icon name="eye" size={16} />
                              </button>
                              <Show when={booking.status === 'pending'}>
                                <button
                                  type="button"
                                  class="icon-btn success"
                                  title="Confirm booking"
                                  disabled={busyId() === booking.id}
                                  onClick={() => void advance(booking, 'confirmed')}
                                >
                                  {busyId() === booking.id ? <Spinner size={14} /> : <Icon name="check" size={16} />}
                                </button>
                              </Show>
                              <Show when={booking.status === 'confirmed'}>
                                <button
                                  type="button"
                                  class="icon-btn success"
                                  title="Mark completed"
                                  disabled={busyId() === booking.id}
                                  onClick={() => void advance(booking, 'completed')}
                                >
                                  {busyId() === booking.id ? <Spinner size={14} /> : <Icon name="check" size={16} />}
                                </button>
                              </Show>
                              <Show when={booking.status === 'pending' || booking.status === 'confirmed'}>
                                <button
                                  type="button"
                                  class="icon-btn danger"
                                  title="Cancel booking"
                                  onClick={() => setCancelling(booking)}
                                >
                                  <Icon name="x" size={16} />
                                </button>
                              </Show>
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
      </Show>

      <Modal
        open={selected() !== null}
        title={selected() ? `Booking ${selected()!.reference}` : 'Booking'}
        subtitle={selected() ? `${selected()!.customerName} · created ${formatDateTime(selected()!.createdAt, tz())}` : undefined}
        wide
        onClose={() => setSelected(null)}
        footer={
          selected() && (selected()!.status === 'pending' || selected()!.status === 'confirmed') ? (
            <>
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => {
                  setCancelling(selected());
                  setSelected(null);
                }}
              >
                Cancel booking
              </button>
              <button
                type="button"
                class="btn btn-primary"
                disabled={busyId() === selected()!.id}
                onClick={() => {
                  const booking = selected()!;
                  void advance(booking, booking.status === 'pending' ? 'confirmed' : 'completed').then(() =>
                    setSelected(null),
                  );
                }}
              >
                {selected()!.status === 'pending' ? 'Confirm booking' : 'Mark completed'}
              </button>
            </>
          ) : (
            <button type="button" class="btn btn-ghost" onClick={() => setSelected(null)}>
              Close
            </button>
          )
        }
      >
        <Show when={selected()}>
          {(booking) => (
            <div class="detail-sheet">
              <div class="detail-status">
                <StatusBadge status={booking().status} />
                <span class="detail-price">{formatMoney(booking().totalCents)}</span>
              </div>

              <div class="detail-grid">
                <div class="detail-block">
                  <span class="detail-label">Customer</span>
                  <strong>{booking().customerName}</strong>
                  <a href={`mailto:${booking().customerEmail}`}>{booking().customerEmail}</a>
                  <Show when={booking().customerPhone}>
                    <a href={`tel:${booking().customerPhone}`}>{booking().customerPhone}</a>
                  </Show>
                </div>
                <div class="detail-block">
                  <span class="detail-label">Appointment</span>
                  <strong>{formatLongDate(booking().startsAt, tz())}</strong>
                  <span>
                    {formatTime(booking().startsAt, tz())} – {formatTime(booking().endsAt, tz())} ·{' '}
                    {zoneLabel(tz())}
                  </span>
                  <em class="muted">Client time zone: {booking().clientTimezone.replaceAll('_', ' ')}</em>
                </div>
              </div>

              <div class="detail-block">
                <span class="detail-label">Services</span>
                <div class="detail-lines">
                  <div>
                    <span>{booking().serviceName}</span>
                    <strong>{formatMoney(booking().basePriceCents)}</strong>
                  </div>
                  <For each={booking().addons}>
                    {(addon) => (
                      <div>
                        <span>
                          {addon.name} <em class="muted">+{formatDuration(addon.durationMin)}</em>
                        </span>
                        <strong>{formatMoney(addon.priceCents)}</strong>
                      </div>
                    )}
                  </For>
                  <div class="detail-total">
                    <span>Total · {formatDuration(booking().durationMin)} on site</span>
                    <strong>{formatMoney(booking().totalCents)}</strong>
                  </div>
                </div>
              </div>

              <Show when={booking().notes}>
                <div class="detail-block">
                  <span class="detail-label">Customer notes</span>
                  <p class="detail-notes">{booking().notes}</p>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Modal>

      <ConfirmDialog
        open={cancelling() !== null}
        title="Cancel this booking?"
        message={
          cancelling()
            ? `This releases ${formatDate(cancelling()!.startsAt, tz())} at ${formatTime(cancelling()!.startsAt, tz())} and emails ${cancelling()!.customerName}. This cannot be undone.`
            : ''
        }
        confirmLabel="Cancel booking"
        tone="danger"
        onConfirm={cancel}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}
