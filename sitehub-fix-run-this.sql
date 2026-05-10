-- ════════════════════════════════════════════════════════
-- SiteHub Pro — RUN THIS ONCE in Supabase SQL Editor
-- Safe to re-run (all idempotent)
-- ════════════════════════════════════════════════════════

-- 1. Users table: add is_superadmin column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- 2. Set superadmin credentials (CRITICAL — fixes login routing)
UPDATE users SET role = 'superadmin', is_superadmin = true  WHERE username = 'ptlprth29@gmail.com';
UPDATE users SET role = 'company_admin'                     WHERE username = 'admin';

-- 3. Sites: geofencing columns
ALTER TABLE sites ADD COLUMN IF NOT EXISTS lat           DECIMAL(10,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS lng           DECIMAL(11,8);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS radius_meters INT DEFAULT 200;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS city          TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS active        BOOLEAN DEFAULT TRUE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();

-- 4. Attendance: geo + fix column (renames "employeeId" to employee_id for reliability)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat              DECIMAL(10,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng              DECIMAL(11,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_outside_geofence BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat             DECIMAL(10,8);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng             DECIMAL(11,8);

-- 5. Tasks: progress tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress   INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments   JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- 6. Employees: role link
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id UUID;

-- 7. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL,
  name        TEXT NOT NULL,
  level       INT DEFAULT 5,
  color       TEXT DEFAULT '#64748B',
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='allow_all') THEN
    CREATE POLICY "allow_all" ON roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Notifications table
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='allow_all') THEN
    CREATE POLICY "allow_all" ON notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. FORCE schema cache reload (fixes ALL "column not found" 400 errors)
NOTIFY pgrst, 'reload schema';
