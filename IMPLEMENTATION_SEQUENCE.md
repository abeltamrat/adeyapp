# Implementation Sequence

## Summary

This document defines the recommended build order for the first implementation of the multi-tenant spa management platform.

It translates the planning set into:

- coding milestones
- weekly sequencing
- integration checkpoints
- dependency-aware delivery order

Guiding goal:

- deliver one stable end-to-end operational slice early, then expand outward without reworking the foundation

## Delivery Strategy

Use a vertical-slice approach on top of stable platform foundations.

Meaning:

- build shared infrastructure first
- then complete one thin but real workflow end to end
- only after that, expand modules in dependency order

This reduces the risk of:

- disconnected frontend shells
- backend modules with no real consumers
- schema decisions that are never exercised
- offline and billing concerns being postponed until they are expensive to fix

## Milestone Overview

### Milestone 0: Repository Foundation

Outcome:

- monorepo boots
- all apps compile
- API and worker services start
- Prisma is wired to MySQL

Includes:

- root workspace setup
- shared config package
- app scaffolds
- API scaffold
- worker scaffold
- Prisma scaffold
- base environment management

Exit criteria:

- `pnpm install` works
- all package builds succeed
- each app starts in development mode
- API connects to MySQL
- seed command can run

### Milestone 1: Identity, Auth, And Tenant Context

Outcome:

- users can register and log in
- tenant context resolves correctly
- branch context can be selected
- protected routes enforce auth and scope

Includes:

- user model
- tenant model
- branch model
- auth endpoints
- refresh token flow
- session invalidation
- tenant membership resolution
- branch selection flow
- role-aware route guards

Exit criteria:

- owner can sign up and create a workspace
- tenant app can store and restore session
- superadmin can log in to protected dashboard
- protected APIs reject invalid tenant and branch context

### Milestone 2: Tenant Onboarding And Setup

Outcome:

- a tenant can fully onboard to an operational baseline

Includes:

- workspace creation
- first branch creation
- room setup
- service setup
- product setup
- owner profile setup
- basic policy defaults
- approved attendance network setup

Exit criteria:

- new tenant can complete onboarding without manual database work
- tenant has at least one branch, one room, one service, and one product
- onboarding writes audit events for sensitive setup actions

### Milestone 3: People, Roles, And Customers

Outcome:

- staff and customers can exist in the platform with correct scope and permissions

Includes:

- tenant roles
- staff invitation
- employee profiles
- branch assignment
- receptionist and manager access shell
- customer profiles

Exit criteria:

- owner can invite staff
- staff can log in and see role-appropriate shells
- receptionist can create or search customers
- employee access respects branch scope and status

### Milestone 4: Booking And Reception Operations

Outcome:

- core spa operations are usable

Includes:

- appointment calendar
- appointment create
- appointment update
- appointment cancel and reschedule
- walk-in registration
- customer check-in and check-out
- room and employee availability validation

Exit criteria:

- receptionist can create a booking
- owner or manager can view the booking calendar
- customer can see upcoming bookings
- overlap validation prevents double-booking of staff or room

### Milestone 5: Attendance And Employee Flow

Outcome:

- employee operations become usable and enforce branch presence rules

Includes:

- attendance check-in
- attendance check-out
- approved network validation
- lateness tracking
- employee dashboard
- assigned service start and stop

Exit criteria:

- employee can check in only on approved branch network
- late arrivals are flagged correctly
- manager and owner can review attendance history
- attendance records feed audit trail where exceptions occur

### Milestone 6: Policy Engine, Audit, And Notifications

Outcome:

- business rules become configurable and traceable

Includes:

- workspace policies
- branch policy overrides
- booking lead time rules
- cancellation window rules
- cleanup buffer rules
- sensitive-action audit triggers
- in-app notifications
- email notifications

Exit criteria:

- policy changes affect protected operations without code changes
- audit entries exist for policy changes and sensitive actions
- appointment and billing-related notifications send successfully

### Milestone 7: Subscription Billing Basics

Outcome:

- SaaS operations are viable

Includes:

- plans
- subscriptions
- invoices
- payments
- upgrades and downgrades
- grace period handling
- ledger entries for phase 1 billing events

Exit criteria:

- superadmin can assign a plan
- tenant billing status is visible
- payment updates invoice and subscription state correctly
- billing events create auditable financial records

### Milestone 8: Offline Core And Stabilization

Outcome:

- critical branch workflows survive intermittent connectivity

Includes:

- offline queue storage
- sync batch API
- replay logic
- conflict handling for queued actions
- stabilization fixes
- QA pass across all first-release flows

Exit criteria:

- attendance queue works offline and syncs safely
- selected reception workflows can recover after reconnection
- sync failures are reviewable and do not silently corrupt state

## Weekly Sequence

## Week 1

Focus:

- repository and infrastructure foundations

Tasks:

- set up monorepo
- create app and service shells
- add shared packages
- initialize Prisma
- connect API to MySQL
- create first migration batch
- add seed flow

Checkpoint:

