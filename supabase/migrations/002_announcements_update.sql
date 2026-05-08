-- ════════════════════════════════════════════════════════════════════════
-- Migration 002 — Announcements: add type, priority, site_id columns
-- Safe to re-run (IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS type     TEXT DEFAULT 'company';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS site_id  UUID;
