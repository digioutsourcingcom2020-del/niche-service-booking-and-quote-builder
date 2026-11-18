import { A, useLocation } from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import { Show } from 'solid-js';
import { Brand } from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';

function HeaderActions() {
  const auth = useAuth();

  return (
    <div class="header-actions">
      <Show
        when={auth.user()}
        fallback={
          <>
            <A href="/login" class="nav-link">
              Sign in
            </A>
            <a href="/#book" class="btn btn-primary btn-sm">
              Book now
            </a>
          </>
        }
      >
        {(user) => (
          <>
            <A href={user().role === 'provider' ? '/admin' : '/account'} class="nav-link nav-account">
              <Icon name="user" size={16} />
              {user().role === 'provider' ? 'Studio dashboard' : 'My bookings'}
            </A>
            <a href="/#book" class="btn btn-primary btn-sm">
              Book now
            </a>
          </>
        )}
      </Show>
    </div>
  );
}

function SiteFooter() {
  const profile = useSite();
  const settings = () => profile()?.settings;

  return (
    <footer class="site-footer" id="contact">
      <div class="shell footer-inner">
        <div class="footer-brand">
          <Brand light />
          <p>{settings()?.tagline ?? 'Showroom shine, delivered to your driveway.'}</p>
        </div>
        <div class="footer-cols">
          <div>
            <span class="footer-label">Studio</span>
            <p>{settings()?.address ?? 'Mobile studio · Greater San Francisco'}</p>
            <p>{settings()?.phone ?? ''}</p>
          </div>
          <div>
            <span class="footer-label">Book</span>
            <A href="/#book">Build a quote</A>
            <A href="/account">My bookings</A>
            <A href="/login">Provider sign in</A>
          </div>
        </div>
      </div>
      <div class="shell footer-base">
        <span>© {new Date().getFullYear()} {settings()?.businessName ?? 'Gleamworks'}.</span>
        <span>Built with SolidJS · Hono · SQLite</span>
      </div>
    </footer>
  );
}

export default function Layout(props: RouteSectionProps) {
  const location = useLocation();
  const profile = useSite();

  return (
    <Show
      when={!location.pathname.startsWith('/admin')}
      fallback={<>{props.children}</>}
    >
      <div class="site-shell">
        <header class="site-header">
          <div class="shell header-inner">
            <a href="/" class="brand-link" aria-label="Gleamworks home">
              <Brand />
            </a>
            <nav class="site-nav">
              <Show when={profile()}>
                <a href="/#book">Book a detail</a>
                <a href="/#how">How it works</a>
              </Show>
            </nav>
            <HeaderActions />
          </div>
        </header>
        <main>{props.children}</main>
        <SiteFooter />
      </div>
    </Show>
  );
}
