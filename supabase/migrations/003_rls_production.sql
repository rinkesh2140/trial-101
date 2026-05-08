-- ════════════════════════════════════════════════════════════════════════
-- Migration 003 — Production RLS (company-level isolation)
-- IMPORTANT: Only apply when the app passes a valid JWT with company_id claim.
-- Currently NOT active — app uses custom auth (not Supabase Auth JWT).
-- These are provided as a reference template.
-- ════════════════════════════════════════════════════════════════════════

-- Drop open dev policies first, then apply restrictive ones:
/*
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN (
        'employees','users','attendance','availability','tasks','notes',
        'messages','contacts','groups','lms_workers','lms_attendance',
        'pad','punch_requests','announcements','employee_sites','sites','meta'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON %I', r.tablename);
    EXECUTE format(
      'CREATE POLICY company_isolation ON %I
         FOR ALL TO authenticated
         USING (company_id = (auth.jwt()->>''company_id'')::uuid)
         WITH CHECK (company_id = (auth.jwt()->>''company_id'')::uuid)',
      r.tablename
    );
  END LOOP;
END $$;
*/

-- NOTE: Once Supabase Edge Function auth-login is active and JWT claims include
-- company_id, uncomment the block above to enforce row-level company isolation.
