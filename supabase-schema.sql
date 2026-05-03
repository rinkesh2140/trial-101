-- ════════════════════════════════════════════════════════
-- Patel Infrastructure — Supabase Database Schema
-- Run this ONCE in Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL
);

-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  company_id UUID
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id                   TEXT PRIMARY KEY,
  name                 TEXT,
  role                 TEXT,
  designation          TEXT,
  department           TEXT,
  mobile               TEXT,
  email                TEXT,
  username             TEXT,
  avatar               TEXT,
  "joinDate"           TEXT,
  active               BOOLEAN DEFAULT TRUE,
  status               TEXT DEFAULT 'active',
  "bloodGroup"         TEXT,
  "birthDate"          TEXT,
  address              TEXT,
  pincode              TEXT,
  vehicle              TEXT,
  "priorExpYears"      NUMERIC DEFAULT 0,
  "resignedDate"       TEXT,
  "hrRoleEditApproved" BOOLEAN DEFAULT FALSE,
  company_id           UUID,
  site_id              UUID
);

-- Users (custom auth — not Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT,
  email       TEXT,
  employee_id TEXT,
  company_id  UUID
);

-- Attendance (multi-punch, id = employeeId_date for upsert)
CREATE TABLE IF NOT EXISTS attendance (
  id           TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  date         TEXT NOT NULL,
  punches      JSONB DEFAULT '[]',
  "inTime"     TEXT,
  "outTime"    TEXT,
  company_id   UUID,
  site_id      UUID
);

-- Availability (id = employeeId_date for upsert)
CREATE TABLE IF NOT EXISTS availability (
  id           TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  date         TEXT NOT NULL,
  status       TEXT,
  company_id   UUID,
  site_id      UUID
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  description   TEXT,
  priority      TEXT DEFAULT 'medium',
  status        TEXT DEFAULT 'open',
  "assignedTo"  TEXT,
  "createdBy"   TEXT,
  "createdAt"   TEXT,
  "dueDate"     TEXT,
  "completedAt" TEXT,
  company_id    UUID,
  site_id       UUID
);

-- Notes / Performance Records
CREATE TABLE IF NOT EXISTS notes (
  id                TEXT PRIMARY KEY,
  "aboutEmployeeId" TEXT,
  "byEmployeeId"    TEXT,
  text              TEXT,
  category          TEXT,
  "createdAt"       TEXT,
  company_id        UUID,
  site_id           UUID
);

-- Messages (DMs & group chat)
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  "from"      TEXT,
  "to"        TEXT,
  "groupId"   TEXT,
  text        TEXT,
  "timestamp" TEXT,
  read        BOOLEAN DEFAULT FALSE,
  company_id  UUID,
  site_id     UUID
);

-- Contacts (emergency, vendors, clients)
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  category    TEXT,
  phone       TEXT,
  description TEXT,
  "addedBy"   TEXT,
  "addedAt"   TEXT,
  company_id  UUID,
  site_id     UUID
);

-- Chat Groups
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  members     JSONB DEFAULT '[]',
  "createdBy" TEXT,
  "createdAt" TEXT,
  company_id  UUID,
  site_id     UUID
);

-- Labour Management System — Workers
CREATE TABLE IF NOT EXISTS lms_workers (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  skill         TEXT,
  mobile        TEXT,
  "isCompanion" BOOLEAN DEFAULT FALSE,
  "enrolledDate" TEXT,
  "qrCode"      TEXT,
  company_id    UUID,
  site_id       UUID
);

-- Labour Management System — Attendance
CREATE TABLE IF NOT EXISTS lms_attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "workerId" TEXT,
  date       TEXT,
  "inTime"   TEXT,
  "outTime"  TEXT,
  company_id UUID,
  site_id    UUID
);

-- My Pad (personal notes, to-dos, calls)
CREATE TABLE IF NOT EXISTS pad (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"    TEXT,
  type        TEXT,
  content     TEXT,
  category    TEXT,
  "timestamp" TEXT,
  company_id  UUID
);

-- Punch Requests (mispunch corrections & extra hours)
CREATE TABLE IF NOT EXISTS punch_requests (
  id             TEXT PRIMARY KEY,
  "employeeId"   TEXT,
  type           TEXT,
  date           TEXT,
  "inTime"       TEXT,
  "outTime"      TEXT,
  reason         TEXT,
  status         TEXT DEFAULT 'pending',
  "decidedBy"    TEXT,
  "decisionNote" TEXT,
  "submittedAt"  TEXT,
  "decidedAt"    TEXT,
  company_id     UUID,
  site_id        UUID
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  body        TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT,
  company_id  UUID
);

-- Employee ↔ Site assignments (many-to-many)
CREATE TABLE IF NOT EXISTS employee_sites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT,
  site_id     UUID,
  UNIQUE(employee_id, site_id)
);

-- App configuration / seed tracking
CREATE TABLE IF NOT EXISTS meta (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT UNIQUE,
  seeded     BOOLEAN DEFAULT FALSE,
  company_id UUID
);

-- ════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Allow all (development mode)
-- ════════════════════════════════════════════════════════

ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_workers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pad              ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON companies      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sites           FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON employees       FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users           FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON attendance      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON availability    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON tasks            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON notes            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON messages         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON contacts         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON groups           FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON lms_workers      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON lms_attendance   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON pad              FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON punch_requests   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON announcements    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON employee_sites   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON meta             FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
