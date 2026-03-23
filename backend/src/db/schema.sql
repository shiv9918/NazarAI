CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('citizen', 'municipal', 'department', 'admin');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('reported', 'in_progress', 'resolved');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  department TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  avatar TEXT,
  phone TEXT,
  location TEXT,
  bio TEXT,
  notify_issue_updates BOOLEAN NOT NULL DEFAULT TRUE,
  notify_new_rewards BOOLEAN NOT NULL DEFAULT TRUE,
  notify_city_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_theme TEXT,
  preferred_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notify_issue_updates BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notify_new_rewards BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notify_city_alerts BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_theme TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location TEXT NOT NULL,
  ward TEXT,
  department TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  status report_status NOT NULL DEFAULT 'reported',
  resolution_notes TEXT,
  proof_image_url TEXT,
  resolved_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  citizen_name TEXT NOT NULL,
  citizen_email TEXT NOT NULL,
  ai_description TEXT
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_phone TEXT NOT NULL,
  pending_body TEXT,
  pending_address TEXT,
  pending_lat DOUBLE PRECISION,
  pending_lng DOUBLE PRECISION,
  pending_media_url TEXT,
  flow_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (citizen_id, from_phone)
);

-- Backfill columns for existing databases created before proof image support.
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS resolved_by_officer TEXT;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS resolution_time_taken_hours INTEGER;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS citizen_rating TEXT;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS citizen_feedback TEXT;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS reopen_votes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS is_reopened BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE whatsapp_sessions
ADD COLUMN IF NOT EXISTS flow_state TEXT;

CREATE TABLE IF NOT EXISTS whatsapp_feedback_requests (
  report_id UUID PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  due_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weather_department_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  rainfall_48h_mm DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'OpenWeatherMap',
  target_departments TEXT[] NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS weather_department_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES weather_department_alerts(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  UNIQUE (alert_id, department)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_lower ON users ((LOWER(email)));
CREATE INDEX IF NOT EXISTS reports_reported_at_desc_idx ON reports (reported_at DESC);
CREATE INDEX IF NOT EXISTS reports_department_idx ON reports (department);
CREATE INDEX IF NOT EXISTS reports_citizen_id_idx ON reports (citizen_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
CREATE INDEX IF NOT EXISTS whatsapp_sessions_updated_at_idx ON whatsapp_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_feedback_due_at_idx ON whatsapp_feedback_requests (due_at ASC);
CREATE INDEX IF NOT EXISTS weather_department_alerts_created_at_idx ON weather_department_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS weather_department_alerts_expires_at_idx ON weather_department_alerts (expires_at DESC);
CREATE INDEX IF NOT EXISTS weather_department_notifications_department_idx ON weather_department_notifications (department, delivered_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;

CREATE TRIGGER reports_set_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS whatsapp_sessions_set_updated_at ON whatsapp_sessions;

CREATE TRIGGER whatsapp_sessions_set_updated_at
BEFORE UPDATE ON whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS whatsapp_feedback_requests_set_updated_at ON whatsapp_feedback_requests;

CREATE TRIGGER whatsapp_feedback_requests_set_updated_at
BEFORE UPDATE ON whatsapp_feedback_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
