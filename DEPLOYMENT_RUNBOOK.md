# Deployment Runbook

## Summary

This runbook describes the safest deployment path for AdeyApp on the currently intended production model:

- `PHP + MySQL`
- `cPanel shared hosting`
- `Expo` mobile apps pointing to the hosted PHP API

It is written for the current repo state, where:

- the deployable backend is `backend/`
- the public PHP web root is `backend/public`
- schema changes live in `prisma/migrations/`
- production should not depend on a persistent `Node.js` runtime

## Scope

This runbook covers:

- backend deployment to cPanel
- MySQL preparation and migration application
- storage path setup
- environment variable setup
- mobile app API configuration
- cron and recurring-job guidance
- post-deploy validation
- rollback guidance

This runbook does **not** assume:

- a persistent Node server
- Redis
- background workers outside cron
- server-side rendering in production

## Deployment Model

### Production path

- deploy the PHP backend to cPanel
- host MySQL in cPanel
- expose the API through a subdomain or subfolder pointed at `backend/public`
- configure Expo apps to call that hosted API base URL

### Recommended domain layout

Examples:

- `https://api.example.com` -> points to `backend/public`
- `https://app.example.com` -> optional static web shell later
- `https://admin.example.com` -> optional static superadmin shell later

If only one cPanel host is available, the most important deploy target is the API domain.

## Preconditions

Before any production deployment, confirm:

- cPanel account is active
- MySQL database exists
- MySQL user exists with create, alter, index, and foreign-key privileges
- remote or local migration method is chosen
- PHP version is compatible with the backend code
- `mod_rewrite` is enabled for `.htaccess`
- SSL is enabled on the final API domain
- writable storage paths are known
- secrets are ready

## Files To Deploy

### Required backend paths

- `backend/`
- `prisma/migrations/`

### Most important backend files

- `backend/public/index.php`
- `backend/public/.htaccess`
- `backend/public/router.php`
- `backend/bootstrap.php`
- `backend/phase2_operations.php`

### Important note

The PHP runtime does not need the Expo app source, Next.js apps, or Node tooling to serve the API in production. Those stay in the repo for development and future delivery options.

## Recommended cPanel Directory Layout

One safe pattern is:

```text
/home/<cpanel-user>/
  adeyapp/
    backend/
    storage/
      notifications/
      uploads/
      private/
  public_html/
    api/   -> contents of backend/public or a symlink/redirect target if hosting allows it
```

If cPanel allows a subdomain document root, a cleaner pattern is:

```text
api.yourdomain.com -> /home/<cpanel-user>/adeyapp/backend/public
```

## Co-located Hosting Structure

If hosting everything on a single subdomain (`adey.nonstopplc.com`), use the following structure in the subdomain's root folder:

| Path | Purpose | Content Source |
| :--- | :--- | :--- |
| `/` | Marketing/Public Web | `apps/public-web` (Static Export) |
| `/api/` | Tenant & Public API | `backend/public/` |
| `/app/` | Tenant Web App | `apps/tenant-app` (Expo Web Build) |
| `/storage/` | Media & File Uploads | Server-side storage directory |

### .htaccess for Co-location
Ensure the root `.htaccess` handles the routing for the Next.js marketing site and the subfolders:

```apache
RewriteEngine On

# 1. API Routing
# Directs /api/ calls to the backend router
RewriteRule ^api/(.*)$ backend/public/index.php [QSA,L]

# 2. Storage Access
# Directs /storage/ calls to the storage folder
RewriteRule ^storage/(.*)$ storage/$1 [L]

# 3. App Routing
# Directs /app/ calls to the Expo Web build
# Note: Expo Router for Web handles its own sub-routing
RewriteCond %{REQUEST_URI} ^/app
RewriteRule ^app/.*$ app/index.html [L]

# 4. Marketing Site (Root)
# Handled by the static export files in the root
```

## Environment Configuration

### Production Domain
- **Main Domain**: `adey.nonstopplc.com`
- **Deployment Folder**: Isolated subdomain directory under `nonstopplc.com`.
- **Deployment Method**: GitHub Actions via FTP (already configured).

### Minimum required production values

- `APP_ENV=production`
- `APP_URL_TENANT_API=https://adey.nonstopplc.com/api`
- `EXPO_PUBLIC_API_URL=https://adey.nonstopplc.com/api`
- `DATABASE_URL=mysql://nonstopp_adey_user:pass%40adey_user@localhost:3306/nonstopp_adey`
- `JWT_ACCESS_SECRET=<generate-strong-secret>`
- `JWT_REFRESH_SECRET=<generate-strong-secret>`
- `STORAGE_DRIVER=filesystem`
- `STORAGE_BASE_PATH=/home/nonstopp/adey.nonstopplc.com/storage`
- `STORAGE_PUBLIC_BASE_URL=https://adey.nonstopplc.com/storage`
- `EMAIL_FROM_ADDRESS=noreply@adey.nonstopplc.com`

### Database Credentials Summary
| Key | Value |
| :--- | :--- |
| **Host** | `localhost` |
| **Database** | `nonstopp_adey` |
| **User** | `nonstopp_adey_user` |
| **Password** | `pass@adey_user` |

## Database Deployment

### Recommended approach

Apply migrations against hosted MySQL from a trusted local machine, not from inside shared hosting.

Reason:

- the repo already uses Prisma migrations locally
- shared hosting often does not provide a safe Prisma CLI workflow
- applying reviewed SQL manually is more predictable

### Current migration set

Apply these in order:

