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

# Run a single test file
npx jest backend/__tests__/unit/controllers/donations.test.js

# Debug test output (shows console.log/error)
DEBUG_TESTS=1 npx jest <test-file>
```

**Requirements**: Node.js 18+, PostgreSQL 14+

**Environment**: Copy `.env.example` to `.env`. Key variables: `DATABASE_URL`, `JWT_SECRET` (32+ chars required in production), `CLOUDINARY_*` (for image uploads).

**Admin credentials** (default): `admin@teplo-arctici.ru` / `admin123`

## Architecture

### Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript + Tailwind CSS (via CDN)
- **Auth**: JWT tokens (jsonwebtoken + bcrypt)

### Key Architectural Decisions

**Database Layer** (`backend/config/database.js`): Uses `pg` (node-postgres) with connection pooling. Supports SSL for production databases (Neon, Supabase, Railway).

**PostgreSQL Triggers** (`database/schema.sql`): Campaign totals (`current_amount`) are automatically updated via triggers when donations are inserted or their status changes. Migrations in `database/migration_*.sql` extend the schema (audit logs, account lockout, composite indexes).

**Verification System**: Optional SHA-256 hashing system in separate module (`backend/routes/verification.js`, `backend/controllers/verification.js`). Controlled by `settings.verification_enabled` in database.

**Image Uploads**: Cloudinary integration (`backend/config/cloudinary.js`) via multer middleware. Used for campaign images and report receipts.

**Caching**: Server-side caching via `node-cache` (`backend/utils/cache.js`). Stats available at `/api/admin/cache-stats`.

### Route Structure & Middleware Pipeline
- `/api/*` - Public endpoints (donations, campaigns, reports) - rate limited
- `/api/admin/*` - Protected endpoints: rate limited → CSRF protection (`backend/middleware/csrfProtection.js`) → JWT auth (`backend/middleware/auth.js`). Login is exempt from CSRF/JWT.
- `/api/admin/users/*` - Super-admin only routes via `requireSuperAdmin` middleware (`backend/middleware/checkRole.js`)
- `/api/verification/*` - Optional verification endpoints
- `/health` - Health check endpoint (returns status, timestamp, uptime)

### Rate Limiting
- Public API: 100 requests per 15 minutes
- Admin API: 100 requests per 15 minutes
- Login: 5 attempts per 15 minutes

### Testing
Tests use Jest with mocked database (no real DB needed). Test files in `backend/__tests__/` follow `unit/` and `integration/` structure. Shared mocks and test helpers in `backend/__tests__/setup/mocks.js` (provides `createMockDb`, `createMockRequest`, `createMockResponse`, `testData`). Coverage threshold: 50% across branches/functions/lines/statements.

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
