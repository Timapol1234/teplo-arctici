# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web platform for the "Teplo Arctici" (Arctic Warmth) charity foundation with maximum transparency for donors. Key feature: real-time display of all charitable transactions via live feed.

## Commands

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start

# Initialize database (creates schema + default admin)
npm run db:init

# Setup production environment
npm run setup:prod

# Run tests
npm test
npm run test:coverage
```

**Requirements**: Node.js 18+, PostgreSQL 14+

**Admin credentials** (default): `admin@teplo-arctici.ru` / `admin123`

## Architecture

### Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript + Tailwind CSS (via CDN)
- **Auth**: JWT tokens (jsonwebtoken + bcrypt)

### Key Architectural Decisions

**Database Layer** (`backend/config/database.js`): Uses `pg` (node-postgres) with connection pooling. Supports SSL for production databases (Neon, Supabase, Railway).

**PostgreSQL Triggers** (`database/schema.sql`): Campaign totals (`current_amount`) are automatically updated via triggers when donations are inserted or their status changes.

**Verification System**: Optional SHA-256 hashing system in separate module (`backend/routes/verification.js`, `backend/controllers/verification.js`). Controlled by `settings.verification_enabled` in database.

### Route Structure
- `/api/*` - Public endpoints (donations, campaigns, reports)
- `/api/admin/*` - Protected endpoints (require JWT auth)
- `/api/verification/*` - Optional verification endpoints
- `/health` - Health check endpoint (returns status, timestamp, uptime)

### Rate Limiting
- Public API: 100 requests per 15 minutes
- Admin API: 100 requests per 15 minutes
- Login: 5 attempts per 15 minutes

## Database

**Connection**: Via `DATABASE_URL` environment variable

**Example URLs**:
- Local: `postgresql://postgres:postgres@localhost:5432/teplo_arctici`
- Neon: `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
- Supabase: `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres`

**Core Tables**:
- `campaigns` - Fundraising campaigns with goal/current amounts
- `donations` - All donations linked to campaigns
- `reports` - Expense reports for campaigns
- `admins` - Admin users (bcrypt-hashed passwords)
- `settings` - Key-value system settings
- `daily_hashes` - Optional verification hashes

## Design Assets

Ready-made HTML mockups in `desing/` folder (note: intentional misspelling in folder name):
- `home_page_-_тепло_арктики.html`
- `admin_dashboard_-_transactions.html`
- `админ__создание_сбора.html`
- `expense_reports_-_тепло_арктики.html`

**Color scheme**: Primary #137fec, Background Light #f6f7f8, Dark #101922

## Implementation Notes

1. **No stubs** - All features must be fully functional with real data
2. **Verification modularity** - Verification system in separate files for easy enable/disable
3. **Simple UI** - No technical jargon on public pages
4. **Live feed** - Polling-based, should not create heavy server load
