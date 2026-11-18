# Gleamworks — Niche Service Booking & Quote Builder

A full-stack booking product for a mobile detailing studio. Clients build a live quote, pick a genuinely available slot in their own time zone, and request the booking. The studio approves requests, completes jobs, and every lifecycle step sends an email.

**Stack:** SolidJS 1.9 + @solidjs/router · Hono 4 on Node · SQLite (built into Node 24) · Zod · Luxon

---

## Quick start

```bash
npm install
cp .env.example .env      # already present in this repo
npm run dev               # API on :8787 + Vite on :5173
```

Open http://localhost:5173.

No database server or Docker required: the app uses the SQLite engine bundled with Node 24 and keeps its file at `.data/gleamworks.db` (gitignored). The schema is applied automatically on boot, and seed data is inserted only when the `settings` table is empty.

### Demo accounts

| Role     | Email                        | Password   |
| -------- | ---------------------------- | ---------- |
| Provider | `provider@gleamworks.studio` | `demo1234` |
| Client   | `client@example.com`         | `demo1234` |

Sign in at `/login` (there are one-click "Fill" buttons for both accounts).

### Production-style run

```bash
npm run build             # bundle to dist/web
npm start                 # Hono serves the SPA + API on :8787
```

`npm run db:reset` drops every table; the next boot recreates the schema and re-seeds the demo studio.

---

## What's implemented

### Public quote builder (`/`)

- Four-step wizard: service → date/time → details → confirmation.
- Live quote rail: base rate, selected add-ons, total price, and on-site duration update immediately.
- Availability is computed server-side from the studio's working hours, slot interval, minimum notice, booking horizon, and existing bookings.
- Dates are offered only on open weekdays; slots are grouped into Morning / Afternoon / Evening.
- A time-zone selector renders every slot in the client's zone (defaults to the browser zone) while showing the studio zone and converted times. Bookings are stored in UTC.
- Optimistic race handling: if a slot is taken between viewing and submitting, the API returns `409`, the wizard clears the selection and refetches availability.
- Success screen shows the reference, appointment in both zones, duration, total, and pending status.

### Provider dashboard (`/admin`)

- **Overview:** monthly revenue, pending requests, upcoming appointments, completion rate, today's schedule, pending queue with one-click confirm, and the next six appointments.
- **Bookings:** status tabs with live counts, search by customer/email/reference/service, expandable detail sheet, confirm → complete → cancel workflow with confirmation dialogs.
- **Services:** create/edit/delete base services with price, duration, description, active toggle. Delete uses type-to-confirm and preserves booking snapshots.
- **Add-ons:** same CRUD model with extra time and pricing.
- **Hours & settings:** business profile, time zone, slot interval, minimum notice, booking horizon, and per-day working hours with open/closed toggles.
- **Outbox:** every generated email with recipient, subject, type, status, and an isolated HTML preview.

### Client account (`/account`)

- Upcoming and past bookings, statuses, add-ons, totals.
- Times shown in the client's zone with a secondary studio-time line when the zones differ.
- Sign out and a direct path back to the quote builder.

### Auth & roles

- Email + password with `scrypt` hashing (`salt:hash`).
- Opaque session tokens stored as SHA-256 hashes; the raw token lives in an `httpOnly`, `SameSite=Lax` cookie for 30 days.
- Roles: `provider` and `client`. `/admin` routes and `/api/admin/*` reject clients (UI redirect + `403`), and anonymous users are sent to `/login?next=…`.
- Clients can register at `/register`; provider accounts are provisioned by seeding (or directly in the DB).

### Status workflow & email notifications

```
pending ──► confirmed ──► completed
   │             │
   └─────────────┴──► cancelled
```

Every transition writes an email:

| Event     | Email kind           | Subject pattern                |
| --------- | -------------------- | ------------------------------ |
| Created   | `booking_received`   | `Request received — GW-XXXXXX` |
| Confirmed | `booking_confirmed`  | `Confirmed: GW-XXXXXX`         |
| Completed | `booking_completed`  | `Thanks for choosing GW-XXXXXX`|
| Cancelled | `booking_cancelled`  | `Cancelled: GW-XXXXXX`         |

By default emails are captured in the `emails` table and shown in the admin Outbox — perfect for local demos and tests. Set `RESEND_API_KEY` and `MAIL_FROM` to deliver through Resend instead; delivery status becomes `sent` or `failed`.

---

## How double-bookings are prevented

Two layers protect every booking:

