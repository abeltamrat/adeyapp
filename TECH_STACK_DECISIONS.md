# Tech Stack Decisions

## Summary

This document locks the recommended technology choices for the first implementation of the multi-tenant spa management platform.

The stack is optimized for:

- Fast greenfield delivery
- Strong contract sharing across apps
- Mobile-first Expo development
- cPanel-safe deployment with PHP and MySQL
- Multi-tenant security and auditability
- Offline-safe operational workflows

## Core Decisions

### Monorepo

Decision:

- Use `pnpm` workspaces with `Turborepo`

Why:

- Good fit for multiple apps and shared packages
- Fast local development and caching
- Strong TypeScript monorepo ergonomics

### Frontend Runtime

Decision:

- Use `Expo` + `Expo Router` for mobile apps
- Prefer static-compatible web surfaces only when they can be hosted without Node

Why:

- Expo is the right fit for mobile staff and customer workflows
- Expo Router gives predictable app structure and shared navigation patterns
- The deployment constraint rules out Node-based hosting on the shared server

App mapping:

- `apps/tenant-app`: Expo
- `apps/customer-app`: Expo
- `apps/public-web`: optional static export
- `apps/superadmin-web`: optional static export or Expo web build

### Frontend Language And Styling

Decision:

- Use `TypeScript` everywhere
- Use `Tamagui` for shared cross-platform UI primitives
- Use `Tailwind CSS` only in Next.js apps where needed for layout utility speed

Why:

- TypeScript shared across frontend and backend reduces drift
- Tamagui supports Expo and web sharing better than building two separate UI systems
- Next.js admin and marketing surfaces still benefit from utility styling where practical

UI rules:

- Shared components live in `packages/ui`
- Brand tokens and spacing live in one shared theme source
- Role-specific screens can compose shared primitives without duplicating logic

## Backend Decisions

### API Framework

Decision:

- Use plain `PHP 8+` for the deployable API under cPanel shared hosting
- Keep the earlier Node/NestJS code only as a non-deployable reference or migration path

Why:

- Shared hosting cannot run a persistent Node API reliably
- PHP is the natural fit for cPanel routing, cron, file handling, and MySQL access
- The business rules are still modular even without a Node runtime

### API Style

Decision:

- Use REST for primary application APIs
- Use a shared contract package for typed client contracts

Why:

- Easier mobile integration
- Simpler debugging and offline queue replay
- Good fit for cPanel-hosted APIs and webhook ingestion

Rules:

- Prefix all routes with `/api/v1`
- Use idempotency keys for critical write endpoints
- Resolve tenant context server-side from auth and route context

### Background Jobs

Decision:

- Use MySQL-backed work queues plus cPanel cron jobs in phase 1

Why:

- Shared hosting does not guarantee Redis or always-on workers
- Cron-triggered job runners are realistic on cPanel
- Notifications, retries, and deferred sync can still be modeled safely with database state

Primary queues:

- `notifications`
- `billing`
- `reporting`
- `sync`
- `maintenance`

## Database And Persistence

### Primary Database

Decision:

- Use `MySQL 8` hosted via cPanel shared hosting

Why:

- Matches the stated hosting environment
- Strong enough for the initial relational model and transactional flows
- Supports JSON fields, indexing, and tenant-scoped operational queries
- Keeps early infrastructure simpler when shared hosting is already available

### Data Access

Decision:

- Keep `Prisma` for local schema management and migrations
- Use `PDO` in the deployed PHP backend

Why:

- Fast iteration for greenfield schema development
- PDO is universally available in PHP hosting
- Prisma is still useful during development even if production runtime is PHP

Usage rules:

- Prisma models represent the source of truth for application persistence
- Complex reporting queries may use SQL where Prisma becomes awkward
- Ledger-critical operations should use transactions deliberately
- Schema design should stay MySQL-aware, especially around indexes, text columns, and datetime precision

### Cache

Decision:

