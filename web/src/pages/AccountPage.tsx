import { A, useLocation, useNavigate } from '@solidjs/router';
import { createEffect, createMemo, createResource, For, Show } from 'solid-js';
import { formatDuration, formatMoney } from '@shared/pricing';
import { Icon } from '../components/Icon';
import { PageLoader, StatusBadge } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  currentZone,
  formatDateTime,
  formatLongDate,
  formatTime,
  zoneLabel,
} from '../lib/format';
import { useSite } from '../lib/site';
import { useToast } from '../lib/toast';

export default function AccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const site = useSite();
  const toast = useToast();

  const clientZone = currentZone();
  const studioZone = () => site()?.settings.timezone ?? 'UTC';

  createEffect(() => {
    if (auth.ready() && !auth.user()) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  });

  const [data] = createResource(
    () => auth.user()?.id ?? null,
    async (id) => (id ? api.myBookings() : null),
  );

  const bookings = () => data()?.bookings ?? [];
  const upcoming = createMemo(() =>
    bookings()
      .filter((booking) => booking.status !== 'cancelled' && new Date(booking.startsAt).getTime() >= Date.now())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
  );
  const history = createMemo(() =>
    bookings()
      .filter((booking) => booking.status === 'cancelled' || new Date(booking.startsAt).getTime() < Date.now())
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
  );

  const signOut = async () => {
    await auth.logout();
    toast('Signed out.');
    navigate('/');
  };

  return (
    <Show when={auth.user()} fallback={<PageLoader label="Checking your account…" />}>
      {(user) => (
        <section class="account-page">
          <div class="account-band">
            <div class="shell account-band-inner">
              <div>
                <p class="eyebrow on-dark">Client portal</p>
                <h1>My bookings</h1>
                <p>
                  Signed in as {user().email} · times shown in {zoneLabel(clientZone)} ({clientZone.replaceAll('_', ' ')})
                </p>
              </div>
              <div class="account-band-actions">
                <A href="/#book" class="btn btn-lime">
                  <Icon name="plus" size={16} /> New booking
                </A>
                <button type="button" class="btn btn-ghost-on-dark" onClick={() => void signOut()}>
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </div>
            </div>
          </div>

          <div class="shell account-content">
            <Show
              when={!data.loading}
              fallback={<PageLoader label="Loading your bookings…" />}
            >
              <Show
                when={!data.error}
                fallback={
                  <div class="panel loader-panel">
                    <strong>We couldn't load your bookings.</strong>
                    <span class="muted">Refresh the page to try again.</span>
                  </div>
                }
              >
                <section class="account-section">
                  <div class="section-row">
                    <h2>Upcoming</h2>
                    <span class="count-pill">{upcoming().length}</span>
                  </div>
                  <Show
                    when={upcoming().length > 0}
                    fallback={
                      <div class="panel empty-panel">
                        <Icon name="car" size={22} />
                        <strong>No appointments on the books.</strong>
                        <p>Build a quote and pick a slot — the studio confirms every request by email.</p>
                        <A href="/#book" class="btn btn-primary btn-sm">Book a detail</A>
                      </div>
                    }
                  >
                    <div class="booking-cards">
                      <For each={upcoming()}>
                        {(booking) => (
                          <article class="booking-card">
                            <div class="booking-card-top">
                              <div>
                                <span class="booking-ref">{booking.reference}</span>
                                <h3>{booking.serviceName}</h3>
                              </div>
                              <StatusBadge status={booking.status} />
                            </div>
                            <div class="booking-card-meta">
                              <span>
                                <Icon name="calendar" size={15} />
                                {formatLongDate(booking.startsAt, clientZone)} · {formatTime(booking.startsAt, clientZone)}{' '}
                                {zoneLabel(clientZone)}
                              </span>
                              <span>
                                <Icon name="clock" size={15} /> {formatDuration(booking.durationMin)}
                              </span>
                              <span>
                                <Icon name="tag" size={15} /> {formatMoney(booking.totalCents)}
                              </span>
                            </div>
                            <Show when={booking.addons.length > 0}>
                              <p class="booking-extras">{booking.addons.map((addon) => addon.name).join(' · ')}</p>
                            </Show>
                            <Show when={clientZone !== studioZone()}>
                              <p class="booking-zone">Studio time: {formatDateTime(booking.startsAt, studioZone())}</p>
                            </Show>
                          </article>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>

                <section class="account-section">
                  <div class="section-row">
                    <h2>History</h2>
                    <span class="count-pill">{history().length}</span>
                  </div>
                  <Show
                    when={history().length > 0}
                    fallback={<p class="muted small">Past and cancelled bookings will show here.</p>}
                  >
                    <div class="booking-cards">
                      <For each={history()}>
                        {(booking) => (
                          <article class="booking-card is-muted">
                            <div class="booking-card-top">
                              <div>
                                <span class="booking-ref">{booking.reference}</span>
                                <h3>{booking.serviceName}</h3>
                              </div>
                              <StatusBadge status={booking.status} />
                            </div>
                            <div class="booking-card-meta">
                              <span>
                                <Icon name="calendar" size={15} />
                                {formatLongDate(booking.startsAt, clientZone)} · {formatTime(booking.startsAt, clientZone)}
                              </span>
                              <span>
                                <Icon name="clock" size={15} /> {formatDuration(booking.durationMin)}
                              </span>
                              <span>
                                <Icon name="tag" size={15} /> {formatMoney(booking.totalCents)}
                              </span>
                            </div>
                          </article>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>

                <p class="account-help">
                  Need to change an appointment? Reply to your confirmation email at least 24 hours ahead, or call the
                  studio at {site()?.settings.phone ?? 'the studio'}.
                </p>
              </Show>
            </Show>
          </div>
        </section>
      )}
    </Show>
  );
}
