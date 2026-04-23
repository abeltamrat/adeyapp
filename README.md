# AdeyApp

AdeyApp is a multi-tenant spa management platform built around a practical shared-hosting deployment model.

The product includes:

- a public marketing web surface
- a superadmin platform for tenant and billing control
- a tenant app for owners, managers, receptionists, and employees
- a customer app for booking, history, and notifications
- a PHP + MySQL backend designed for cPanel/shared hosting

## Current Status

- `Phase 1`: complete for the defined operational MVP scope
- `Phase 2`: complete for the defined operations-expansion scope
- `Backend deploy path`: aligned to `PHP + MySQL + cPanel shared hosting`
- `Mobile apps`: Expo-based
- `Repo hosting`: GitHub at `https://github.com/abeltamrat/adeyapp`

For detailed completion tracking, see:

- [PHASE1_STATUS.md](PHASE1_STATUS.md)
- [PHASE2_STATUS.md](PHASE2_STATUS.md)

## Architecture

This repo started as a broader monorepo plan and now contains both planning docs and working implementation slices.

### Production-minded path

- `Backend API`: PHP under `backend/`
- `Database`: MySQL
- `Mobile apps`: Expo
- `Files`: filesystem / cPanel-friendly storage

### Important hosting note

The backend is intentionally implemented in PHP because the target hosting environment is shared `cPanel` hosting where `Node.js` is not available as the primary runtime.

The repo still contains `Next.js` web apps for the public website and superadmin interface. Those are useful in development, but for a strict no-Node production environment they should be:

- exported to static hosting where possible, or
- moved behind a hosting setup that supports Node, or
- later rewritten into a cPanel-safe web delivery strategy

The core operational path that matters most for shared hosting is the `Expo + PHP + MySQL` path.

## Main Capabilities

### Platform

- tenant onboarding
- multi-tenant access control
- superadmin tenant lifecycle management
- subscription, invoice, payment, and ledger basics
- module entitlement controls
- audit logging
- support tickets
- maintenance and operational notifications

### Tenant Operations

- workspace and branch setup
- rooms, services, products, and inventory basics
- employees, managers, receptionists, and owners
- shift templates and assignments
- attendance with approved network validation
- lateness tracking and corrections
- appointment booking and front-desk flow
- employee service execution flow
- policy enforcement and acknowledgements
- payroll snapshots and expanded payroll operations
- employee credit lifecycle
- leave management
- inventory procurement and receiving
- waitlist handling
- reporting

### Customer Experience

- browse services by workspace and branch
- create bookings
- register and log in
- view booking history
- receive notifications
- manage customer profile

## Repository Layout

### Applications

- `apps/public-web` - public marketing web app
- `apps/superadmin-web` - superadmin web app
- `apps/tenant-app` - Expo tenant app for owner, manager, receptionist, employee
- `apps/customer-app` - Expo customer app

### Backend

- `backend/` - PHP API for the cPanel-safe production path
- `backend/public` - public web root for the PHP app
- `backend/bootstrap.php` - shared backend bootstrapping and auth/session helpers
- `backend/phase2_operations.php` - phase 2 operations module

### Shared Packages

- `packages/types` - shared contracts and payload types
- `packages/api-client` - shared client calls used by apps
- `packages/auth` - shared auth helpers
- `packages/ui` - shared UI primitives
- `packages/config` - shared configuration helpers

### Data And Planning

- `prisma/` - schema and SQL migrations
- root `*.md` files - planning, scope, stack, schema, and implementation notes

## Key Docs

- [SPA_MULTI_TENANT_PLAN.md](SPA_MULTI_TENANT_PLAN.md)
- [IMPLEMENTATION_BLUEPRINT.md](IMPLEMENTATION_BLUEPRINT.md)
- [MVP_SCOPE.md](MVP_SCOPE.md)
- [DATA_MODEL_DRAFT.md](DATA_MODEL_DRAFT.md)
- [TECH_STACK_DECISIONS.md](TECH_STACK_DECISIONS.md)
- [SCAFFOLDING_PLAN.md](SCAFFOLDING_PLAN.md)
- [INITIAL_SCHEMA_PLAN.md](INITIAL_SCHEMA_PLAN.md)
- [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md)
- [ENVIRONMENT_SETUP_CHECKLIST.md](ENVIRONMENT_SETUP_CHECKLIST.md)
- [PHASE1_STATUS.md](PHASE1_STATUS.md)
- [PHASE2_STATUS.md](PHASE2_STATUS.md)

## Local Development

### Prerequisites

- `Node.js`
- `pnpm`
- `PHP`
- `MySQL`
- `XAMPP` is fine for local MySQL and PHP serving

### Environment

Copy `.env.example` to `.env` and fill in the real local values.

Important variables include:

- `DATABASE_URL`
- `EXPO_PUBLIC_API_URL`
- `APP_URL_TENANT_API`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

### Install dependencies

```powershell
corepack enable
pnpm install
```

### Generate Prisma client

```powershell
pnpm db:generate
```

### Run database migration

```powershell
pnpm db:migrate
```

### Start the PHP backend

```powershell
php -S 127.0.0.1:8080 -t backend/public backend/public/router.php
```

### Start the public web app

```powershell
pnpm --filter @adeyapp/public-web dev
```

### Start the superadmin web app

```powershell
pnpm --filter @adeyapp/superadmin-web dev
```

### Start the tenant Expo app

```powershell
pnpm --filter @adeyapp/tenant-app dev
```

### Start the customer Expo app

```powershell
pnpm --filter @adeyapp/customer-app dev
```

### Typecheck the workspace

```powershell
pnpm typecheck
```

## Deployment Notes

### cPanel / shared hosting

The intended shared-hosting deployment path is:

- host MySQL in cPanel
- deploy `backend/public` as the public PHP entrypoint
- keep backend writable storage in a cPanel-safe filesystem path
- point the mobile apps to the hosted PHP API base URL

### Database migrations

Local migrations have already been applied during development. Before deploying to hosted MySQL, make sure the latest migrations in `prisma/migrations/` are applied there as well.

### File storage

The repo assumes filesystem-backed storage by default. Shared hosting is acceptable for this, but large media growth may eventually justify moving to object storage.

## Verification

The repo has been repeatedly checked with:

- PHP syntax validation on backend entrypoints
- TypeScript typechecking across the workspace
- local MySQL smoke tests for the core operational flows

Important honesty note:

- many backend and operational flows were live-tested locally
- the Expo apps are integrated and typechecked
- not every native mobile path has been re-verified on a physical device after every slice

## Next Logical Work

Now that phase 1 and phase 2 are complete for the defined scopes, the next sensible directions are:

1. phase 3 planning
2. deployment hardening for hosted MySQL and cPanel
3. public-web polish
4. deeper calendar, POS, analytics, and GPS attendance work

