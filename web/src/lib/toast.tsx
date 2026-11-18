import { createContext, createSignal, For, onCleanup, useContext } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Icon } from '../components/Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>();

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<ToastEntry[]>([]);
  let nextId = 1;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const push = (message: string, kind: ToastKind = 'success') => {
    const id = nextId++;
    setToasts((list) => [...list, { id, message, kind }]);
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((toast) => toast.id !== id));
      timers.delete(timer);
    }, 4200);
    timers.add(timer);
  };

  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer);
  });

  return (
    <ToastContext.Provider value={push}>
      {props.children}
      <Portal mount={document.body}>
        <div class="toast-stack" aria-live="polite">
          <For each={toasts()}>
            {(toast) => (
              <div class={`toast toast-${toast.kind}`}>
                <Icon name={toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'sparkles'} />
                <span>{toast.message}</span>
              </div>
            )}
          </For>
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
