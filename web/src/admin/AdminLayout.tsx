import { A, useLocation, useNavigate } from '@solidjs/router';
import type { RouteSectionProps } from '@solidjs/router';
import { createEffect, createSignal, For, Show } from 'solid-js';
import type { IconName } from '../components/Icon';
import { Icon } from '../components/Icon';
import { Brand, PageLoader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { useToast } from '../lib/toast';

const NAV: Array<{ href: string; label: string; icon: IconName; end?: boolean }> = [
  { href: '/admin', label: 'Overview', icon: 'grid', end: true },
  { href: '/admin/bookings', label: 'Bookings', icon: 'list' },
  { href: '/admin/services', label: 'Services', icon: 'tag' },
  { href: '/admin/addons', label: 'Add-ons', icon: 'layers' },
  { href: '/admin/hours', label: 'Hours & settings', icon: 'sliders' },
  { href: '/admin/outbox', label: 'Outbox', icon: 'inbox' },
];

function sectionName(pathname: string): string {
  const match = NAV.find((item) => item.href !== '/admin' && pathname.startsWith(item.href));
  return match?.label ?? 'Overview';
}

export default function AdminLayout(props: RouteSectionProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = createSignal(false);

  createEffect(() => {
    if (!auth.ready()) return;
    const user = auth.user();
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      return;
    }
    if (user.role !== 'provider') navigate('/account', { replace: true });
  });

  const signOut = async () => {
    await auth.logout();
    toast('Signed out of the studio.');
    navigate('/');
  };

  return (
    <Show
      when={auth.user()?.role === 'provider' ? auth.user() : null}
      fallback={
        <div class="boot-screen">
          <PageLoader label="Opening the studio…" />
        </div>
      }
    >
      {(user) => (
        <div class="admin-shell" classList={{ 'sidebar-open': menuOpen() }}>
          <button
            type="button"
            class="sidebar-scrim"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside class="admin-sidebar">
            <A href="/admin" class="admin-brand" onClick={() => setMenuOpen(false)}>
              <Brand light />
            </A>
            <nav class="admin-nav">
              <For each={NAV}>
                {(item) => (
                  <A
                    href={item.href}
                    end={item.end}
                    activeClass="active"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                  </A>
                )}
              </For>
            </nav>
            <div class="admin-side-foot">
              <div class="admin-user">
                <span class="avatar">{initials(user().name)}</span>
                <div>
                  <strong>{user().name}</strong>
                  <small>{user().email}</small>
                </div>
              </div>
              <button type="button" class="icon-btn on-dark" title="Sign out" onClick={() => void signOut()}>
                <Icon name="logout" size={17} />
              </button>
            </div>
          </aside>

          <div class="admin-main">
            <header class="admin-topbar">
              <button type="button" class="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
                <Icon name="menu" />
              </button>
              <div class="topbar-crumb">
                <span>Studio</span>
                <Icon name="chevronDown" size={13} class="crumb-sep" />
                <strong>{sectionName(location.pathname)}</strong>
              </div>
              <div class="topbar-actions">
                <a class="btn btn-outline btn-sm" href="/" target="_blank" rel="noreferrer">
                  <Icon name="external" size={15} /> View booking site
                </a>
              </div>
            </header>
            <div class="admin-content">{props.children}</div>
          </div>
        </div>
      )}
    </Show>
  );
}