- Avoid making Redis a requirement for phase 1

Why:

- Shared hosting compatibility matters more than cache sophistication at this stage

### File Storage

Decision:

- Use a storage abstraction with phase 1 default:
- cPanel-hosted file storage for uploaded documents and low-volume media
- optional future upgrade to `S3-compatible` object storage

Use cases:

- Policy documents
- customer attachments
- evidence photos for infractions
- future media uploads

Rules:

- Tenant-aware object path prefixes
- Signed or access-controlled file delivery for private files
- Do not bind business logic directly to local filesystem paths
- Keep storage adapter swappable so high-volume media can move to object storage later

## Authentication And Authorization

### Auth Model

Decision:

- Use custom auth in the PHP API with JWT access tokens and refresh tokens

Why:

- Full control over tenant-aware session claims
- Easier support for employee suspension, tenant suspension, and branch context handling
- Better fit for custom workforce states than outsourcing everything to a third-party auth product

Auth rules:

- Short-lived access token
- Rotating refresh token
- Device/session tracking for staff accounts
- Forced session invalidation on suspension or termination

### Passwords And Security

Decision:

- Use `argon2` for password hashing
- Use email/password in phase 1
- Add phone OTP later

### Authorization

Decision:

- Use RBAC plus scoped grants

Resolution order:

1. authenticated user
2. tenant membership
3. employee or customer status
4. branch scope
5. role grants
6. feature entitlement
7. policy rules

## Mobile Offline Strategy

### Local Storage

Decision:

- Use `Expo SQLite` for offline queue and cached operational data

Why:

- Better than AsyncStorage for structured offline records
- Supports queued writes and local search for operational screens

### Server State

Decision:

- Use `TanStack Query`

Why:

- Strong caching, invalidation, and sync patterns
- Works well in Expo and Next.js

Offline rules:

- Read models can be cached locally
- Offline writes are stored as queued actions in SQLite
- Financial actions require connectivity
- Sync replay must be idempotent

## Web Decisions

### Public Web

Decision:

- Next.js App Router with static and server-rendered marketing pages

Why:

- SEO and performance
- Easy landing page and pricing content management

### Superadmin Web

Decision:

- Next.js App Router with authenticated dashboard routes

Why:

- Strong fit for complex data tables and operational dashboards
- Easy integration with shared packages and auth client

## Forms, Validation, And Tables

### Forms

Decision:

- Use `react-hook-form` + `zod`

Why:

- Good performance and validation ergonomics
- Shared schemas can be reused between frontend and backend where helpful

### Validation

Decision:

- Use `zod` for shared input schemas
- Validate again inside the PHP API at request boundaries

### Data Tables

Decision:

- Use `TanStack Table` in web apps

Why:

- Flexible for superadmin and admin-heavy surfaces

## Notifications And Messaging

### Push Notifications

Decision:

- Use `Expo Notifications` for mobile push in phase 1

### Email

Decision:

- Use `Resend`

Why:

- Fast setup
- Good developer ergonomics for transactional email

### SMS

Decision:

- Keep provider abstraction in phase 1
- Default recommended provider: `Twilio` or `Africa's Talking` depending on deployment geography

Why:

- The product may serve African markets, so local delivery quality matters
- Provider should stay abstracted behind one messaging service

## Payments And Billing

### Payment Gateway

Decision:

- Abstract payment provider behind a billing service
- Default first provider: `Stripe` if target geography supports it well
- Alternative regional path: `Flutterwave` or `Paystack`

Why:

- Billing logic should not be coupled to one gateway
- Regional payment realities may matter more than engineering convenience

Billing architecture rules:

- Payment webhooks are processed through dedicated ingestion endpoints
- Provider event payloads are stored for auditability
- Invoice and payment states are updated idempotently

## Reporting And Observability

### App Monitoring

Decision:

- Use `Sentry`

Why:

- Covers Expo and browser surfaces immediately
- PHP monitoring can be added through server-side logging and Sentry SDK later

