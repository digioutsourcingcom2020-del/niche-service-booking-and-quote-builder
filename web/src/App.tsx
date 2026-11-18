import { Route, Router } from '@solidjs/router';
import Layout from './components/Layout';
import { AuthProvider } from './lib/auth';
import { SiteProvider } from './lib/site';
import { ToastProvider } from './lib/toast';
import { StudioProvider } from './lib/studio';
import BookingPage from './pages/BookingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import AdminLayout from './admin/AdminLayout';
import OverviewPage from './admin/OverviewPage';
import BookingsPage from './admin/BookingsPage';
import ServicesPage from './admin/ServicesPage';
import AddonsPage from './admin/AddonsPage';
import HoursPage from './admin/HoursPage';
import OutboxPage from './admin/OutboxPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SiteProvider>
          <Router root={Layout}>
            <Route path="/" component={BookingPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/account" component={AccountPage} />
            <Route path="/admin" component={AdminLayout}>
              <Route
                path="/"
                component={() => (
                  <StudioProvider>
                    <OverviewPage />
                  </StudioProvider>
                )}
              />
              <Route
                path="/bookings"
                component={() => (
                  <StudioProvider>
                    <BookingsPage />
                  </StudioProvider>
                )}
              />
              <Route
                path="/services"
                component={() => (
                  <StudioProvider>
                    <ServicesPage />
                  </StudioProvider>
                )}
              />
              <Route
                path="/addons"
                component={() => (
                  <StudioProvider>
                    <AddonsPage />
                  </StudioProvider>
                )}
              />
              <Route
                path="/hours"
                component={() => (
                  <StudioProvider>
                    <HoursPage />
                  </StudioProvider>
                )}
              />
              <Route
                path="/outbox"
                component={() => (
                  <StudioProvider>
                    <OutboxPage />
                  </StudioProvider>
                )}
              />
            </Route>
          </Router>
        </SiteProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
