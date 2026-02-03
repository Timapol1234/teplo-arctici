-- Migration: Add composite indexes for query optimization
-- Run this on your production database (Neon)

-- Composite index for donations: used in getRecentDonations, getStatistics
-- Covers WHERE status = 'completed' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_donations_status_created
  ON donations(status, created_at DESC);

-- Composite index for donations with campaign_id
-- Covers queries filtering by campaign and status
CREATE INDEX IF NOT EXISTS idx_donations_campaign_status_created
  ON donations(campaign_id, status, created_at DESC);

-- Composite index for campaigns: used in getActiveCampaigns
-- Covers WHERE is_active = true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_campaigns_active_created
  ON campaigns(is_active, created_at DESC);

-- Composite index for audit_logs: used in getAuditLogs with admin filter
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created
  ON audit_logs(admin_id, created_at DESC);

-- Composite index for reports: used in getReportsByCampaign
CREATE INDEX IF NOT EXISTS idx_reports_campaign_date
  ON reports(campaign_id, expense_date DESC);

-- Composite index for admins: used in getAllAdmins with active filter
CREATE INDEX IF NOT EXISTS idx_admins_active_created
  ON admins(is_active, created_at DESC);

-- Analyze tables to update statistics after adding indexes
ANALYZE donations;
ANALYZE campaigns;
ANALYZE audit_logs;
ANALYZE reports;
ANALYZE admins;
