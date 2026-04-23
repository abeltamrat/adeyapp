# Scaffolding Plan

## Summary

This document defines the order and structure for setting up the repository and initial application scaffolding for the multi-tenant spa management platform.

Objectives:

- Create a clean monorepo foundation
- Establish shared packages before feature work starts
- Avoid early rework by locking interfaces and conventions
- Sequence implementation so auth, tenant context, and core operations are built on stable primitives

## Phase 0: Repository Bootstrap

Create the monorepo root structure:

```text
adeyapp/
  apps/
    public-web/
    superadmin-web/
    tenant-app/
    customer-app/
  packages/
    config/
    types/
    ui/
    auth/
    api-client/
  services/
    api/
    jobs/
  prisma/
  docs/
```

Root setup tasks:

- Initialize `package.json`
- Configure `pnpm-workspace.yaml`
- Configure `turbo.json`
- Add root `tsconfig.base.json`
- Add root `.editorconfig`
- Add root `.gitignore`
- Add root `.env.example`
- Add root lint and format scripts

Recommended root scripts:

- `dev`
- `build`
- `lint`
- `test`
- `typecheck`
- `db:generate`
- `db:migrate`
- `db:seed`

## Phase 1: Shared Package Foundations

### 1. `packages/config`

Purpose:

- Shared TypeScript, ESLint, Prettier, and environment conventions

Initial contents:

- shared tsconfig presets
- eslint config
- prettier config
- environment helpers

### 2. `packages/types`

Purpose:

- Shared domain types and DTO-facing contracts

Initial exports:

- auth session types
- tenant context types
- role enums
- appointment statuses
- attendance statuses
- billing statuses
- shared pagination types

Rule:

- Only stable cross-app types go here
- Persistence-layer ORM types should not leak into this package

### 3. `packages/auth`

Purpose:

- Shared auth utilities across apps

Initial exports:

- token/session types
- auth guard helpers
- permission check helpers
- tenant and branch context helpers

### 4. `packages/api-client`

Purpose:

- Shared typed API client for mobile and web apps

Initial features:

- request wrapper
- auth header injection
- tenant context handling
- error normalization
- endpoint modules for auth, tenant, branch, bookings, attendance, billing

### 5. `packages/ui`

Purpose:

- Shared design system and reusable primitives

Initial components:

- button
- input
- select
- card
- badge
- modal
- screen layout
- app shell primitives
- loading and empty states

Initial theme primitives:

- color tokens
- spacing tokens
- typography tokens
- elevation tokens

## Phase 2: Application Shells

### 1. `apps/public-web`

Initial goal:

- Establish public marketing shell and routing

Scaffold first:

- home page
- features page
- pricing page
- help page
- contact page
- auth entry routes

### 2. `apps/superadmin-web`

Initial goal:

- Establish protected admin shell and tenant operations navigation

Scaffold first:

- login
- dashboard shell
- tenants list
- tenant detail placeholder
- plans placeholder
- billing overview placeholder
- audit placeholder

### 3. `apps/tenant-app`

Initial goal:

- Establish Expo app shell with role-based route groups

Scaffold first:

- auth flow
- workspace selection
- branch selection
- owner route group
- manager route group
- receptionist route group
- employee route group
- notifications screen
- profile screen

### 4. `apps/customer-app`

Initial goal:

- Establish customer mobile shell

Scaffold first:

- auth flow
- home
- branches
- services
- booking
- appointments
- profile

## Phase 3: Backend Service Foundations

### `services/api`

Create NestJS app with initial modules:

- `app`
- `health`
- `auth`
- `identity`
- `tenant-management`
- `branch-management`
- `rbac`
- `appointments`
- `attendance`
- `billing`
- `notifications`
- `audit-log`
- `policy-management`

Initial cross-cutting setup:

- config module
- prisma module
- auth guards
- tenant context resolver
- branch scope resolver
- request logging
- error handling
- OpenAPI generation

### `services/jobs`

Create worker service with initial queues:

- notifications
- billing
- reporting
- sync

Initial job handlers:

- send email notification
- send in-app notification
- process billing retry
- process maintenance announcement
- process offline sync batch

Hosting note:

- Because MySQL and files will live on cPanel shared hosting, job execution should start behind a queue abstraction
- Phase 1 may use MySQL-backed job tables and scheduled processing if external Redis is not available yet
- Keep BullMQ integration optional so the project can upgrade later without rewriting job producers

## Phase 4: Database Foundation

### Prisma Setup

Create initial Prisma project in `prisma/` or colocated with API if preferred, but keep one source of truth.

Database target:

- MySQL 8 on cPanel shared hosting

Initial models to implement first:

