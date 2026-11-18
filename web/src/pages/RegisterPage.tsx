import { A, useNavigate } from '@solidjs/router';
import { createEffect, createSignal, Show } from 'solid-js';
import { Icon } from '../components/Icon';
import { Brand, Spinner } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export default function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    if (auth.user()) navigate('/account', { replace: true });
  });

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    if (name().trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email().trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password().length < 8) {
      setError('Passwords need at least 8 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await auth.register(name().trim(), email().trim(), password());
      toast(`Welcome, ${user.name.split(' ')[0]}.`);
      navigate('/account', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="auth-page">
      <div class="auth-shell">
        <aside class="auth-aside">
          <Brand light />
          <div class="auth-aside-copy">
            <p class="eyebrow on-dark">Client accounts</p>
            <h2>Keep every appointment in one place.</h2>
            <ul class="auth-points">
              <li>
                <Icon name="calendar" size={17} /> Track pending and confirmed details at a glance.
              </li>
              <li>
                <Icon name="clock" size={17} /> Times shown in your zone and the studio's zone.
              </li>
              <li>
                <Icon name="mail" size={17} /> Receipts and reminders sent straight to your inbox.
              </li>
            </ul>
          </div>
          <p class="auth-aside-foot">No account needed to request a quote.</p>
        </aside>

        <div class="auth-card">
          <div class="auth-head">
            <p class="eyebrow dark">Create your account</p>
            <h1>Save your spot.</h1>
            <p>Client accounts are free — the studio manages provider access separately.</p>
          </div>

          <form onSubmit={submit} class="auth-form">
            <label class="field">
              <span class="field-label">Full name</span>
              <input
                class="input"
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
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
                value={email()}
                onInput={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </label>
            <label class="field">
              <span class="field-label">Password</span>
              <input
                class="input"
                type="password"
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                placeholder="At least 8 characters"
                autocomplete="new-password"
                required
              />
              <span class="field-hint">Use 8 or more characters. We'll never email you your password.</span>
            </label>

            <Show when={error()}>
              <div class="notice notice-error">
                <Icon name="alert" size={16} />
                <span>{error()}</span>
              </div>
            </Show>

            <button type="submit" class="btn btn-primary btn-block" disabled={busy()}>
              <Show when={busy()} fallback={<>Create account <Icon name="arrowRight" /></>}>
                <Spinner size={15} /> Creating…
              </Show>
            </button>
          </form>

          <p class="auth-switch">
            Already have an account? <A href="/login">Sign in</A>
          </p>
        </div>
      </div>
    </section>
  );
}
