CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('provider', 'client')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 15 AND 120),
  lead_minutes integer NOT NULL DEFAULT 120 CHECK (lead_minutes BETWEEN 0 AND 10080),
  horizon_days integer NOT NULL DEFAULT 14 CHECK (horizon_days BETWEEN 1 AND 60)
);

CREATE TABLE IF NOT EXISTS working_hours (
  weekday integer PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT false,
  start_min integer NOT NULL DEFAULT 540 CHECK (start_min BETWEEN 0 AND 1439),
  end_min integer NOT NULL DEFAULT 1020 CHECK (end_min BETWEEN 1 AND 1440),
  CHECK (end_min > start_min)
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
  duration_min integer NOT NULL CHECK (duration_min BETWEEN 15 AND 480),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  duration_min integer NOT NULL CHECK (duration_min BETWEEN 0 AND 240),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_min integer NOT NULL,
  base_price_cents integer NOT NULL,
  addons_price_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  client_timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
      WHERE (status <> 'cancelled');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_starts_at_idx ON bookings (starts_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_email_idx ON bookings (lower(customer_email));

CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('logged', 'sent', 'failed')),
  provider text NOT NULL DEFAULT 'outbox',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS emails_created_at_idx ON emails (created_at DESC);
