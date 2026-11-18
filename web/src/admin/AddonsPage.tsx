import { createEffect, createResource, createSignal, For, Show } from 'solid-js';
import type { AddonDto } from '@shared/types';
import { formatDuration, formatMoney } from '@shared/pricing';
import { Icon } from '../components/Icon';
import { Modal, PageLoader, Spinner, Toggle, TypeConfirmDialog } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { centsToDollarInput, dollarsToCents } from '../lib/format';
import { useToast } from '../lib/toast';
import { PageHead } from './shared';

function AddonDialog(props: {
  open: boolean;
  addon: AddonDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [price, setPrice] = createSignal('0.00');
  const [duration, setDuration] = createSignal('15');
  const [active, setActive] = createSignal(true);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    if (!props.open) return;
    setName(props.addon?.name ?? '');
    setDescription(props.addon?.description ?? '');
    setPrice(centsToDollarInput(props.addon?.priceCents ?? 0));
    setDuration(String(props.addon?.durationMin ?? 15));
    setActive(props.addon?.active ?? true);
    setError('');
  });

  const save = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    const payload = {
      name: name().trim(),
      description: description().trim(),
      priceCents: dollarsToCents(price()),
      durationMin: Number(duration()),
      active: active(),
    };
    if (payload.name.length < 2) {
      setError('Give the add-on a name.');
      return;
    }
    if (!Number.isFinite(payload.durationMin) || payload.durationMin < 0 || payload.durationMin > 240) {
      setError('Extra time must be between 0 and 240 minutes.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (props.addon) {
        await api.admin.updateAddon(props.addon.id, payload);
        toast('Add-on updated — quotes recalculate on the next booking.');
      } else {
        await api.admin.createAddon(payload);
        toast('Add-on published to the quote builder.');
      }
      props.onSaved();
      props.onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the add-on.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.addon ? 'Edit add-on' : 'Add an add-on'}
      subtitle="Extras add both price and time to the appointment."
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn btn-ghost" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button type="submit" form="addon-form" class="btn btn-primary" disabled={busy()}>
            {busy() ? <Spinner size={15} /> : null}
            {props.addon ? 'Save changes' : 'Add add-on'}
          </button>
        </>
      }
    >
      <form id="addon-form" onSubmit={save} class="form-grid">
        <label class="field field-full">
          <span class="field-label">Add-on name</span>
          <input
            class="input"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="Ceramic Spray Sealant"
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
            placeholder="What does this extra include?"
          />
        </label>
        <label class="field">
          <span class="field-label">Price (USD)</span>
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
          <span class="field-label">Extra time (minutes)</span>
          <input
            class="input"
            type="number"
            min="0"
            max="240"
            step="5"
            value={duration()}
            onInput={(event) => setDuration(event.currentTarget.value)}
            required
          />
          <span class="field-hint">Use 0 for extras that don't extend the visit.</span>
        </label>
        <div class="field field-full inline-toggle">
          <div>
            <span class="field-label">Available to clients</span>
            <span class="field-hint">Paused add-ons are hidden but keep their history.</span>
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

export default function AddonsPage() {
  const toast = useToast();
  const [data, { refetch }] = createResource(api.admin.addons);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<AddonDto | null>(null);
  const [deleting, setDeleting] = createSignal<AddonDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (addon: AddonDto) => {
    setEditing(addon);
    setDialogOpen(true);
  };

  const remove = async () => {
    const addon = deleting();
    if (!addon) return;
    await api.admin.deleteAddon(addon.id);
    toast(`Deleted “${addon.name}”. Past bookings keep their details.`);
    await refetch();
  };

  return (
    <div class="admin-page">
      <PageHead
        title="Add-ons"
        subtitle="Optional extras that layer price and time onto every quote."
      >
        <button type="button" class="btn btn-primary btn-sm" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add add-on
        </button>
      </PageHead>

      <Show when={!data.loading} fallback={<PageLoader label="Loading add-ons…" />}>
        <div class="panel table-panel">
          <Show
            when={(data()?.addons.length ?? 0) > 0}
            fallback={
              <div class="empty-state">
                <strong>No add-ons yet</strong>
                <p>Extras like sealants or pet hair removal turn a wash into a full detail.</p>
              </div>
            }
          >
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Extra time</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th class="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={data()?.addons ?? []}>
                    {(addon) => (
                      <tr classList={{ 'row-paused': !addon.active }}>
                        <td>
                          <div class="cell-detail">
                            <strong>{addon.name}</strong>
                            <small>{addon.description || 'No description'}</small>
                          </div>
                        </td>
                        <td>{addon.durationMin === 0 ? 'No extra time' : formatDuration(addon.durationMin)}</td>
                        <td class="cell-total">+{formatMoney(addon.priceCents)}</td>
                        <td>
                          <span class={`badge ${addon.active ? 'badge-active' : 'badge-paused'}`}>
                            {addon.active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td>
                          <div class="row-actions">
                            <button
                              type="button"
                              class="icon-btn"
                              title="Edit add-on"
                              onClick={() => openEdit(addon)}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              class="icon-btn danger"
                              title="Delete add-on"
                              onClick={() => setDeleting(addon)}
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

      <AddonDialog
        open={dialogOpen()}
        addon={editing()}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void refetch()}
      />

      <TypeConfirmDialog
        open={deleting() !== null}
        title="Delete this add-on?"
        message={`“${deleting()?.name ?? ''}” will disappear from the quote builder. Existing bookings keep their saved price and timing. This cannot be undone.`}
        entityName={deleting()?.name ?? ''}
        confirmLabel="Delete add-on"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
