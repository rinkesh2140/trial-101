-- ════════════════════════════════════════════════════════
-- PRODUCTION MIGRATION — 2026-05-03
-- ════════════════════════════════════════════════════════

-- 1. Indexing for Performance
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks("assignedTo");
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages("groupId");

-- 2. Restrictive RLS Policies (Production Mode)
-- Note: Requires app to pass company_id in metadata or use JWT claims.
-- For now, we'll keep allow_all but prepare the specific ones.

-- DROP POLICY IF EXISTS "allow_all" ON employees;
-- CREATE POLICY "company_isolation" ON employees 
--   FOR ALL TO authenticated 
--   USING (company_id = auth.jwt() ->> 'company_id'::uuid);

-- 3. Data Integrity Fixes
ALTER TABLE employees ALTER COLUMN "joinDate" TYPE DATE USING "joinDate"::DATE;
ALTER TABLE attendance ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE availability ALTER COLUMN date TYPE DATE USING date::DATE;
ALTER TABLE lms_attendance ALTER COLUMN date TYPE DATE USING date::DATE;