### Product Analytics

Decision:

- Use `PostHog`

Why:

- Useful for tenant health signals, funnel analytics, and feature adoption
- Helps power the future tenant health scorecard

### Logging

Decision:

- Use structured JSON logs from backend services

Recommended libraries:

- NestJS logger integration with `pino`

## Testing Strategy

### Frontend

Decision:

- Use `Vitest` for unit tests
- Use `React Native Testing Library` for Expo components
- Use `Playwright` for web end-to-end tests

### Backend

Decision:

- Use API smoke tests against MySQL-backed PHP endpoints
- Keep TypeScript tests for shared packages where useful

### API And Workflow Testing

Decision:

- Add integration coverage for auth, tenant isolation, bookings, attendance, billing, and audit flows

## Deployment Decisions

### Frontend Hosting

Decision:

- Host only static-compatible browser surfaces on cPanel or another static host

Why:

- The shared-hosting constraint removes Node-hosted SSR from the default plan

### Backend Hosting

Decision:

- Host the API, MySQL access, and uploaded files on cPanel shared hosting

Why:

- This matches the stated deployment limit
- It avoids building critical runtime pieces on infrastructure that cannot be used in production

### Database Hosting

Decision:

- Use cPanel-hosted `MySQL 8`

Requirements:

- remote connection access from the API host
- daily backup policy
- SSL support if available
- clear connection limits and timeout behavior

### Redis Hosting

Decision:

- Do not require Redis for shared-hosting deployment

## Environment Management

Decision:

- Use `.env` files locally
- Use environment-specific secrets in deployment platforms

Suggested environment groups:

- `local`
- `staging`
- `production`

Required secret categories:

- database
- jwt secrets
- email provider
- sms provider
- payment provider
- storage provider
- sentry
- posthog

## Non-Negotiable Engineering Rules

- Every tenant-owned table includes `tenantId`
- Branch-owned tables include `branchId` where relevant
- Financial write paths use database transactions
- Audit logs are append-only
- Sync endpoints must be idempotent
- Suspended tenants and suspended employees lose privileged access immediately
- Policy evaluation must happen server-side for protected operations
- Hosting assumptions must not depend on long-running processes inside cPanel shared hosting

## Hosting Constraint Notes

- cPanel shared hosting should be treated as a database and file-storage environment, not the primary runtime for the full Node platform
- Keep upload paths tenant-prefixed and environment-configurable
- Expect stricter resource limits, connection caps, and slower I/O than managed infrastructure
- Avoid designs that require persistent WebSocket hubs, local Redis, or filesystem-heavy processing inside shared hosting
- If public marketing pages must later move to cPanel, prefer static export compatibility for the public site only

## Final Stack Summary

- Monorepo: `pnpm` + `Turborepo`
- Mobile apps: `Expo` + `Expo Router`
- Web surfaces: static export only when needed
- Shared UI: `Tamagui`
- Backend: `PHP 8+` on cPanel
- DB: `MySQL 8` on cPanel shared hosting
- Data access: `Prisma` for local schema management, `PDO` in production PHP runtime
- Jobs/cache: MySQL-backed deferred work plus cron
- Auth: custom JWT + refresh token model
- Forms/validation: `react-hook-form` + `zod`
- State/data fetching: `TanStack Query`
- Offline mobile storage: `Expo SQLite`
- Email: `Resend`
- SMS: abstracted provider, default `Twilio` or `Africa's Talking`
- Payments: abstracted provider, default `Stripe` with regional fallback
- Storage: cPanel-hosted files first, storage abstraction for future S3-compatible migration
- Monitoring: `Sentry`
- Analytics: `PostHog`
- Web E2E: only if static browser surfaces remain in scope

## Recommended Next Step

Create `SCAFFOLDING_PLAN.md` next to define:

- monorepo folders to create first
- package setup order
- initial app generation steps
- shared package interfaces
- first migration and seed plan