1. **Serialized writes.** `withTransaction` opens the transaction with `BEGIN IMMEDIATE`, which takes SQLite's write lock up front. No other connection — including a second app process or the CLI — can write between the availability check and the insert.
2. **In-transaction overlap re-check.** Inside that lock, the service duration is resolved and existing `pending`/`confirmed` bookings are checked for overlap. Conflicting requests get `409` before anything is inserted.

Cancelling releases the slot immediately because overlap checks ignore `cancelled` rows, and the next read recomputes availability from the database.

### Verify it yourself

```bash
npm run race-test
# Concurrent booking statuses: 201, 409
# Race test passed: no double booking under concurrent requests.
```

The script fires two identical booking requests at the same instant, asserts exactly one `201` and one `409`, then removes its test row.

---

## Time zone model

- The studio's zone (`settings.timezone`, e.g. `America/Los_Angeles`) defines working hours and day boundaries.
- Availability is generated in that zone with Luxon, then serialized to UTC ISO strings.
- The client may display slots in any IANA zone. The browser's zone is detected with `Intl.DateTimeFormat`.
- Bookings store `starts_at`/`ends_at` as UTC ISO-8601 text (fixed millisecond format, so text comparison and sorting stay exact) plus the client's `client_timezone` for reference.
- The UI labels converted times as "converted for you" and always shows the studio zone alongside.

---

## Scripts

| Command           | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | API (watch) + Vite dev server                 |
| `npm run dev:api` | Hono API only                                 |
| `npm run dev:web` | Vite only                                     |
| `npm run build`   | Production SPA build to `dist/web`            |
| `npm start`       | Serve API + built SPA (`dist/web`)            |
| `npm run typecheck` | `tsc --noEmit`                              |
| `npm test`        | Pricing + availability unit tests (8 tests)  |
| `npm run race-test` | Concurrent double-booking proof             |
| `npm run db:reset` | Drop all tables and reseed on next boot      |

---

## Project structure

```
server/
  src/
    index.ts          Hono app, static SPA serving, error mapping
    schema.sql        Tables, indexes, checks
    db.ts             node:sqlite driver, async query wrapper, transactions
    init.ts           Apply schema → seed if empty
    seed.ts           Studio, hours, services, add-ons, demo bookings
    auth.ts           scrypt hashing, sessions, requireUser/requireProvider
    bookings.ts       Quote resolution, availability, transactional create, transitions
    availability.ts   Pure slot generator (unit-tested)
    time.ts           Luxon helpers
    emails.ts         HTML templates, outbox, Resend delivery
    routes/           auth, public, me, admin
  tests/              pricing + availability tests
  scripts/            race-test, reset-db
shared/               DTOs + pricing shared by server and web
web/
  src/
    pages/            Booking wizard, login, register, account
    admin/            Dashboard, bookings, services, add-ons, settings, outbox
    components/       Layout, dialogs, icon set, UI primitives
    lib/              API client, auth/site/studio/toast contexts, formatting
    styles.css        Design system (cream/ink/lime, serif display type)
```

### API surface

```
GET    /api/public/profile
GET    /api/public/availability?date&serviceId&addons
POST   /api/public/bookings
POST   /api/auth/register | /login | /logout
GET    /api/auth/me
GET    /api/me/bookings
GET    /api/admin/overview | /bookings | /emails | /settings
POST   /api/admin/bookings/:id/status
GET/POST/PUT/DELETE  /api/admin/services[/:id]
GET/POST/PUT/DELETE  /api/admin/addons[/:id]
PUT    /api/admin/settings
```

All write endpoints parse input with Zod. Persistence uses parameterized SQL through `node:sqlite`.

---

## Environment variables

| Variable         | Default                                                    | Notes                                  |
| ---------------- | ---------------------------------------------------------- | -------------------------------------- |
| `SQLITE_PATH`    | `.data/gleamworks.db`                                      | SQLite file; the folder is created on boot |
| `PORT`           | `8787`                                                     | API port                               |
| `APP_URL`        | `http://localhost:5173`                                    | Used in email links                    |
| `MAIL_FROM`      | `Gleamworks Studio <bookings@gleamworks.test>`             | Sender identity                        |
| `RESEND_API_KEY` | empty                                                      | When set, sends via Resend API         |

If Vite starts on another port (e.g. 5174 because 5173 is busy), update `APP_URL` so links in emails point at the right origin.

---

## Testing notes

- `npm test` covers slot generation (working hours, slot step, overlap removal, lead time, horizon, time zone boundaries) and quote math.
- `npm run race-test` requires the API and database to be running.
- The demo seed includes five bookings with varied statuses and matching outbox emails, so the dashboard is populated immediately.
