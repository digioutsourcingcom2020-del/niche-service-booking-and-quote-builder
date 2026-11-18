import { createEffect, createSignal, For, Show } from 'solid-js';
import type { SettingsDto, WorkingHourDto } from '@shared/types';
import { Icon } from '../components/Icon';
import { PageLoader, Spinner, Toggle } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { TIMEZONES, labelToMinutes, minutesToLabel, zoneLabel } from '../lib/format';
import { useStudio } from '../lib/studio';
import { useToast } from '../lib/toast';
import { PageHead } from './shared';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HoursPage() {
  const studio = useStudio();
  const toast = useToast();
  const [form, setForm] = createSignal<SettingsDto | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    const settings = studio.settings();
    if (settings) setForm(structuredClone(settings));
  });

  const patch = (changes: Partial<SettingsDto>) => {
    setForm((current) => (current ? { ...current, ...changes } : current));
  };

  const patchHour = (weekday: number, changes: Partial<WorkingHourDto>) => {
    setForm((current) =>
      current
        ? {
            ...current,
            hours: current.hours.map((hour) => (hour.weekday === weekday ? { ...hour, ...changes } : hour)),
          }
        : current,
    );
  };

  const save = async () => {
    const current = form();
    if (!current || saving()) return;
    for (const hour of current.hours) {
      if (hour.endMin <= hour.startMin) {
        setError(`Fix ${DAY_NAMES[hour.weekday]}: the end time must be after the start time.`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const saved = await api.admin.saveSettings(current);
      setForm(structuredClone(saved));
      studio.refetch();
      toast('Studio settings saved — the public booking page uses these rules on its next load.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="admin-page">
      <PageHead
        title="Hours & settings"
        subtitle="Availability, rates, and the rules behind every public quote."
      >
        <Show when={form()}>
          <button type="button" class="btn btn-primary btn-sm" disabled={saving()} onClick={() => void save()}>
            {saving() ? <Spinner size={15} /> : <Icon name="check" size={15} />}
            {saving() ? 'Saving…' : 'Save changes'}
          </button>
        </Show>
      </PageHead>

      <Show when={form()} fallback={<PageLoader label="Loading studio settings…" />}>
        {(settings) => (
          <div class="settings-layout">
            <div class="settings-grid">
              <section class="panel">
                <div class="panel-head">
                  <div>
                    <h2>Studio profile</h2>
                    <p>Shown on booking emails and the public page.</p>
                  </div>
                </div>
                <div class="panel-body form-grid">
                  <label class="field field-full">
                    <span class="field-label">Business name</span>
                    <input
                      class="input"
                      value={settings().businessName}
                      onInput={(event) => patch({ businessName: event.currentTarget.value })}
                    />
                  </label>
                  <label class="field field-full">
                    <span class="field-label">Tagline</span>
                    <input
                      class="input"
                      value={settings().tagline}
                      onInput={(event) => patch({ tagline: event.currentTarget.value })}
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">Phone</span>
                    <input
                      class="input"
                      value={settings().phone}
                      onInput={(event) => patch({ phone: event.currentTarget.value })}
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">Service area</span>
                    <input
                      class="input"
                      value={settings().address}
                      onInput={(event) => patch({ address: event.currentTarget.value })}
                    />
                  </label>
                </div>
              </section>

              <section class="panel">
                <div class="panel-head">
                  <div>
                    <h2>Booking rules</h2>
                    <p>How the public quote builder behaves.</p>
                  </div>
                </div>
                <div class="panel-body form-grid">
                  <label class="field">
                    <span class="field-label">Studio time zone</span>
                    <select
                      class="select"
                      value={settings().timezone}
                      onChange={(event) => patch({ timezone: event.currentTarget.value })}
                    >
                      <For each={TIMEZONES}>
                        {(zone) => <option value={zone}>{zone.replaceAll('_', ' ')}</option>}
                      </For>
                    </select>
                    <span class="field-hint">Currently {zoneLabel(settings().timezone)}</span>
                  </label>
                  <label class="field">
                    <span class="field-label">Slot interval</span>
                    <select
                      class="select"
                      value={String(settings().slotMinutes)}
                      onChange={(event) => patch({ slotMinutes: Number(event.currentTarget.value) })}
                    >
                      <For each={[15, 30, 45, 60, 90]}>
                        {(minutes) => <option value={String(minutes)}>Every {minutes} minutes</option>}
                      </For>
                    </select>
                    <span class="field-hint">Start times offered inside working hours.</span>
                  </label>
                  <label class="field">
                    <span class="field-label">Minimum notice (minutes)</span>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      step="30"
                      value={settings().leadMinutes}
                      onInput={(event) => patch({ leadMinutes: Number(event.currentTarget.value) })}
                    />
                    <span class="field-hint">120 = clients can't book a slot starting within 2 hours.</span>
                  </label>
                  <label class="field">
                    <span class="field-label">Booking horizon (days)</span>
                    <input
                      class="input"
                      type="number"
                      min="1"
                      max="60"
                      value={settings().horizonDays}
                      onInput={(event) => patch({ horizonDays: Number(event.currentTarget.value) })}
                    />
                    <span class="field-hint">How far ahead the calendar opens.</span>
                  </label>
                </div>
              </section>
            </div>

            <section class="panel">
              <div class="panel-head">
                <div>
                  <h2>Working hours</h2>
                  <p>Slots are generated inside these windows — closed days are hidden from the public page.</p>
                </div>
              </div>
              <div class="panel-body flush">
                <div class="day-list">
                  <For each={DAY_ORDER}>
                    {(weekday) => {
                      const hour = () => settings().hours.find((item) => item.weekday === weekday)!;
                      return (
                        <div class="day-row" classList={{ closed: !hour().isOpen }}>
                          <Toggle
                            checked={hour().isOpen}
                            onChange={(checked) => patchHour(weekday, { isOpen: checked })}
                            label={`Open on ${DAY_NAMES[weekday]}`}
                          />
                          <span class="day-name">{DAY_NAMES[weekday]}</span>
                          <div class="day-times">
                            <input
                              class="input time-input"
                              type="time"
                              value={minutesToLabel(hour().startMin)}
                              disabled={!hour().isOpen}
                              onChange={(event) =>
                                patchHour(weekday, { startMin: labelToMinutes(event.currentTarget.value) })
                              }
                            />
                            <span class="day-dash">to</span>
                            <input
                              class="input time-input"
                              type="time"
                              value={minutesToLabel(hour().endMin)}
                              disabled={!hour().isOpen}
                              onChange={(event) =>
                                patchHour(weekday, { endMin: labelToMinutes(event.currentTarget.value) })
                              }
                            />
                          </div>
                          <span class="day-state">
                            {hour().isOpen ? `${minutesToLabel(hour().startMin)} – ${minutesToLabel(hour().endMin)}` : 'Closed'}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </section>

            <Show when={error()}>
              <div class="notice notice-error">
                <Icon name="alert" size={16} />
                <span>{error()}</span>
              </div>
            </Show>

            <div class="settings-foot">
              <p class="muted small">
                Saving updates the public availability instantly. Existing bookings are never moved automatically.
              </p>
              <button type="button" class="btn btn-primary" disabled={saving()} onClick={() => void save()}>
                {saving() ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                {saving() ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