- `User`
- `Tenant`
- `Branch`
- `Room`
- `Role`
- `PermissionGrant`
- `EmployeeProfile`
- `CustomerProfile`
- `Service`
- `Product`
- `InventoryItem`
- `Appointment`
- `AttendanceRecord`
- `WorkspacePolicy`
- `BranchPolicy`
- `Subscription`
- `Invoice`
- `Payment`
- `LedgerEntry`
- `Notification`
- `AuditLog`

First migration goals:

- create tenant and branch scoping columns
- create status enums
- create unique constraints
- create foreign keys
- create base indexes for tenant and branch access patterns
- keep index sizes and string column lengths MySQL-safe

### Seed Data

Create a minimal seed flow for local development:

- one superadmin account
- one demo tenant
- one demo owner
- one demo manager
- one demo receptionist
- one demo employee
- one demo customer
- one demo branch
- sample rooms
- sample services
- sample products
- one starter subscription plan

## Phase 5: Auth And Tenant Context

Build this before feature modules become deep.

Initial auth implementation:

- register
- login
- refresh token
- logout
- password hashing
- session invalidation

Initial tenant context implementation:

- tenant membership lookup
- active workspace selection
- active branch selection
- role resolution
- branch-scoped permission resolution

Critical rule:

- Every protected endpoint must resolve tenant context server-side before business logic runs

## Phase 6: First End-To-End Functional Slice

Build one thin but complete slice before parallel feature expansion.

Recommended first slice:

1. Superadmin creates or reviews tenant
2. Owner registers workspace
3. Owner creates branch and rooms
4. Owner creates service
5. Receptionist creates customer
6. Receptionist books appointment
7. Employee checks in on approved network
8. Customer sees booking
9. Audit logs record sensitive actions

Why this slice first:

- Exercises auth, tenant scoping, branch scoping, bookings, attendance, and notifications together
- Forces shared data contracts early
- Exposes architectural gaps before too many modules exist

## Phase 7: Shared Interface Contracts

Lock these interfaces early:

- auth session payload
- tenant context payload
- branch selection payload
- paginated list response
- error response format
- audit event shape
- notification event shape
- offline sync action envelope

Recommended response conventions:

- consistent status code semantics
- typed error codes
- cursor pagination for large collections
- explicit `tenantId` and `branchId` only where appropriate in responses

## Phase 8: Offline Foundations

Do not wait too late to establish this.

Initial local persistence setup in Expo apps:

- SQLite tables for queued actions
- SQLite tables for cached bookings
- SQLite tables for cached customer summaries
- sync metadata table

Initial offline action types:

- attendance check-in
- attendance check-out
- customer check-in
- appointment draft create

Sync constraints:

- each queued action gets a stable client-generated id
- server processing must be idempotent
- sync conflicts create reviewable records instead of silent overwrites

## Phase 9: Module Build Order

Recommended feature build sequence:

1. Auth and session management
2. Tenant onboarding
3. Branches and rooms
4. Roles and employee invitations
5. Services and products
6. Customers
7. Appointments
8. Attendance
9. Policies
10. Notifications
11. Billing
12. Reports

Reasoning:

- Each step depends naturally on the previous domain layer
- This order keeps core operational workflows usable early

## Initial Folder-Level Ownership

When implementation starts, use these ownership boundaries:

- `apps/public-web`: marketing and acquisition only
- `apps/superadmin-web`: platform operations only
- `apps/tenant-app`: tenant staff workflows only
- `apps/customer-app`: customer-facing workflows only
- `packages/*`: shared contracts and presentation primitives only
- `services/api`: source of truth for business rules
- `services/jobs`: async execution only, no direct UI concerns

## Required Conventions Before Coding Features

- Define naming conventions for route groups and modules
- Define status enums centrally
- Define audit action keys centrally
- Define permission keys centrally
- Define feature entitlement keys centrally
- Define environment variable naming conventions

## Implementation Readiness Checklist

Before feature coding begins, confirm:

- Monorepo boots successfully
- All apps start in development mode
- Shared packages build cleanly
- API starts with database connection
- Worker service starts with configured queue backend
- Initial migration runs successfully
- Seed command creates demo data
- Auth flow works end to end
- Tenant context selection works end to end

## Recommended First Commands Once We Exit Planning

1. Initialize `pnpm` monorepo and root config
2. Scaffold Next.js apps for `public-web` and `superadmin-web`
3. Scaffold Expo apps for `tenant-app` and `customer-app`
4. Scaffold NestJS API and worker services
5. Add shared packages
6. Add Prisma schema and first migration
7. Wire auth and tenant context

Deployment readiness note:

- Confirm cPanel MySQL remote access, user privileges, and connection limits before finalizing production deployment wiring
- Keep upload storage paths configurable so cPanel-hosted files can later move to object storage without codebase-wide changes

## Recommended Next Artifact

Create `INITIAL_SCHEMA_PLAN.md` next to define:

- first Prisma models and enums
- migration grouping
- indexes and constraints
- seed dependencies
