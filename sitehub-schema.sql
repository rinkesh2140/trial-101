-- ════════════════════════════════════════════════════════
-- SiteHub Pro — Schema Additions
-- Run ONCE in Supabase SQL Editor (after base supabase-schema.sql)
-- Safe to re-run — all statements are idempotent
-- ════════════════════════════════════════════════════════

-- Superadmin flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Geofence on sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS lat           DECIMAL(10,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS lng           DECIMAL(11,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS radius_meters INT DEFAULT 200;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS city          TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS active        BOOLEAN DEFAULT TRUE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();

-- Custom roles per company (replaces hard-coded role names)
CREATE TABLE IF NOT EXISTS roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  level       INT DEFAULT 5,
  color       TEXT DEFAULT '#64748B',
  permissions JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roles' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Link employees to custom roles
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id UUID;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT,
  company_id  UUID,
  type        TEXT,
  title       TEXT,
  body        TEXT,
  data        JSONB DEFAULT '{}',
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'allow_all') THEN
    CREATE POLICY "allow_all" ON notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Geolocation on attendance check-ins
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat              DECIMAL(10,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng              DECIMAL(11,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_outside_geofence BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat             DECIMAL(10,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng             DECIMAL(11,8);

-- Task enhancements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress   INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments   JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags       JSONB DEFAULT '[]';

-- Seed superadmin (runs only if none exists)
INSERT INTO users (username, password, role, is_superadmin)
SELECT 'superadmin', 'super@admin123', 'superadmin', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_superadmin = true);

-- ════════════════════════════════════════════════════════
-- DEFAULT PERMISSIONS REFERENCE
-- Store this JSONB in roles.permissions:
-- {
--   "attendance":    { "view": true,  "edit": false },
--   "tasks":         { "view": true,  "create": false, "assign": false },
--   "reports":       { "view": false },
--   "announcements": { "view": true,  "create": false },
--   "employees":     { "view": true,  "edit": false },
--   "notebook":      { "view": true,  "create": true  },
--   "sites":         { "view": false, "edit": false    }
-- }
-- ════════════════════════════════════════════════════════
