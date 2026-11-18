import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { BookingStatus } from '@shared/types';
import { statusLabel } from '../lib/format';
import { Icon } from './Icon';

export function Brand(props: { light?: boolean }) {
  return (
    <span class="brand" classList={{ 'brand-light': props.light }}>
      <span class="brand-mark">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c2.8 3.2 5.5 5.8 5.5 9.2a5.5 5.5 0 0 1-11 0C6.5 8.8 9.2 6.2 12 3Z" fill="currentColor" />
        </svg>
      </span>
      <span class="brand-text">
        <strong>Gleamworks</strong>
        <small>mobile detailing</small>
      </span>
    </span>
  );
}

export function StatusBadge(props: { status: BookingStatus }) {
  return <span class={`badge badge-${props.status}`}>{statusLabel(props.status)}</span>;
}

export function Spinner(props: { size?: number }) {
  return <span class="spinner" style={{ width: `${props.size ?? 18}px`, height: `${props.size ?? 18}px` }} />;
}

export function PageLoader(props: { label?: string }) {
  return (
    <div class="page-loader">
      <Spinner size={26} />
      <span>{props.label ?? 'Loading…'}</span>
    </div>
  );
}

export function EmptyState(props: { icon?: 'calendar' | 'inbox' | 'car'; title: string; message: string }) {
  return (
    <div class="empty-state">
      <span class="empty-icon">
        <Icon name={props.icon ?? 'calendar'} size={22} />
      </span>
      <strong>{props.title}</strong>
      <p>{props.message}</p>
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      class="toggle"
      data-on={props.checked}
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="toggle-knob" />
    </button>
  );
}

export function Modal(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: JSX.Element;
  footer?: JSX.Element;
}) {
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && props.open) props.onClose();
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  createEffect(() => {
    document.body.style.overflow = props.open ? 'hidden' : '';
  });
  onCleanup(() => {
    document.body.style.overflow = '';
  });

  return (
    <Portal mount={document.body}>
      <Show when={props.open}>
        <div
          class="dialog-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) props.onClose();
          }}
        >
          <div class="dialog" classList={{ 'dialog-wide': props.wide }} role="dialog" aria-modal="true" aria-label={props.title}>
            <div class="dialog-head">
              <div>
                <h2>{props.title}</h2>
                <Show when={props.subtitle}>
                  <p>{props.subtitle}</p>
                </Show>
              </div>
              <button type="button" class="icon-btn" onClick={props.onClose} aria-label="Close dialog">
                <Icon name="x" />
              </button>
            </div>
            <div class="dialog-body">{props.children}</div>
            <Show when={props.footer}>
              <div class="dialog-foot">{props.footer}</div>
            </Show>
          </div>
        </div>
      </Show>
    </Portal>
  );
}

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    if (props.open) {
      setError('');
      setBusy(false);
    }
  });

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await props.onConfirm();
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn btn-ghost" onClick={props.onClose} disabled={busy()}>
            Keep it
          </button>
          <button
            type="button"
            class="btn"
            classList={{ 'btn-danger': props.tone === 'danger', 'btn-primary': props.tone !== 'danger' }}
            onClick={() => void run()}
            disabled={busy()}
          >
            {busy() ? <Spinner size={15} /> : null}
            {props.confirmLabel}
          </button>
        </>
      }
    >
      <p class="dialog-message">{props.message}</p>
      <Show when={error()}>
        <div class="notice notice-error">
          <Icon name="alert" size={16} />
          <span>{error()}</span>
        </div>
      </Show>
    </Modal>
  );
}

export function TypeConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  entityName: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [text, setText] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const matches = () => text().trim() === props.entityName;

  createEffect(() => {
    if (props.open) {
      setText('');
      setError('');
      setBusy(false);
    }
  });

  const run = async () => {
    if (!matches()) return;
    setBusy(true);
    setError('');
    try {
      await props.onConfirm();
      props.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn btn-ghost" onClick={props.onClose} disabled={busy()}>
            Cancel
          </button>
          <button type="button" class="btn btn-danger" onClick={() => void run()} disabled={!matches() || busy()}>
            {busy() ? <Spinner size={15} /> : null}
            {props.confirmLabel}
          </button>
        </>
      }
    >
      <p class="dialog-message">{props.message}</p>
      <label class="field">
        <span class="field-label">
          Type <strong>{props.entityName}</strong> to confirm
        </span>
        <input
          class="input"
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          placeholder={props.entityName}
          autocomplete="off"
        />
      </label>
      <Show when={error()}>
        <div class="notice notice-error">
          <Icon name="alert" size={16} />
          <span>{error()}</span>
        </div>
      </Show>
    </Modal>
  );
}
