-- ════════════════════════════════════════════════════════════════════════
-- Patel Infrastructure — Bootstrap Accounts
-- Run this ONCE in Supabase SQL Editor to create the two starter accounts.
-- ════════════════════════════════════════════════════════════════════════

-- Step 1: Create the company
INSERT INTO companies (id, name)
VALUES (gen_random_uuid(), 'Patel Infrastructure Pvt. Ltd.')
ON CONFLICT DO NOTHING;

-- Step 2: Create a default site (linked to the company created above)
-- Run after Step 1; replace <COMPANY_UUID> with the actual UUID from the companies table.
-- INSERT INTO sites (name, company_id) VALUES ('Default Site', '<COMPANY_UUID>');

-- ════════════════════════════════════════════════════════════════
-- SUPERADMIN — no company (has visibility across all companies)
-- Login: superadmin / Super@Admin123
-- ════════════════════════════════════════════════════════════════
INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate")
VALUES ('SU001', 'Superadmin', 'SU', 'Super Administrator', 'SA', true, 'active', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (username, password, role, employee_id)
VALUES ('superadmin', 'Super@Admin123', 'SU', 'SU001')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- ════════════════════════════════════════════════════════════════
-- ADMIN — Project Manager for the company
-- Login: admin / Admin@123
-- Replace <COMPANY_UUID> with the UUID from the companies table.
-- ════════════════════════════════════════════════════════════════
-- INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate", company_id)
-- VALUES ('ADM001', 'Admin', 'PM', 'Project Manager', 'AD', true, 'active', CURRENT_DATE, '<COMPANY_UUID>');

-- INSERT INTO users (username, password, role, employee_id, company_id)
-- VALUES ('admin', 'Admin@123', 'PM', 'ADM001', '<COMPANY_UUID>')
-- ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- ════════════════════════════════════════════════════════════════
-- QUICK SETUP (all-in-one, uses a CTE to generate the UUID once)
-- ════════════════════════════════════════════════════════════════
DO $$
DECLARE
  comp_id UUID;
BEGIN
  -- Get or create company
  SELECT id INTO comp_id FROM companies LIMIT 1;
  IF comp_id IS NULL THEN
    INSERT INTO companies (name) VALUES ('Patel Infrastructure Pvt. Ltd.') RETURNING id INTO comp_id;
    INSERT INTO sites (name, company_id) VALUES ('Default Site', comp_id);
  END IF;

  -- Superadmin employee (no company_id — cross-company visibility)
  INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate")
  VALUES ('SU001', 'Superadmin', 'SU', 'Super Administrator', 'SA', true, 'active', CURRENT_DATE)
  ON CONFLICT (id) DO NOTHING;

  -- Superadmin user
  INSERT INTO users (username, password, role, employee_id)
  VALUES ('superadmin', 'Super@Admin123', 'SU', 'SU001')
  ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

  -- Admin employee (PM role, tied to company)
  INSERT INTO employees (id, name, role, designation, avatar, active, status, "joinDate", company_id)
  VALUES ('ADM001', 'Admin', 'PM', 'Project Manager', 'AD', true, 'active', CURRENT_DATE, comp_id)
  ON CONFLICT (id) DO NOTHING;

  -- Admin user
  INSERT INTO users (username, password, role, employee_id, company_id)
  VALUES ('admin', 'Admin@123', 'PM', 'ADM001', comp_id)
  ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

  RAISE NOTICE 'Bootstrap complete. Company ID: %', comp_id;
END $$;
