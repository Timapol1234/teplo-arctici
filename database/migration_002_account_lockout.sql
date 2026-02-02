-- Migration: Add account lockout fields
-- Run this on your production database (Neon)

-- Add fields for tracking failed login attempts
ALTER TABLE admins ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP DEFAULT NULL;

-- Reset any existing values
UPDATE admins SET failed_login_attempts = 0, locked_until = NULL;

-- Index for checking locked accounts
CREATE INDEX IF NOT EXISTS idx_admins_locked_until ON admins(locked_until);
