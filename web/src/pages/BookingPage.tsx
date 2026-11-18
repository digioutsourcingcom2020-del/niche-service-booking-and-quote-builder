import { A } from '@solidjs/router';
import { createEffect, createMemo, createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import type { BookingDto, SlotDto, SettingsDto } from '@shared/types';
import { formatDuration, formatMoney, quoteFor } from '@shared/pricing';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  TIMEZONES,
  currentZone,
  dateKeys,
  dayNumber,
  formatDate,
  formatDateKey,
  formatDateTime,
  formatLongDate,
  formatTime,
  hourInZone,
  monthLabel,
  openDateKeys,
  relativeDay,
  zoneLabel,
} from '../lib/format';
import { useSite } from '../lib/site';
import { useToast } from '../lib/toast';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = [
  { number: 1, label: 'Your detail' },
  { number: 2, label: 'Date & time' },
  { number: 3, label: 'Your details' },
];

function openDaysLabel(settings: SettingsDto | undefined): string {
  if (!settings) return 'Tue – Sat';
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const open = order.filter((weekday) => settings.hours.find((hour) => hour.weekday === weekday)?.isOpen);
  if (open.length === 0) return 'By appointment';
  if (open.length === 7) return 'Every day';
  const contiguous = open.every((weekday, index) => index === 0 || order[order.indexOf(weekday) - 1] === open[index - 1]);
  return contiguous ? `${names[open[0]]} – ${names[open[open.length - 1]]}` : open.map((weekday) => names[weekday]).join(', ');
}