- all apps boot
- API serves health check
- demo seed exists

## Week 2

Focus:

- auth and tenant context

Tasks:

- implement auth endpoints
- implement login and registration UI
- add session handling
- add tenant selection
- add branch selection
- enforce guarded routes

Checkpoint:

- owner registration and login works end to end
- superadmin login works

## Week 3

Focus:

- onboarding and setup

Tasks:

- workspace creation flow
- branch setup
- room setup
- service setup
- product setup
- policy defaults setup
- approved network setup

Checkpoint:

- a tenant can create an operational workspace from UI only

## Week 4

Focus:

- roles, staff, and customers

Tasks:

- staff invite flow
- employee profile creation
- role-aware app shells
- customer creation and search

Checkpoint:

- invited staff can log in and land in the right route group

## Week 5

Focus:

- bookings and reception operations

Tasks:

- appointment CRUD
- calendar screens
- walk-in flow
- customer check-in and check-out
- room and staff conflict checks

Checkpoint:

- receptionist can run a basic booking workflow

## Week 6

Focus:

- attendance and employee flows

Tasks:

- approved network attendance
- lateness logic
- employee dashboard
- service start and stop

Checkpoint:

- employee attendance works on real devices against configured branch rules

## Week 7

Focus:

- policy engine, audit, and notifications

Tasks:

- policy CRUD
- policy resolution logic
- audit action registry
- notification service
- appointment and billing notification triggers

Checkpoint:

- changing a policy changes runtime behavior safely

## Week 8

Focus:

- billing basics

Tasks:

- plans and subscriptions
- invoice generation
- payment recording
- upgrade and downgrade flow
- ledger posting for billing events

Checkpoint:

- superadmin can manage billing lifecycle for a tenant

## Week 9

Focus:

- offline queue and stabilization

Tasks:

- SQLite queue
- sync APIs
- replay logic
- conflict logging
- end-to-end QA

Checkpoint:

- selected offline flows work in test scenarios

## First Coding Slice

Build this slice before broadening feature work:

1. owner registration
2. workspace creation
3. branch creation
4. room creation
5. service creation
6. receptionist customer creation
7. receptionist appointment creation
8. employee attendance check-in
9. customer booking visibility
10. superadmin tenant visibility

Why this slice:

- touches every major foundation once
- exposes scoping bugs early
- proves the product is not just isolated modules

## Cross-App Integration Checkpoints

### Checkpoint A: Auth

Apps involved:

- tenant-app
- customer-app
- superadmin-web
- services/api

Verify:

- token issuance
- refresh flow
- logout
- access revocation

### Checkpoint B: Tenant Context

Apps involved:

- tenant-app
- services/api

Verify:

- workspace selection
- branch selection
- role-aware navigation
- branch-scoped data queries

### Checkpoint C: Booking Operations

Apps involved:

- tenant-app
- customer-app
- services/api

Verify:

- customer creation
- booking creation
- booking visibility by role
- room and staff conflict handling

### Checkpoint D: Attendance

Apps involved:

- tenant-app
- services/api

Verify:

- approved network check-in
- exception handling
- attendance history

### Checkpoint E: Billing

Apps involved:

- superadmin-web
- services/api

Verify:

- plan assignment
- invoice generation
- payment recording
- subscription state changes

## Backend Module Build Order

Recommended order inside `services/api`:

1. `health`
2. `identity`
3. `auth`
4. `tenant-management`
5. `branch-management`
6. `rbac`
7. `customers-crm`
8. `services-catalog`
9. `appointments`
10. `attendance`
11. `policy-management`
12. `notifications`
13. `billing`
14. `audit-log`

Reasoning:

- every later module depends on identity, scope, and tenant context
- bookings depend on customers and services
- attendance depends on staff and branch rules
- billing depends on tenant lifecycle already being stable

## Frontend Build Order

### Web Apps

1. public-web marketing shell
2. superadmin auth shell
3. superadmin tenant list and detail
4. superadmin billing overview

### Tenant App

1. auth flow
2. workspace and branch selection
3. owner shell
4. receptionist shell
5. employee shell
6. manager shell
7. notifications and profile

### Customer App

1. auth flow
2. branch and service browse
3. booking flow
4. appointments and history

## High-Risk Areas To Validate Early

- MySQL connection limits from shared hosting
- remote DB latency between API host and cPanel MySQL
- approved network validation behavior on target devices
- time zone handling across tenant and branch operations
- offline queue conflict resolution
- billing webhook reliability

## Definition Of “Ready To Scaffold”

The project is ready to leave planning and begin implementation when:

- monorepo structure is accepted
- tech stack decisions are accepted
- MySQL and cPanel hosting constraints are accepted
- phase 1 scope is accepted
- schema batch order is accepted
- first coding slice is accepted

## Recommended Next Artifact

Create `ENVIRONMENT_SETUP_CHECKLIST.md` next to capture:

- local development prerequisites
- cPanel MySQL connection requirements
- environment variables
- provider credentials needed before coding
