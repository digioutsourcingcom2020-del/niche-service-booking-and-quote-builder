import { createEffect, createResource, createSignal, For, Show } from 'solid-js';
import type { ServiceDto } from '@shared/types';
import { formatDuration, formatMoney } from '@shared/pricing';
import { Icon } from '../components/Icon';
import { Modal, PageLoader, Spinner, Toggle, TypeConfirmDialog } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { centsToDollarInput, dollarsToCents } from '../lib/format';
import { useToast } from '../lib/toast';
import { PageHead } from './shared';

function ServiceDialog(props: {
  open: boolean;
  service: ServiceDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('0.00');
  const [duration, setDuration] = createSignal('60');
  const [active, setActive] = createSignal(true);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    if (!props.open) return;
    setName(props.service?.name ?? '');
    setDescription(props.service?.description ?? '');
    setPrice(centsToDollarInput(props.service?.basePriceCents ?? 0));
    setDuration(String(props.service?.durationMin ?? 60));
    setActive(props.service?.active ?? true);
    setError('');
  });

  const save = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    const payload = {
      name: name().trim(),
      description: description().trim(),
      basePriceCents: dollarsToCents(price()),
      durationMin: Number(duration()),
      active: active(),
    };
    if (payload.name.length < 2) {
      setError('Give the service a name.');
      return;
    }
    if (!Number.isFinite(payload.durationMin) || payload.durationMin < 15 || payload.durationMin > 480) {
      setError('Duration must be between 15 and 480 minutes.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (props.service) {
        await api.admin.updateService(props.service.id, payload);
        toast('Service updated — new quotes use the new rate.');
      } else {
        await api.admin.createService(payload);
        toast('Service added to the quote builder.');
      }
      props.onSaved();
      props.onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.service ? 'Edit service' : 'Add a service'}
      subtitle="Services are the base of every quote. Add-ons layer on top."
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn btn-ghost" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button type="submit" form="service-form" class="btn btn-primary" disabled={busy()}>
            {busy() ? <Spinner size={15} /> : null}
            {props.service ? 'Save changes' : 'Add service'}
          </button>
        </>
      }
    >
      <form id="service-form" onSubmit={save} class="form-grid">
        <label class="field field-full">
          <span class="field-label">Service name</span>
          <input
            class="input"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="Signature Wash & Wax"
            required
          />
        </label>
        <label class="field field-full">
          <span class="field-label">Description</span>
          <textarea
            class="textarea"
            rows={3}
            value={description()}
            onInput={(event) => setDescription(event.currentTarget.value)}
            placeholder="What's included?"
          />
        </label>
        <label class="field">
          <span class="field-label">Base rate (USD)</span>
          <div class="input-prefix">
            <span>$</span>
            <input
              class="input"
              type="number"
              min="0"
              step="0.01"
              value={price()}
              onInput={(event) => setPrice(event.currentTarget.value)}
              required
            />
          </div>
        </label>
        <label class="field">
          <span class="field-label">Duration (minutes)</span>
          <input
            class="input"
            type="number"
            min="15"
            max="480"
            step="15"
            value={duration()}
            onInput={(event) => setDuration(event.currentTarget.value)}
            required
          />
          <span class="field-hint">90 min displays as “1 hr 30 min”.</span>
        </label>
        <div class="field field-full inline-toggle">
          <div>
            <span class="field-label">Bookable on the public page</span>
            <span class="field-hint">Paused services stay hidden from new quotes until you reactivate them.</span>
          </div>
          <Toggle checked={active()} onChange={setActive} label="Active" />
        </div>
        <Show when={error()}>
          <div class="notice notice-error field-full">
            <Icon name="alert" size={16} />
            <span>{error()}</span>
          </div>
        </Show>
      </form>
    </Modal>
  );
}

export default function ServicesPage() {
  const toast = useToast();
  const [data, { refetch }] = createResource(api.admin.services);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<ServiceDto | null>(null);
  const [deleting, setDeleting] = createSignal<ServiceDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (service: ServiceDto) => {
    setEditing(service);
    setDialogOpen(true);
  };

  const remove = async () => {
    const service = deleting();
    if (!service) return;
    await api.admin.deleteService(service.id);
    toast(`Deleted “${service.name}”. Past bookings keep their details.`);
    await refetch();
  };

  return (
    <div class="admin-page">
      <PageHead
        title="Services"
        subtitle="Base details, rates, and durations. Changes apply to new quotes immediately."
      >
        <button type="button" class="btn btn-primary btn-sm" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add service
        </button>
      </PageHead>

      <Show when={!data.loading} fallback={<PageLoader label="Loading services…" />}>
        <div class="panel table-panel">
          <Show
            when={(data()?.services.length ?? 0) > 0}
            fallback={
              <div class="empty-state">
                <strong>No services yet</strong>
                <p>Add your first detail so clients can start building quotes.</p>
              </div>
            }
          >
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Duration</th>
                    <th>Base rate</th>
                    <th>Status</th>
                    <th class="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={data()?.services ?? []}>
                    {(service) => (
                      <tr classList={{ 'row-paused': !service.active }}>
                        <td>
                          <div class="cell-detail">
                            <strong>{service.name}</strong>
                            <small>{service.description || 'No description'}</small>
                          </div>
                        </td>
                        <td>{formatDuration(service.durationMin)}</td>
                        <td class="cell-total">{formatMoney(service.basePriceCents)}</td>
                        <td>
                          <span class={`badge ${service.active ? 'badge-active' : 'badge-paused'}`}>
                            {service.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td>
                          <div class="row-actions">
                            <button
                              type="button"
                              class="icon-btn"
                              title="Edit service"
                              onClick={() => openEdit(service)}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              class="icon-btn danger"
                              title="Delete service"
                              onClick={() => setDeleting(service)}
                            >
                              <Icon name="trash" size={16} />
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

      <ServiceDialog
        open={dialogOpen()}
        service={editing()}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void refetch()}
      />

      <TypeConfirmDialog
        open={deleting() !== null}
        title="Delete this service?"
        message={`“${deleting()?.name ?? ''}” will disappear from the quote builder. Existing bookings keep their saved name, price, and add-ons. This cannot be undone.`}
        entityName={deleting()?.name ?? ''}
        confirmLabel="Delete service"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
