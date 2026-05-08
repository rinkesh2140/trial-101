-- ════════════════════════════════════════════════════════════════════════
-- Patel Infrastructure — Bootstrap Accounts
-- Paste this into Supabase SQL Editor and click RUN
-- Safe to re-run at any time
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  comp_id UUID;
BEGIN

  -- ── Step 1: Get or create company ──────────────────────────────────
  SELECT id INTO comp_id FROM companies LIMIT 1;
  IF comp_id IS NULL THEN
    INSERT INTO companies (name)
    VALUES ('Patel Infrastructure Pvt. Ltd.')
    RETURNING id INTO comp_id;

    INSERT INTO sites (name, company_id)
    VALUES ('Default Site', comp_id);
  END IF;
  RAISE NOTICE 'Company ID: %', comp_id;

  -- ── Step 2: Superadmin employee (no company — cross-tenant) ────────
  DELETE FROM employees WHERE id = 'SU001';
  INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate")
  VALUES ('SU001', 'Superadmin', 'SU', 'Super Administrator', 'SA', true, 'active', CURRENT_DATE);

  -- ── Step 3: Superadmin user ─────────────────────────────────────────
  DELETE FROM users WHERE username = 'superadmin';
  INSERT INTO users (username, password, role, employee_id)
  VALUES ('superadmin', 'Super@Admin123', 'SU', 'SU001');

  -- ── Step 4: Admin employee (PM role, tied to company) ───────────────
  DELETE FROM employees WHERE id = 'ADM001';
  INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate", company_id)
  VALUES ('ADM001', 'Admin', 'PM', 'Project Manager', 'AD', true, 'active', CURRENT_DATE, comp_id);

  -- ── Step 5: Admin user ──────────────────────────────────────────────
  DELETE FROM users WHERE username = 'admin';
  INSERT INTO users (username, password, role, employee_id, company_id)
  VALUES ('admin', 'Admin@123', 'PM', 'ADM001', comp_id);

  RAISE NOTICE 'Done. Login: superadmin / Super@Admin123  |  admin / Admin@123';
END $$;