export default function BookingPage() {
  const auth = useAuth();
  const site = useSite();
  const toast = useToast();

  const [step, setStep] = createSignal<Step>(1);
  const [serviceId, setServiceId] = createSignal<string | null>(null);
  const [addonIds, setAddonIds] = createSignal<string[]>([]);
  const [date, setDate] = createSignal('');
  const [timezone, setTimezone] = createSignal(currentZone());
  const [slot, setSlot] = createSignal<SlotDto | null>(null);
  const [customerName, setCustomerName] = createSignal('');
  const [customerEmail, setCustomerEmail] = createSignal('');
  const [customerPhone, setCustomerPhone] = createSignal('');
  const [customerNotes, setCustomerNotes] = createSignal('');
  const [formError, setFormError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [booking, setBooking] = createSignal<BookingDto | null>(null);
  const [dates, setDates] = createSignal<string[]>([]);

  const settings = () => site()?.settings;
  const studioTz = () => settings()?.timezone ?? 'UTC';
  const services = () => site()?.services ?? [];
  const addons = () => site()?.addons ?? [];

  const selectedService = () => services().find((service) => service.id === serviceId()) ?? null;
  const selectedAddons = () => addons().filter((addon) => addonIds().includes(addon.id));

  const quote = createMemo(() => {
    const service = selectedService();
    if (!service) return null;
    return quoteFor(
      service.basePriceCents,
      service.durationMin,
      selectedAddons().map((addon) => ({
        id: addon.id,
        name: addon.name,
        priceCents: addon.priceCents,
        durationMin: addon.durationMin,
      })),
    );
  });

  createEffect(() => {
    const studio = settings();
    if (!studio || dates().length > 0) return;
    const openWeekdays = studio.hours.filter((hour) => hour.isOpen).map((hour) => hour.weekday);
    const keys = openDateKeys(studio.timezone, studio.horizonDays, openWeekdays);
    const usable = keys.length ? keys : dateKeys(studio.timezone, studio.horizonDays);
    setDates(usable);
    if (!date()) setDate(usable[0] ?? '');
  });

  createEffect(() => {
    serviceId();
    addonIds().join(',');
    date();
    setSlot(null);
  });

  createEffect(() => {
    const user = auth.user();
    if (!user) return;
    if (!customerName()) setCustomerName(user.name);
    if (!customerEmail()) setCustomerEmail(user.email);
  });

  const availabilitySource = createMemo(() => {
    const service = selectedService();
    const day = date();
    if (!service || !day) return null;
    return { date: day, serviceId: service.id, addons: [...addonIds()].sort().join(',') };
  });

  const [availability, { refetch: refetchAvailability }] = createResource(availabilitySource, async (source) => {
    if (!source) return null;
    return api.availability(source.date, source.serviceId, source.addons ? source.addons.split(',') : []);
  });

  const slotGroups = createMemo(() => {
    const slots = availability()?.slots ?? [];
    const zone = timezone();
    const buckets = [
      { label: 'Morning', hint: 'before noon', items: [] as SlotDto[] },
      { label: 'Afternoon', hint: 'noon – 5 pm', items: [] as SlotDto[] },
      { label: 'Evening', hint: 'after 5 pm', items: [] as SlotDto[] },
    ];
    for (const item of slots) {
      const hour = hourInZone(item.startsAt, zone);
      buckets[hour < 12 ? 0 : hour < 17 ? 1 : 2].items.push(item);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  });

  const toggleAddon = (id: string) => {
    setAddonIds((list) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]));
  };

  const goStep = (next: Step) => {
    setStep(next);
    document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    const service = selectedService();
    const chosen = slot();
    if (!service || !chosen || submitting()) return;
    if (customerName().trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail().trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = await api.createBooking({
        serviceId: service.id,
        addonIds: addonIds(),
        startsAt: chosen.startsAt,
        timezone: timezone(),
        customer: {
          name: customerName().trim(),
          email: customerEmail().trim(),
          phone: customerPhone().trim(),
          notes: customerNotes().trim(),
        },
      });
      setBooking(result.booking);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Something went wrong while booking. Please try again.';
      setFormError(message);
      toast(message, 'error');
      if (error instanceof ApiError && error.status === 409) {
        setSlot(null);
        void refetchAvailability();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setServiceId(null);
    setAddonIds([]);
    setSlot(null);
    setBooking(null);
    setFormError('');
    setCustomerNotes('');
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };

  const heroService = () => services()[0] ?? null;
  const zonesWithCurrent = createMemo(() => {
    const list = TIMEZONES.slice();
    if (!list.includes(timezone())) list.unshift(timezone());
    return list;
  });

  return (
    <>
      <section class="hero">
        <div class="shell hero-inner">
          <div class="hero-copy">
            <p class="eyebrow on-dark">
              <span class="pulse-dot" /> Mobile detailing studio · San Francisco
            </p>
            <h1>
              Showroom shine,
              <br />
              <em>at your curb.</em>
            </h1>
            <p class="hero-sub">
              Choose a detail, add the extras you want, and watch the quote update as you go. We bring the water,
              power, and a spotless finish to your driveway.
            </p>
            <div class="hero-actions">
              <a href="#book" class="btn btn-lime">
                Build my quote
                <Icon name="arrowRight" />
              </a>
              <a href="#how" class="btn btn-ghost-on-dark">
                How it works
              </a>
            </div>
            <div class="hero-proof">
              <span>
                <Icon name="shield" size={16} /> Licensed &amp; insured
              </span>
              <span>
                <Icon name="droplet" size={16} /> Water &amp; power included
              </span>
              <span>
                <Icon name="clock" size={16} /> Same-week availability
              </span>
            </div>
          </div>

          <div class="hero-side">
            <div class="hero-ticket">
              <div class="ticket-head">
                <span class="ticket-kicker">Most booked</span>
                <span class="ticket-seal">
                  <Icon name="sparkles" size={14} /> Studio pick
                </span>
              </div>
              <h3>{heroService()?.name ?? 'Signature Wash & Wax'}</h3>
              <p class="ticket-desc">
                {heroService()?.description ?? 'Hand wash, clay bar decontamination, and a carnauba wax for deep gloss.'}
              </p>
              <div class="ticket-meta">
                <span>
                  <Icon name="clock" size={15} /> {formatDuration(heroService()?.durationMin ?? 90)}
                </span>
                <span>
                  <Icon name="mapPin" size={15} /> Your driveway
                </span>
              </div>
              <div class="ticket-rule" />
              <div class="ticket-price">
                <span>From</span>
                <strong>{formatMoney(heroService()?.basePriceCents ?? 14000)}</strong>
              </div>
              <p class="ticket-note">Live quote updates as you add extras.</p>
            </div>
            <div class="hero-stats">
              <div>
                <strong>{openDaysLabel(settings())}</strong>
                <span>Open days</span>
              </div>
              <div>
                <strong>{settings()?.horizonDays ?? 14} days</strong>
                <span>Booking window</span>
              </div>
              <div>
                <strong>{formatDuration(settings()?.leadMinutes ?? 120)}</strong>
                <span>Notice needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="how-section" id="how">
        <div class="shell">
          <div class="section-head">
            <p class="eyebrow dark">The process</p>
            <h2>Three steps. One very clean car.</h2>
          </div>
          <div class="how-grid">
            <article class="how-card">
              <span class="how-number">01</span>
              <h3>Build your quote</h3>
              <p>Pick a detail and layer on extras. Pricing and timing update live — no phone tag, no surprises.</p>
            </article>
            <article class="how-card">
              <span class="how-number">02</span>
              <h3>Lock a real slot</h3>
              <p>See genuine availability and pick a time in your own time zone. The slot is held the moment you book.</p>
            </article>
            <article class="how-card">
              <span class="how-number">03</span>
              <h3>We come to you</h3>
              <p>We confirm by email, arrive with everything we need, and finish with a walkaround before payment.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="booking-section" id="book">
        <div class="shell">
          <div class="section-head booking-head">
            <div>
              <p class="eyebrow dark">Quote builder</p>
              <h2>Let's price your detail.</h2>
            </div>
            <p class="section-sub">
              Live estimates, real availability. The studio holds your slot for 24 hours while it reviews the request.
            </p>
          </div>

          <Show
            when={site()}
            fallback={
              <Show
                when={!site.loading}
                fallback={
                  <div class="panel loader-panel">
                    <Spinner size={24} />
                    <span>Loading the studio…</span>
                  </div>
                }
              >
                <div class="panel loader-panel">
                  <strong>We couldn't load the booking studio.</strong>
                  <span class="muted">Check that the API server is running, then refresh the page.</span>
                </div>
              </Show>
            }
          >
            {(profile) => (
              <div class="booking-grid">
                <div class="wizard-card" id="wizard">
                  <div class="steps">
                    <For each={STEP_LABELS}>
                      {(item) => (
                        <div
                          class="step"
                          classList={{ active: step() === item.number, done: step() > item.number }}
                        >
                          <span class="step-index">
                            <Show when={step() > item.number} fallback={item.number}>
                              <Icon name="check" size={13} strokeWidth={2.4} />
                            </Show>
                          </span>
                          <span class="step-label">{item.label}</span>
                        </div>
                      )}
                    </For>
                  </div>

                  <Switch>
                    <Match when={step() === 1}>
                      <div class="wizard-body">
                        <div class="wizard-heading">
                          <h3>Pick your detail</h3>
                          <p>Every detail is done at your location. Prices shown are the studio base rate.</p>
                        </div>
                        <div class="service-list" id="services">
                          <For each={profile().services}>
                            {(service) => (
                              <button
                                type="button"
                                class="service-option"
                                classList={{ selected: serviceId() === service.id }}
                                aria-pressed={serviceId() === service.id}
                                onClick={() => setServiceId(service.id)}
                              >
                                <span class="radio-dot" />
                                <span class="service-copy">
                                  <span class="service-title-row">
                                    <strong>{service.name}</strong>
                                    <span class="service-price">{formatMoney(service.basePriceCents)}</span>
                                  </span>
                                  <span class="service-desc">{service.description}</span>
                                  <span class="service-meta">
                                    <Icon name="clock" size={13} /> {formatDuration(service.durationMin)}
                                  </span>
                                </span>
                              </button>
                            )}
                          </For>
                        </div>

                        <div class="wizard-heading addons-heading">
                          <h3>Make it yours <span class="optional">Optional</span></h3>
                          <p>Add-ons extend the appointment — the quote and duration update live.</p>
                        </div>
                        <div class="addon-list">
                          <For each={profile().addons}>
                            {(addon) => (
                              <button
                                type="button"
                                class="addon-option"
                                classList={{ selected: addonIds().includes(addon.id) }}
                                aria-pressed={addonIds().includes(addon.id)}
                                onClick={() => toggleAddon(addon.id)}
                              >
                                <span class="checkbox">
                                  <Show when={addonIds().includes(addon.id)}>
                                    <Icon name="check" size={12} strokeWidth={3} />
                                  </Show>
                                </span>
                                <span class="addon-copy">
                                  <span class="addon-title-row">
                                    <strong>{addon.name}</strong>
                                    <span class="addon-price">+{formatMoney(addon.priceCents)}</span>
                                  </span>
                                  <span class="addon-desc">{addon.description}</span>
                                </span>
                                <Show when={addon.durationMin > 0}>
                                  <span class="addon-time">+{formatDuration(addon.durationMin)}</span>
                                </Show>
                              </button>
                            )}
                          </For>
                        </div>
                      </div>
                      <div class="wizard-footer">
                        <span class="foot-note">
                          <Icon name="shield" size={15} /> No deposit. Pay after the detail.
                        </span>
                        <button type="button" class="btn btn-primary" disabled={!selectedService()} onClick={() => goStep(2)}>
                          Choose a time <Icon name="arrowRight" />
                        </button>
                      </div>
                    </Match>

                    <Match when={step() === 2}>
                      <div class="wizard-body">
                        <div class="wizard-heading">
                          <h3>Choose a time</h3>
                          <p>Slots are in real time — anything already booked is hidden.</p>
                        </div>

                        <div class="zone-row">
                          <label class="zone-field">
                            <span>Show times in</span>
                            <select
                              class="select"
                              value={timezone()}
                              onChange={(event) => setTimezone(event.currentTarget.value)}
                            >
                              <For each={zonesWithCurrent()}>
                                {(zone) => <option value={zone}>{zone.replaceAll('_', ' ')}</option>}
                              </For>
                            </select>
                          </label>
                          <p class="zone-note">
                            Studio time: <strong>{studioTz().replaceAll('_', ' ')}</strong> ({zoneLabel(studioTz())})
                            <Show when={timezone() !== studioTz()}>
                              <span class="zone-converted"> · converted for you</span>
                            </Show>
                          </p>
                        </div>

                        <div class="date-strip" role="list">
                          <For each={dates()}>
                            {(dateISO) => (
                              <button
                                type="button"
                                role="listitem"
                                class="date-chip"
                                classList={{ active: date() === dateISO }}
                                onClick={() => setDate(dateISO)}
                              >
                                <span class="dow">{relativeDay(dateISO, studioTz())}</span>
                                <span class="day">{dayNumber(dateISO, studioTz())}</span>
                                <span class="mon">{monthLabel(dateISO, studioTz())}</span>
                              </button>
                            )}
                          </For>
                        </div>

                        <Show
                          when={!availability.loading}
                          fallback={
                            <div class="slot-loading">
                              <Spinner size={22} />
                              <span>Checking availability…</span>
                            </div>
                          }
                        >
                          <Show
                            when={!availability.error}
                            fallback={
                              <div class="notice notice-error">
                                <Icon name="alert" size={16} />
                                <span>{availability.error instanceof Error ? availability.error.message : 'Availability could not load.'}</span>
                                <button type="button" class="text-btn" onClick={() => void refetchAvailability()}>
                                  Retry
                                </button>
                              </div>
                            }
                          >
                            <Show
                              when={slotGroups().length > 0}
                              fallback={
                                <div class="slot-empty">
                                  <Icon name="calendar" size={20} />
                                  <strong>No openings on {formatDateKey(date(), studioTz())}.</strong>
                                  <span>Try another day — new slots open as bookings are confirmed.</span>
                                </div>
                              }
                            >
                              <div class="slot-groups">
                                <For each={slotGroups()}>
                                  {(group) => (
                                    <div class="slot-group">
                                      <div class="slot-group-head">
                                        <strong>{group.label}</strong>
                                        <span>{group.hint}</span>
                                      </div>
                                      <div class="slot-grid">
                                        <For each={group.items}>
                                          {(item) => (
                                            <button
                                              type="button"
                                              class="slot-btn"
                                              classList={{ active: slot()?.startsAt === item.startsAt }}
                                              onClick={() => setSlot(item)}
                                            >
                                              <span class="slot-time">{formatTime(item.startsAt, timezone())}</span>
                                              <span class="slot-sub">
                                                {timezone() !== studioTz()
                                                  ? `${formatTime(item.startsAt, studioTz())} studio`
                                                  : formatDuration(quote()?.durationMin ?? profile().settings.slotMinutes)}
                                              </span>
                                            </button>
                                          )}
                                        </For>
                                      </div>
                                    </div>
                                  )}
                                </For>
                              </div>
                              <p class="slot-legend">
                                <span class="legend-dot" /> {formatTime(availability()!.slots[0].startsAt, timezone())} –{' '}
                                {formatTime(availability()!.slots[availability()!.slots.length - 1].startsAt, timezone())}{' '}
                                in {zoneLabel(timezone())} · {availability()!.slots.length} slots open
                              </p>
                            </Show>
                          </Show>
                        </Show>
                      </div>
                      <div class="wizard-footer">
                        <button type="button" class="btn btn-ghost" onClick={() => goStep(1)}>
                          <Icon name="arrowLeft" /> Back
                        </button>
                        <button type="button" class="btn btn-primary" disabled={!slot()} onClick={() => goStep(3)}>
                          Add details <Icon name="arrowRight" />
                        </button>
                      </div>
                    </Match>

                    <Match when={step() === 3}>
                      <form onSubmit={submit}>
                        <div class="wizard-body">
                          <div class="wizard-heading">
                            <h3>Where should we send the details?</h3>
                            <p>We'll email a receipt now and a confirmation once the studio approves the slot.</p>
                          </div>

                          <div class="appointment-mini">
                            <span class="appointment-icon">
                              <Icon name="calendar" size={18} />
                            </span>
                            <div>
                              <strong>{selectedService()?.name}</strong>
                              <span>
                                {slot() ? formatDateTime(slot()!.startsAt, timezone()) : ''} ·{' '}
                                {zoneLabel(timezone())}
                              </span>
                            </div>
                            <button
                              type="button"
                              class="text-btn"
                              onClick={() => goStep(2)}
                            >
                              Change
                            </button>
                          </div>

                          <div class="form-grid">
                            <label class="field">
                              <span class="field-label">Full name</span>
                              <input
                                class="input"
                                value={customerName()}
                                onInput={(event) => setCustomerName(event.currentTarget.value)}
                                placeholder="Jordan Blake"
                                autocomplete="name"
                                required
                              />
                            </label>
                            <label class="field">
                              <span class="field-label">Email</span>
                              <input
                                class="input"
                                type="email"
                                value={customerEmail()}
                                onInput={(event) => setCustomerEmail(event.currentTarget.value)}
                                placeholder="you@example.com"
                                autocomplete="email"
                                required
                              />
                            </label>
                            <label class="field">
                              <span class="field-label">Phone <span class="muted">(optional)</span></span>
                              <input
                                class="input"
                                type="tel"
                                value={customerPhone()}
                                onInput={(event) => setCustomerPhone(event.currentTarget.value)}
                                placeholder="(415) 555-0100"
                                autocomplete="tel"
                              />
                            </label>
                            <label class="field">
                              <span class="field-label">Vehicle &amp; notes <span class="muted">(optional)</span></span>
                              <input
                                class="input"
                                value={customerNotes()}
                                onInput={(event) => setCustomerNotes(event.currentTarget.value)}
                                placeholder="2021 Model Y — white interior"
                              />
                            </label>
                          </div>

                          <Show when={auth.user()}>
                            <p class="signed-in-note">
                              <Icon name="user" size={15} /> Signed in as {auth.user()!.email} — this booking will appear
                              in your account.
                            </p>
                          </Show>

                          <Show when={formError()}>
                            <div class="notice notice-error">
                              <Icon name="alert" size={16} />
                              <span>{formError()}</span>
                            </div>
                          </Show>

                          <p class="fine-print">
                            Requests are reviewed by the studio before they're confirmed. Need to reschedule? Reply to
                            your confirmation email at least 24 hours ahead.
                          </p>
                        </div>
                        <div class="wizard-footer">
                          <button type="button" class="btn btn-ghost" onClick={() => goStep(2)} disabled={submitting()}>
                            <Icon name="arrowLeft" /> Back
                          </button>
                          <button type="submit" class="btn btn-primary" disabled={submitting()}>
                            <Show when={submitting()} fallback={<>Request booking · {formatMoney(quote()?.totalCents ?? 0)}</>}>
                              <Spinner size={15} /> Requesting…
                            </Show>
                          </button>
                        </div>
                      </form>
                    </Match>

                    <Match when={step() === 4}>
                      <Show when={booking()}>
                        {(confirmed) => (
                          <div class="success-panel">
                            <span class="success-icon">
                              <Icon name="check" size={28} strokeWidth={2.4} />
                            </span>
                            <p class="eyebrow dark">Booking requested</p>
                            <h2>You're on the list.</h2>
                            <p class="success-sub">
                              A receipt is on its way to <strong>{confirmed().customerEmail}</strong>. The studio holds
                              this slot for 24 hours while it reviews the request.
                            </p>

                            <div class="ref-box">
                              <span>Reference</span>
                              <strong>{confirmed().reference}</strong>
                              <span class="badge badge-pending">Pending review</span>
                            </div>

                            <div class="success-details">
                              <div>
                                <span class="detail-label">Detail</span>
                                <strong>{confirmed().serviceName}</strong>
                                <Show when={confirmed().addons.length > 0}>
                                  <em>{confirmed().addons.map((addon) => addon.name).join(' · ')}</em>
                                </Show>
                              </div>
                              <div>
                                <span class="detail-label">When</span>
                                <strong>{formatLongDate(confirmed().startsAt, timezone())}</strong>
                                <em>
                                  {formatTime(confirmed().startsAt, timezone())} – {formatTime(confirmed().endsAt, timezone())}{' '}
                                  {zoneLabel(timezone())}
                                </em>
                                <Show when={timezone() !== studioTz()}>
                                  <em class="muted">
                                    Studio time: {formatDateTime(confirmed().startsAt, studioTz())}
                                  </em>
                                </Show>
                              </div>
                              <div>
                                <span class="detail-label">Total</span>
                                <strong>{formatMoney(confirmed().totalCents)}</strong>
                                <em>{formatDuration(confirmed().durationMin)} on site</em>
                              </div>
                            </div>

                            <div class="success-actions">
                              <button type="button" class="btn btn-primary" onClick={reset}>
                                Book another detail
                              </button>
                              <Show when={auth.user()?.role === 'client'}>
                                <A href="/account" class="btn btn-outline">
                                  My bookings
                                </A>
                              </Show>
                            </div>
                          </div>
                        )}
                      </Show>
                    </Match>
                  </Switch>
                </div>

                <Show when={step() < 4}>
                  <aside class="quote-rail" aria-label="Live quote">
                    <div class="rail-inner">
                      <div class="rail-head">
                        <span class="rail-eyebrow">Your quote</span>
                        <span class="rail-live">
                          <span class="pulse-dot" /> Live
                        </span>
                      </div>

                      <Show
                        when={quote()}
                        fallback={
                          <div class="rail-empty">
                            <Icon name="sparkles" size={20} />
                            <p>Pick a detail to start your estimate. Add-ons update the price as you toggle them.</p>
                          </div>
                        }
                      >
                        {(current) => (
                          <>
                            <div class="rail-service">
                              <h3>{selectedService()!.name}</h3>
                              <span>{formatDuration(selectedService()!.durationMin)}</span>
                            </div>

                            <div class="rail-line">
                              <span>Base rate</span>
                              <span>{formatMoney(current().basePriceCents)}</span>
                            </div>
                            <For each={selectedAddons()}>
                              {(addon) => (
                                <div class="rail-line rail-addon">
                                  <span>{addon.name}</span>
                                  <span>{formatMoney(addon.priceCents)}</span>
                                </div>
                              )}
                            </For>

                            <Show when={slot()}>
                              <div class="rail-divider" />
                              <div class="rail-appointment">
                                <span class="rail-label">Appointment</span>
                                <strong>
                                  {formatDate(slot()!.startsAt, timezone())} · {formatTime(slot()!.startsAt, timezone())}
                                </strong>
                                <em>{zoneLabel(timezone())}</em>
                              </div>
                            </Show>

                            <div class="rail-total">
                              <span>Total</span>
                              <strong>{formatMoney(current().totalCents)}</strong>
                            </div>
                            <div class="rail-time">
                              <Icon name="clock" size={15} />
                              {formatDuration(current().durationMin)} on site
                            </div>

                            <p class="rail-note">
                              <Icon name="shield" size={15} /> No deposit — pay after your detail.
                            </p>
                          </>
                        )}
                      </Show>
                    </div>

                    <div class="rail-fine">
                      All prices in USD. Add-ons extend the visit; the final walkaround confirms the total.
                    </div>
                  </aside>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </section>
    </>
  );
}
