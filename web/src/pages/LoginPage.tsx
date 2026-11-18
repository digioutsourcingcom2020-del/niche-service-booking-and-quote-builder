import { A, useLocation, useNavigate } from '@solidjs/router';
import { createEffect, createSignal, Show } from 'solid-js';
import { Icon } from '../components/Icon';
import { Brand, Spinner } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const nextPath = () => {
    const raw = new URLSearchParams(location.search).get('next');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
  };

  const destination = (role: 'provider' | 'client') => nextPath() ?? (role === 'provider' ? '/admin' : '/account');

  createEffect(() => {
    const user = auth.user();
    if (user) navigate(destination(user.role), { replace: true });
  });

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError('');
    try {
      const user = await auth.login(email().trim(), password());
      toast(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate(destination(user.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const useDemo = (kind: 'provider' | 'client') => {
    setEmail(kind === 'provider' ? 'provider@gleamworks.studio' : 'client@example.com');
    setPassword('demo1234');
    setError('');
  };

  return (
    <section class="auth-page">
      <div class="auth-shell">
        <aside class="auth-aside">
          <Brand light />
          <div class="auth-aside-copy">
            <p class="eyebrow on-dark">The studio side</p>
            <h2>Everything between "request" and "spotless."</h2>
            <ul class="auth-points">
              <li>
                <Icon name="calendar" size={17} /> Approve requests in a click — the slot is already locked.
              </li>
              <li>
                <Icon name="sliders" size={17} /> Your hours, rates, and add-on pricing stay in your hands.
              </li>
              <li>
                <Icon name="inbox" size={17} /> Every notification lands in one auditable outbox.
              </li>
            </ul>
          </div>
          <p class="auth-aside-foot">Gleamworks · mobile detailing operations</p>
        </aside>

        <div class="auth-card">
          <div class="auth-head">
            <p class="eyebrow dark">Studio &amp; client accounts</p>
            <h1>Welcome back.</h1>
            <p>Sign in to manage the studio or track your bookings.</p>
          </div>

          <form onSubmit={submit} class="auth-form">
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
                autocomplete="current-password"
                required
              />
            </label>

            <Show when={error()}>
              <div class="notice notice-error">
                <Icon name="alert" size={16} />
                <span>{error()}</span>
              </div>
            </Show>

            <button type="submit" class="btn btn-primary btn-block" disabled={busy()}>
              <Show when={busy()} fallback={<>Sign in <Icon name="arrowRight" /></>}>
                <Spinner size={15} /> Signing in…
              </Show>
            </button>
          </form>

          <div class="demo-creds">
            <div class="demo-head">
              <span>Demo accounts</span>
              <small>Seeded on first boot</small>
            </div>
            <button type="button" class="demo-row" onClick={() => useDemo('provider')}>
              <span>
                <strong>Studio provider</strong>
                <small>provider@gleamworks.studio</small>
              </span>
              <span class="demo-use">Fill</span>
            </button>
            <button type="button" class="demo-row" onClick={() => useDemo('client')}>
              <span>
                <strong>Client</strong>
                <small>client@example.com</small>
              </span>
              <span class="demo-use">Fill</span>
            </button>
            <p class="demo-password">Password for both: <code>demo1234</code></p>
          </div>

          <p class="auth-switch">
            New here? <A href="/register">Create a client account</A> · Or <A href="/#book">book without an account</A>
          </p>
        </div>
      </div>
    </section>
  );
}
