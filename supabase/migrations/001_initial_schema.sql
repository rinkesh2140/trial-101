-- ════════════════════════════════════════════════════════════════════════
-- Migration 001 — Initial Schema
-- Patel Infrastructure — Site Management Suite
-- Run once in Supabase SQL Editor (or via `supabase db push`)
-- ════════════════════════════════════════════════════════════════════════

-- Companies (multi-tenant root)
CREATE TABLE IF NOT EXISTS companies (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL
);

-- Sites (belong to a company)
CREATE TABLE IF NOT EXISTS sites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  company_id UUID REFERENCES companies(id)
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id                   TEXT PRIMARY KEY,
  name                 TEXT,
  role                 TEXT,               -- SU/PM/SM/HR/SE/EN/SV/JE/AS/TK
  designation          TEXT,
  department           TEXT,
  mobile               TEXT,
  email                TEXT,
  username             TEXT,
  avatar               TEXT,
  "joinDate"           DATE,
  active               BOOLEAN DEFAULT TRUE,
  status               TEXT DEFAULT 'active',   -- active | resigned
  "bloodGroup"         TEXT,
  "birthDate"          DATE,
  address              TEXT,
  pincode              TEXT,
  vehicle              TEXT,
  "priorExpYears"      NUMERIC DEFAULT 0,
  "resignedDate"       DATE,
  "hrRoleEditApproved" BOOLEAN DEFAULT FALSE,
  company_id           UUID REFERENCES companies(id),
  site_id              UUID REFERENCES sites(id)
);

-- Users — custom auth (NOT Supabase Auth)
-- NOTE: passwords stored as plain text (development only). See functions/auth-login for production hashing.
CREATE TABLE IF NOT EXISTS users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT,
  email       TEXT,
  employee_id TEXT REFERENCES employees(id),
  company_id  UUID REFERENCES companies(id)
);

-- Attendance (multi-punch, id = employeeId_date for deterministic upsert)
CREATE TABLE IF NOT EXISTS attendance (
  id           TEXT PRIMARY KEY,        -- format: {employeeId}_{date}
  "employeeId" TEXT NOT NULL,
  date         DATE NOT NULL,
  punches      JSONB DEFAULT '[]',      -- [{inTime, outTime}, ...]
  "inTime"     TEXT,                    -- legacy field (kept for compatibility)
  "outTime"    TEXT,                    -- legacy field (kept for compatibility)
  company_id   UUID,
  site_id      UUID
);

-- Availability (id = employeeId_date for deterministic upsert)
CREATE TABLE IF NOT EXISTS availability (
  id           TEXT PRIMARY KEY,        -- format: {employeeId}_{date}
  "employeeId" TEXT NOT NULL,
  date         DATE NOT NULL,
  status       TEXT,                    -- On Site | WFH | Leave | Field | Off | Half Day
  company_id   UUID,
  site_id      UUID
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  description   TEXT,
  priority      TEXT DEFAULT 'medium',  -- low | medium | high | urgent
  status        TEXT DEFAULT 'open',    -- open | in-progress | done | cancelled
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

-- Messages (DMs and group chat)
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  "from"      TEXT,
  "to"        TEXT,    -- employeeId for DM, null for group
  "groupId"   TEXT,    -- group id for group messages
  text        TEXT,
  "timestamp" TEXT,
  read        BOOLEAN DEFAULT FALSE,
  company_id  UUID,
  site_id     UUID
);

-- External Contacts (emergency, vendors, clients, etc.)
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  category    TEXT,   -- emergency | agency | vendor | client | office | other
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
  members     JSONB DEFAULT '[]',   -- array of employeeId strings
  "createdBy" TEXT,
  "createdAt" TEXT,
  company_id  UUID,
  site_id     UUID
);

-- Labour Management System — Workers
CREATE TABLE IF NOT EXISTS lms_workers (
  id             TEXT PRIMARY KEY,
  name           TEXT,
  skill          TEXT,
  mobile         TEXT,
  "isCompanion"  BOOLEAN DEFAULT FALSE,
  "enrolledDate" TEXT,
  "qrCode"       TEXT,
  company_id     UUID,
  site_id        UUID
);

-- Labour Management System — Attendance
CREATE TABLE IF NOT EXISTS lms_attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "workerId" TEXT,
  date       DATE,
  "inTime"   TEXT,
  "outTime"  TEXT,
  company_id UUID,
  site_id    UUID
);

-- My Pad (personal notes, to-dos, call log)
CREATE TABLE IF NOT EXISTS pad (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"    TEXT,
  type        TEXT,       -- note | todo | call
  content     TEXT,
  category    TEXT,
  "timestamp" TEXT,
  company_id  UUID
);

-- Punch Requests (mispunch corrections and extra-hours requests)
CREATE TABLE IF NOT EXISTS punch_requests (
  id             TEXT PRIMARY KEY,
  "employeeId"   TEXT,
  type           TEXT,       -- mispunch | extra-hours
  date           TEXT,
  "inTime"       TEXT,
  "outTime"      TEXT,
  reason         TEXT,
  status         TEXT DEFAULT 'pending',   -- pending | approved | rejected
  "decidedBy"    TEXT,
  "decisionNote" TEXT,
  "submittedAt"  TEXT,
  "decidedAt"    TEXT,
  company_id     UUID,
  site_id        UUID
);

-- Announcements (company-wide or site-specific)
CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  body        TEXT,
  type        TEXT DEFAULT 'company',   -- company | site
  priority    TEXT DEFAULT 'normal',   -- normal | important | urgent
  "createdBy" TEXT,
  "createdAt" TEXT,
  company_id  UUID,
  site_id     UUID    -- only used when type = 'site'
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

-- ════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employees_company   ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_emp      ON attendance("employeeId");
CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_availability_emp    ON availability("employeeId");
CREATE INDEX IF NOT EXISTS idx_tasks_assigned      ON tasks("assignedTo");
CREATE INDEX IF NOT EXISTS idx_messages_group      ON messages("groupId");
CREATE INDEX IF NOT EXISTS idx_announcements_co    ON announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_punch_req_emp       ON punch_requests("employeeId");

-- ════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Open policies (development)
-- See 003_rls_production.sql to tighten for production
-- ════════════════════════════════════════════════════════════════════════
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
