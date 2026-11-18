import { A } from '@solidjs/router';
import { createResource, createSignal, For, Show } from 'solid-js';
import type { BookingDto } from '@shared/types';
import { formatDuration, formatMoney } from '@shared/pricing';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import {
  ConfirmDialog,
  EmptyState,
  PageLoader,
  Spinner,
  StatusBadge,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate, formatTime, initials } from '../lib/format';
import { useStudio } from '../lib/studio';
import { useToast } from '../lib/toast';
import { PageHead } from './shared';

function StatCard(props: { label: string; value: string; note: string; icon: IconName; accent?: boolean }) {
  return (
    <div class="stat-card" classList={{ 'stat-accent': props.accent }}>
      <div class="stat-top">
        <span>{props.label}</span>
        <span class="stat-icon">
          <Icon name={props.icon} size={16} />
        </span>
      </div>
      <strong class="stat-value">{props.value}</strong>
      <span class="stat-note">{props.note}</span>
    </div>
  );
}

export default function OverviewPage() {
  const studio = useStudio();
  const toast = useToast();
  const [overview, { refetch }] = createResource(api.admin.overview);
  const [busyId, setBusyId] = createSignal<string | null>(null);
  const [cancelling, setCancelling] = createSignal<BookingDto | null>(null);

  const tz = () => studio.settings()?.timezone ?? 'UTC';
  const pendingNext = () => (overview()?.next ?? []).filter((booking) => booking.status === 'pending');

  const confirm = async (booking: BookingDto) => {
    setBusyId(booking.id);
    try {
      await api.admin.setStatus(booking.id, 'confirmed');
      toast(`Confirmed ${booking.reference} — customer notified.`);
      await refetch();
    } catch (cause) {
      toast(cause instanceof ApiError ? cause.message : 'Could not confirm the booking.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async () => {
    const booking = cancelling();
    if (!booking) return;
    await api.admin.setStatus(booking.id, 'cancelled');
    toast(`Cancelled ${booking.reference} — the slot is open again.`);
    await refetch();
  };

  return (
    <div class="admin-page">
      <PageHead
        title="Studio overview"
        subtitle={`Today is ${formatDate(new Date().toISOString(), tz())} in ${tz().replaceAll('_', ' ')}.`}
      >
        <A href="/admin/bookings" class="btn btn-outline btn-sm">
          <Icon name="list" size={15} /> All bookings
        </A>
        <A href="/#book" class="btn btn-primary btn-sm" target="_blank">
          <Icon name="plus" size={15} /> New booking
        </A>
      </PageHead>

      <Show when={overview()} fallback={<PageLoader label="Loading the studio snapshot…" />}>
        {(data) => (
          <>
            <div class="stat-grid">
              <StatCard
                label="Revenue this month"
                value={formatMoney(data().stats.revenueCents)}
                note="Confirmed + completed details"
                icon="tag"
                accent
              />
              <StatCard
                label="Pending requests"
                value={String(data().stats.pending)}
                note="Waiting on your review"
                icon="clock"
              />
              <StatCard
                label="Upcoming appointments"
                value={String(data().stats.upcoming)}
                note="Confirmed and pending"
                icon="calendar"
              />
              <StatCard
                label="Completion rate"
                value={`${data().stats.completionRate}%`}
                note={`${data().stats.completed} completed · ${data().stats.customers} customers`}
                icon="check"
              />
            </div>

            <div class="overview-grid">
              <section class="panel">
                <div class="panel-head">
                  <div>
                    <h2>Today at the studio</h2>
                    <p>{formatDate(new Date().toISOString(), tz())}</p>
                  </div>
                  <span class="count-pill">{data().today.length}</span>
                </div>
                <div class="panel-body flush">
                  <Show
                    when={data().today.length > 0}
                    fallback={
                      <EmptyState
                        title="A clear driveway"
                        message="Nothing on today's schedule. New requests will show up here."
                      />
                    }
                  >
                    <ul class="schedule-list">
                      <For each={data().today}>
                        {(booking) => (
                          <li>
                            <span class="schedule-time">
                              {formatTime(booking.startsAt, tz())}
                              <small>{formatDuration(booking.durationMin)}</small>
                            </span>
                            <span class="avatar avatar-sm">{initials(booking.customerName)}</span>
                            <span class="schedule-copy">
                              <strong>{booking.customerName}</strong>
                              <small>
                                {booking.serviceName}
                                {booking.addons.length > 0 ? ` · ${booking.addons.length} add-on` : ''}
                              </small>
                            </span>
                            <StatusBadge status={booking.status} />
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </section>

              <section class="panel">
                <div class="panel-head">
                  <div>
                    <h2>Needs your review</h2>
                    <p>Pending requests hold their slot for 24 hours</p>
                  </div>
                  <span class="count-pill">{pendingNext().length}</span>
                </div>
                <div class="panel-body flush">
                  <Show
                    when={pendingNext().length > 0}
                    fallback={
                      <EmptyState
                        icon="inbox"
                        title="All caught up"
                        message="No pending requests right now. Confirmations go out automatically when you approve."
                      />
                    }
                  >
                    <ul class="schedule-list">
                      <For each={pendingNext()}>
                        {(booking) => (
                          <li>
                            <span class="schedule-time">
                              {formatDate(booking.startsAt, tz())}
                              <small>{formatTime(booking.startsAt, tz())}</small>
                            </span>
                            <span class="avatar avatar-sm">{initials(booking.customerName)}</span>
                            <span class="schedule-copy">
                              <strong>{booking.customerName}</strong>
                              <small>
                                {booking.serviceName} · {formatMoney(booking.totalCents)}
                              </small>
                            </span>
                            <span class="row-actions">
                              <button
                                type="button"
                                class="btn btn-primary btn-xs"
                                disabled={busyId() === booking.id}
                                onClick={() => void confirm(booking)}
                              >
                                {busyId() === booking.id ? <Spinner size={13} /> : <Icon name="check" size={14} />}
                                Confirm
                              </button>
                              <button
                                type="button"
                                class="icon-btn danger"
                                title="Cancel request"
                                onClick={() => setCancelling(booking)}
                              >
                                <Icon name="x" size={16} />
                              </button>
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </section>
            </div>

            <section class="panel">
              <div class="panel-head">
                <div>
                  <h2>Next up</h2>
                  <p>The next six appointments across the calendar</p>
                </div>
                <A href="/admin/bookings" class="text-btn">
                  Manage bookings <Icon name="arrowRight" size={14} />
                </A>
              </div>
              <div class="panel-body flush">
                <Show
                  when={data().next.length > 0}
                  fallback={<EmptyState title="No upcoming bookings yet" message="Share the booking link to fill the calendar." />}
                >
                  <ul class="schedule-list">
                    <For each={data().next}>
                      {(booking) => (
                        <li>
                          <span class="schedule-time">
                            {formatDate(booking.startsAt, tz())}
                            <small>{formatTime(booking.startsAt, tz())}</small>
                          </span>
                          <span class="avatar avatar-sm">{initials(booking.customerName)}</span>
                          <span class="schedule-copy">
                            <strong>
                              {booking.customerName} <span class="muted">· {booking.reference}</span>
                            </strong>
                            <small>
                              {booking.serviceName} · {formatDuration(booking.durationMin)} ·{' '}
                              {formatMoney(booking.totalCents)}
                            </small>
                          </span>
                          <StatusBadge status={booking.status} />
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            </section>
          </>
        )}
      </Show>

      <ConfirmDialog
        open={cancelling() !== null}
        title="Cancel this request?"
        message={
          cancelling()
            ? `This releases ${formatDate(cancelling()!.startsAt, tz())} at ${formatTime(cancelling()!.startsAt, tz())} and emails ${cancelling()!.customerName}. The slot immediately becomes bookable again.`
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