1. `prisma/migrations/20260421173729_init/migration.sql`
2. `prisma/migrations/20260421195500_shift_scheduling/migration.sql`
3. `prisma/migrations/20260423111500_superadmin_support_reporting/migration.sql`
4. `prisma/migrations/20260423183000_waitlist_phase2/migration.sql`
5. `prisma/migrations/20260423195500_phase2_operations/migration.sql`

### Migration procedure

1. Back up the hosted database before any change.
2. Confirm the target database name, host, and user are correct.
3. Apply migration SQL files in order.
4. Stop immediately on the first failure.
5. Verify new tables and indexes exist before continuing.

### Recommended execution methods

- MySQL Workbench connected to hosted MySQL
- `mysql` CLI from a trusted local machine
- cPanel database query/import tool only if the files are small enough and foreign-key execution order is preserved

### Important rule

Never skip a migration file in the middle of the sequence.

## Storage Setup

### Required writable paths

At minimum, prepare writable directories for:

- notifications outbox logs
- uploaded documents
- evidence photos
- future private attachments

Example:

```text
/home/<cpanel-user>/adeyapp/storage/
  notifications/
  uploads/
  private/
```

### Current backend behavior

The backend already writes notification outbox entries, for example:

- `storage/notifications/email-outbox.log`

So production must ensure this path exists and is writable by PHP.

### Storage rules

- do not expose private storage folders directly under a public URL
- tenant-prefix uploaded paths where possible
- verify file size limits in PHP and cPanel
- verify retention and backup expectations

## Web Root And Routing

### Required Apache behavior

The API depends on `backend/public/.htaccess`:

```apache
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [QSA,L]
```

That means:

- `mod_rewrite` must be enabled
- `AllowOverride` must permit `.htaccess`
- unresolved API paths must route to `index.php`

### Validation

After deployment, this should work:

- `GET /api/v1/health`

If that fails with a server routing error, treat `.htaccess` or document-root configuration as the first suspect.

## Backend Release Procedure

### Safe release order

1. put the release bundle together locally
2. back up the database
3. upload backend files to cPanel
4. update secrets and env config
5. create storage directories if missing
6. apply database migrations
7. run health and smoke checks
8. only then point mobile apps or users to the new environment

### Suggested backend release bundle

- `backend/`
- `prisma/migrations/`
- any deployment-specific config notes

### Important note

Do not upload:

- `.env`
- local development logs
- `node_modules`
- `.pnpm-store`
- Expo build artifacts unless intentionally shipping a web export

## Mobile App Configuration

### Tenant app

Set the production API base URL through:

- `EXPO_PUBLIC_API_URL`

### Customer app

Use the same API base URL pattern so customer booking and auth hit the hosted PHP API.

### Release rule

Do not publish new mobile builds until the hosted API and database migrations are already live and validated.

## Cron And Recurring Jobs

### Current shared-hosting reality

The system already works primarily in a request-driven way. Cron should be introduced carefully and only for tasks that fit cPanel well.

### Good cron candidates

- trial-ending reminder scans
- maintenance or reminder dispatchers
- cleanup tasks for old temp files
- periodic reconciliation/report materialization later

### Important constraint

Do not design production around long-running workers.

### Recommended phase 3 follow-up

Add dedicated cron-safe PHP entrypoints or internal job endpoints before relying heavily on scheduled automation.

For now, treat cron as a deployment-hardening item that should be introduced in a controlled follow-up slice rather than improvised per release.

## Post-Deploy Validation

### Minimum checks

Run these checks immediately after deployment:

1. `GET /api/v1/health`
2. login flow for a known owner account
3. tenant branch list retrieval
4. receptionist customer creation
5. appointment creation
6. employee attendance check-in
7. superadmin login
8. support ticket create and resolve flow
9. billing summary retrieval
10. notification outbox write check

### Recommended smoke scenarios

- owner can log in and see tenant context
- receptionist can create a booking
- employee can check in on an approved network identifier
- customer can authenticate and view appointments
- superadmin can load tenant list and tenant detail

### Data checks

Verify that the hosted database contains:

- all new phase 1 and phase 2 tables
- foreign keys in expected places
- support-ticket tables
- waitlist tables
- leave, credit, payroll batch, supplier, and purchase-order tables

## Rollback Guidance

### If code deployment fails before migration

- restore previous backend files
- keep the existing database untouched

### If code deployment fails after migration but before user traffic

- restore previous backend files
- assess whether the schema change is backward-compatible
- if not backward-compatible, restore the database from backup

### If migration partially fails

- stop immediately
- do not continue applying later migrations
- inspect the last successful statement
- restore from backup if schema state is uncertain

### Important rollback rule

Because migrations are additive and relational, database backup before deployment is non-negotiable.

## Release Checklist

Before release:

- backup completed
- migration files reviewed
- production secrets ready
- storage path confirmed
- API domain and SSL confirmed
- `.htaccess` behavior confirmed

During release:

- backend files uploaded
- config updated
- migrations applied in order
- health check passed

After release:

- login tested
- booking tested
- attendance tested
- support tested
- billing tested
- outbox log write tested

## Known Risks

- shared hosting may have connection limits or slow I/O
- large SQL migrations may be harder to apply through cPanel tools
- public-web and superadmin web apps still need static-hosting decisions if they are to be served without Node
- cron maturity is still behind the operational feature maturity

## Recommended Next Step

After this runbook, the next best phase 3 artifact is:

- `PUBLIC_WEB_PHASE3.md` or `CALENDAR_UX_PLAN.md`

If the immediate goal is launch readiness, `PUBLIC_WEB_PHASE3.md` should come first.

