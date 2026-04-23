# Environment Setup Checklist

## Summary

This document lists the prerequisites and environment requirements needed before implementation begins.

It covers:

- local development tooling
- monorepo prerequisites
- cPanel MySQL requirements
- file storage assumptions
- environment variables
- third-party providers
- staging and production readiness

## 1. Local Development Prerequisites

Install and verify:

- `Node.js` LTS
- `pnpm`
- `Git`
- `MySQL` client tools
- `Expo CLI` tooling through `npx expo`
- Android Studio or physical Android device for Expo testing
- Xcode only if iOS builds will be done locally on macOS

Recommended versions:

- `Node.js` 20 LTS
- `pnpm` 9+
- `MySQL` client compatible with MySQL 8

Verify locally:

- `node -v`
- `pnpm -v`
- `git --version`
- `npx expo --version`
- `mysql --version`

## 2. Repository Bootstrap Requirements

Before scaffolding:

- confirm the repo root is the final workspace location
- confirm `pnpm` workspaces will be used
- confirm `Turborepo` will be used
- confirm TypeScript is the default across all apps and services

Root files to create during setup:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`
- `.editorconfig`
- `.env.example`
- `tsconfig.base.json`

## 3. cPanel MySQL Requirements

Because MySQL will be hosted on cPanel shared hosting, confirm all of the following before implementation depends on it:

- MySQL version is `8.x`
- remote database access is enabled for the API host IPs
- database user can create, alter, index, and migrate tables
- connection hostname is known
- connection port is known
- SSL support is known
- daily backup policy is confirmed
- maximum connection limits are known
- timeout behavior is known

Minimum required details:

- database host
- database port
- database name
- database username
- database password
- allowed remote IP list

Recommended checks:

- test remote login from the future API host
- confirm Prisma migrations can run successfully
- confirm foreign keys are supported and enabled
- confirm charset is `utf8mb4`
- confirm timezone handling expectations

## 4. File Storage Requirements

Phase 1 assumption:

- some uploaded files will be stored in cPanel-accessible storage

Confirm:

- writable upload path exists or can be created
- private file access pattern is defined
- max upload size is known
- allowed file types are known
- backup and retention expectations are known

Recommended storage rules:

- all file paths should be tenant-prefixed
- do not hardcode absolute file paths in business logic
- file access should go through one storage service abstraction
- sensitive files should not be directly public by default

Expected upload categories:

- policy documents
- staff evidence photos
- customer attachments if enabled later

## 5. Local Environment Variables

The local `.env` should eventually include values for:

### Core App

- `NODE_ENV`
- `APP_ENV`
- `APP_URL_PUBLIC_WEB`
- `APP_URL_SUPERADMIN_WEB`
- `APP_URL_TENANT_API`
- `APP_URL_CUSTOMER_APP`

### Database

- `DATABASE_URL`

### Auth

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`

### Queue And Cache

- `QUEUE_DRIVER`
- `REDIS_URL`

Notes:

- `QUEUE_DRIVER` should support a MySQL-backed fallback for shared-hosting-safe phase 1 deployment
- `REDIS_URL` may be blank locally if MySQL-backed jobs are used first

### File Storage

- `STORAGE_DRIVER`
- `STORAGE_BASE_PATH`
- `STORAGE_PUBLIC_BASE_URL`

### Email

- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`

### SMS

- `SMS_DRIVER`
- `SMS_API_KEY`
- `SMS_API_SECRET`
- `SMS_SENDER_ID`

### Payments

- `PAYMENT_DRIVER`
- `PAYMENT_SECRET_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `PAYMENT_PUBLIC_KEY`

### Monitoring And Analytics

- `SENTRY_DSN`
- `POSTHOG_KEY`
- `POSTHOG_HOST`

## 6. Provider Decisions Needed Before Billing And Messaging

Before implementation reaches those modules, confirm:

### Email

- final provider for transactional email
- verified sending domain
- from-address strategy

### SMS

- final provider for target geography
- sender ID approval requirements
- delivery reporting requirements

### Payments

- primary gateway for the initial launch region
- webhook support
- available payment methods
- settlement timing expectations
- refund support expectations

## 7. Local Services Strategy

Decide how local development will run:

### Option A: Mostly local

- local API
- local apps
- remote cPanel MySQL
- local file storage path

### Option B: Safer recommended default

- local API
- local apps
- local development MySQL or Docker MySQL
- remote cPanel MySQL only for staging/production

Recommended default:

- use local MySQL for daily development
- reserve cPanel MySQL for staging/production validation

Why:

- shared-hosting latency and connection caps can slow development
- local schema resets and seeds are easier
- safer migration testing before touching remote shared hosting

## 8. Staging Environment Checklist

Before staging is considered ready:

- API deployment target exists
- worker deployment target exists or queue fallback is configured
- remote MySQL connection works
- file storage path works
- HTTPS is enabled
- env vars are configured
- email provider is connected
- payment webhooks can reach the API
- Sentry is connected

## 9. Production Environment Checklist

Before production go-live:

- database backups are confirmed
- restore procedure is documented
- cPanel MySQL access is locked to approved hosts
- secrets are not reused from local or staging
- error monitoring is live
- audit logs are queryable
- payment webhooks are verified
- maintenance communication path exists
- upload storage cleanup policy exists

## 10. Mobile App Setup Checklist

Before Expo implementation:

- Expo project naming conventions are decided
- Android package name is decided
- iOS bundle identifier is decided if relevant
- push notification strategy is confirmed
- device testing plan exists
- offline SQLite approach is accepted

## 11. Web App Setup Checklist

Before Next.js scaffolding:

- public web domain plan is known
- superadmin domain or subdomain plan is known
- auth cookie/token strategy for web is accepted
- environment-based API URLs are defined

## 12. Security Setup Checklist

Before protected flows are implemented:

- JWT secret generation method is defined
- password hashing strategy is confirmed
- session revocation behavior is defined
- rate limiting strategy is defined
- audit action registry is planned
- file upload validation rules are defined

## 13. MySQL And Prisma Validation Checklist

Before the first real migration:

- Prisma connects successfully to the target MySQL database
- migration user has required privileges
- charset and collation are verified
- foreign key behavior is confirmed
- decimal precision behavior is confirmed
- timezone behavior is confirmed
- seed script can run safely

## 14. Recommended Setup Order

1. Install local prerequisites
2. Confirm local package manager and Node versions
3. Confirm local MySQL development approach
4. Confirm cPanel MySQL remote access details
5. Confirm API hosting target
6. Confirm file storage path and access pattern
7. Create `.env.example`
8. Create local `.env`
9. Test database connectivity
10. Test email provider in sandbox mode
11. Test payment webhook delivery path when billing work begins

## 15. Blocking Questions To Resolve Before Implementation

- Will local development use local MySQL or connect directly to cPanel MySQL?
- What API host will be used outside cPanel shared hosting?
- Which payment gateway is preferred for the initial launch geography?
- Which SMS provider is preferred for the initial launch geography?
- What exact cPanel file path or domain path should uploaded files use?

## Recommended Next Step

The planning package is now strong enough to start implementation.

Recommended immediate action:

- begin scaffolding the monorepo foundation from `SCAFFOLDING_PLAN.md`
