# Implementation Blueprint

## Summary

This document translates the product strategy into a build-ready technical blueprint for a greenfield multi-tenant spa management platform.

Recommended delivery shape:

- `apps/public-web`: optional static marketing export for pricing, help, and sign-up entry
- `apps/superadmin-web`: optional browser-first admin surface only if deployable as static pages plus PHP APIs
- `apps/tenant-app`: Expo app for Owner, Manager, Receptionist, Employee
- `apps/customer-app`: Expo app or shared mobile-first surface for customer booking and history
- `packages/ui`: shared design system
- `packages/types`: shared domain types and contracts
- `packages/api-client`: shared API client and auth helpers
- `packages/config`: lint, tsconfig, env, and shared constants
- `backend/`: cPanel-safe PHP API
- `services/`: local-only tooling or non-deployable experiments, not part of the shared-hosting runtime

Primary implementation goals:

- Strong tenant isolation
- Role-based and branch-scoped permissions
- Offline-safe branch operations
- Configurable policy engine instead of hard-coded operational rules
- Ledger-safe financial flows for subscriptions, payouts, payroll, and credits

## Repository Structure

```text
adeyapp/
  apps/
    public-web/
    superadmin-web/
    tenant-app/
    customer-app/
  packages/
    ui/
    types/
    api-client/
    config/
    auth/
  services/
    api/
    jobs/
  docs/
    SPA_MULTI_TENANT_PLAN.md
    IMPLEMENTATION_BLUEPRINT.md
    MVP_SCOPE.md
```

Recommended standards:

- Monorepo with shared packages and separate deployable apps
- Type-safe shared contracts between frontend and backend
- Centralized auth and permission rules
- Domain modules organized by bounded context, not by page or controller
- Shared-hosting deployment must assume `PHP + MySQL + file uploads`, not a Node server

## Application Split

### 1. Public Web

Purpose:

- SEO-focused public marketing and acquisition surface

Hosting note:

- Must be deployable either as a static export or as simple cPanel-hosted pages

Primary features:

- Landing page
- Features by persona
- Pricing and plan comparison
- FAQ and help center
- Contact and demo request
- Login and sign-up entry points

### 2. Superadmin Web

Purpose:

- Platform control center for SaaS operations

Hosting note:

- If shared hosting remains the only runtime, prefer an Expo web export or static admin shell backed by PHP APIs instead of a Node-rendered dashboard

Primary features:

- Tenant lifecycle management
- Plan and pricing management
- Billing review, invoices, payment issues, and payouts
- Feature gating and quota management
- Tenant health scorecards
- Maintenance announcements
- Support tools, impersonation, audit review
- Platform analytics and risk monitoring

### 3. Tenant App

Purpose:

- Daily operating system for spa staff and owners

Primary role groups:

- Owner
- Manager
- Receptionist
- Employee

Shared capabilities:

- Auth, workspace switch, branch context, notifications, offline sync

### 4. Customer App

Purpose:

- Booking and customer relationship surface

Primary features:

- Service browsing
- Appointment booking
- Appointment history
- Messages and notifications
- Memberships, packages, and profile

## Backend Domain Modules

Recommended service modules:

- `identity`
- `auth`
- `tenant-management`
- `branch-management`
- `rbac`
- `policy-management`
- `document-repository`
- `appointments`
- `waitlist`
- `services-catalog`
- `products-catalog`
- `inventory`
- `procurement`
- `equipment-maintenance`
- `customers-crm`
- `shift-scheduling`
- `attendance`
- `leave-management`
- `discipline`
- `payroll`
- `employee-credit`
- `billing`
- `ledger`
- `payouts`
- `notifications`
- `reporting`
- `support`
- `audit-log`
- `offline-sync`

Module rules:

- Each module owns its write logic and invariants
- Cross-module effects should use events or well-defined service boundaries
- Money movement should always create ledger entries
- Sensitive state changes should always create audit entries
- Implementation on shared hosting should favor request-driven jobs and cron-friendly workflows over always-on workers

## Role And Access Model

### Global Roles

- `superadmin`
- `superadmin_support`
- `superadmin_finance`

### Tenant Roles

- `owner`
- `manager`
- `receptionist`
- `employee`
- `customer`

Access principles:

- Permissions are role-based first
- Tenant roles are always tenant-scoped
- Operational access is branch-scoped where applicable
- Owners can narrow permissions further with custom grants
- Suspended or terminated employees lose access immediately

## Route Map

### Public Web Routes

- `/`
- `/features`
- `/pricing`
- `/help`
- `/faq`
- `/contact`
- `/demo`
- `/login`
- `/signup`

### Superadmin Web Routes

- `/dashboard`
- `/tenants`
- `/tenants/:tenantId`
- `/tenants/:tenantId/billing`
- `/tenants/:tenantId/modules`
- `/tenants/:tenantId/usage`
- `/plans`
- `/promotions`
- `/payouts`
- `/maintenance`
- `/support`
- `/audit`
- `/settings`

### Tenant App Routes

Common:

- `/login`
- `/select-workspace`
- `/select-branch`
- `/notifications`
- `/profile`

Owner:

- `/owner/dashboard`
- `/owner/branches`
- `/owner/rooms`
- `/owner/services`
- `/owner/products`
- `/owner/inventory`
- `/owner/employees`
- `/owner/roles`
- `/owner/shifts`
- `/owner/leave`
- `/owner/payroll`
- `/owner/credit`
- `/owner/customers`
- `/owner/bookings`
- `/owner/reports`
- `/owner/billing`
- `/owner/policies`
- `/owner/documents`
- `/owner/discipline`

Manager:

- `/manager/dashboard`
- `/manager/bookings`
- `/manager/rooms`
- `/manager/inventory`
- `/manager/employees`
- `/manager/shifts`
- `/manager/leave`
- `/manager/discipline`
- `/manager/reports`

Receptionist:

- `/reception/dashboard`
- `/reception/bookings`
- `/reception/check-in`
- `/reception/calendar`
- `/reception/customers`
- `/reception/pos`
- `/reception/waitlist`

Employee:

- `/employee/dashboard`
- `/employee/attendance`
- `/employee/shifts`
- `/employee/services`
- `/employee/payroll`
- `/employee/credit`
- `/employee/policies`
- `/employee/profile`

### Customer App Routes

- `/customer/home`
- `/customer/branches`
- `/customer/services`
- `/customer/book`
- `/customer/appointments`
- `/customer/history`
- `/customer/packages`
- `/customer/messages`
- `/customer/profile`

## MVP Screen Inventory

### Must Build In V1

- Public landing page
- Pricing page
- Sign-up and login
- Tenant onboarding flow
- Branch and room setup
- Role invitation and staff assignment
- Service and product setup
- Booking calendar and appointment create/edit
- Reception walk-in and customer check-in
- Employee attendance check-in and check-out
- Basic shift assignment
- Owner and manager dashboards
- Customer booking and history
- Superadmin tenant list and tenant detail
- Superadmin plan assignment and billing overview
- Policy settings for core booking and attendance rules
- Basic audit log viewer

### Later But Designed For Now

- Visual room map
- AI booking assistant
- Deep marketing automation
- Full payroll engine
- Advanced payout orchestration
- Whitelabel custom domains

## Core Domain Entities

### Identity And Tenant

- `User`
- `AuthSession`
- `Tenant`
- `Branch`
- `Room`
- `Role`
- `PermissionGrant`
- `EmployeeProfile`
- `CustomerProfile`

### Operations

- `Service`
- `ServiceCategory`
- `Product`
- `InventoryItem`
- `InventoryMovement`
- `ConsumableRule`
- `Supplier`
- `PurchaseOrder`
- `EquipmentAsset`
- `MaintenanceLog`
- `Appointment`
- `AppointmentLine`
- `WaitlistEntry`

### Workforce

- `ShiftTemplate`
- `ShiftAssignment`
- `Roster`
- `AttendanceRecord`
- `AvailabilityBlock`
- `LeaveType`
- `LeaveBalance`
- `LeaveRequest`
- `SkillTag`
- `EmployeeSkill`
- `CommissionRule`
- `InfractionRecord`
- `PenaltyRule`
- `StrikeRecord`
- `SuspensionRecord`
- `TerminationRecord`
- `AssetRecoveryItem`

### Policy And Documents

- `WorkspacePolicy`
- `BranchPolicy`
- `PolicyDocument`
- `PolicyVersion`
- `PolicyAcknowledgement`
- `FeatureEntitlement`
- `QuotaUsage`
- `ThemeProfile`

### Finance

- `Subscription`
- `Plan`
- `PlanModule`
- `Invoice`
- `Payment`
- `Refund`
- `LedgerAccount`
- `LedgerEntry`
- `Payout`
- `PayrollRecord`
- `CreditRequest`
- `CreditLedger`

### Platform

- `Notification`
- `NotificationDelivery`
- `SupportTicket`
- `AuditLog`
- `SyncBatch`
- `SyncConflict`
- `PromoCampaign`
- `Referral`

## Data And Isolation Rules

- Every tenant-owned record must carry `tenantId`
- Branch-scoped records must also carry `branchId`
- Superadmin-only records must never be mixed with tenant records without explicit scope
- Cross-tenant queries must be restricted to superadmin contexts
- Audit and ledger records must be append-only
- Policy evaluation should resolve from workspace defaults to branch overrides

Recommended access resolution order:

1. Authenticated user
2. Active tenant
3. Active branch or allowed branches
4. Role grants
5. Feature entitlements
6. Policy constraints

## Auth And Onboarding Flow

### Auth

- Email and password initially
- Optional phone OTP later
- Tenant-aware session claims
- Branch context selection after login if multiple branches are allowed

### Tenant Onboarding

1. Create account
2. Create workspace
3. Choose plan
4. Create first branch
5. Create rooms
6. Set services and products
7. Invite first employees
8. Configure policy defaults
9. Configure approved attendance networks
10. Go live

### Employee Access State

Supported statuses:

- `invited`
- `active`
- `suspended_paid`
- `suspended_unpaid`
- `terminated`

Effects:

- Only `active` users can access normal tenant routes
- Suspended and terminated states revoke token refresh and app actions immediately
- Termination launches final settlement and asset recovery workflow

## Booking And Scheduling Rules

- A booking requires branch, room, service, staff, and time slot validation
- Service eligibility must respect employee skill tags
- Room occupancy and staff availability must both pass before confirming a booking
- Cleanup buffers should be policy-driven and branch-aware
- Waitlist promotion should respect booking priority and available staff or room combinations
- Overlapping shifts are allowed, but overbooking is not

## Attendance And Shift Rules

- Shift templates define expected start and end windows
- Shift assignments attach employees to branches and time slots
- Attendance check-in validates assigned shift, approved network, and optional GPS radius
- Late arrival should be calculated against scheduled shift start
- Early checkout, missed check-in, and out-of-branch check-in should generate reviewable exceptions
- Approved attendance feeds payroll and commission calculations

## Policy Engine Rules

Policies should be stored as data and evaluated dynamically.

Initial policy groups:

- Booking cancellation window
- Booking lead time
- Room cleanup buffer
- Employee credit eligibility
- Lateness penalty thresholds
- Strike progression
- Leave accrual rules
- Leave approval thresholds
- Sensitive audit triggers

Policy hierarchy:

1. Platform defaults
2. Workspace policy
3. Branch override

Policy document rules:

- Policy documents support versioning
- Acknowledgement may be required on first login or on version change
- Restricted users cannot continue until required acknowledgements are completed

## Billing, Ledger, And Payout Design

### SaaS Billing

- Plans define included limits and enabled modules
- Add-ons extend quotas or unlock modules
- Upgrades and downgrades should support proration
- Failed payment should move tenant through retry and grace states before suspension

### Ledger

- Every financial event must create balanced double-entry records
- Billing, payroll, credit, refunds, and payouts must post through the ledger
- Manual adjustments require elevated permissions and audit entries

### Payouts

- If the platform collects tenant payments, payout logic should split fees from tenant earnings
- Payout status should support pending, held, paid, failed, and reversed
- Settlement reports must reconcile payments, refunds, fees, and payouts

## Offline Sync Design

Initial offline-required workflows:

- Reception check-in
- Appointment lookup
- Appointment create queue
- Attendance check-in and check-out
- Basic customer lookup

Sync rules:

- Client writes should be stored as local actions with timestamps and device identity
- Server reconciliation should be idempotent
- Conflicts should create review records when auto-merge is unsafe
- Financial actions should be more restrictive than operational actions

## Notifications And Messaging

Channels:

- In-app
- Push
- Email
- SMS

Initial event triggers:

- Appointment created, changed, canceled
- Attendance exception
- Leave request approved or rejected
- Credit request approved or rejected
- Payment failed
- Trial ending
- Tenant maintenance announcement

## Reporting And Analytics

### V1 Reports

- Revenue by branch
- Booking volume by day and service
- Staff utilization
- Attendance and lateness
- Basic payroll totals
- Inventory movement summary
- Tenant usage summary for superadmin

### Designed For Phase 2

- Churn prediction
- Rebooking and upsell benchmarking
- Promotion effectiveness
- Equipment utilization
- Forecasting and AI scheduling suggestions

## API And Integration Conventions

Recommended API rules:

- Versioned API namespace
- Tenant context resolved server-side, not trusted from client alone
- Idempotency keys for critical writes
- Cursor pagination for large lists
- Webhook-ready billing and payment ingestion
- Primary deploy target is the PHP API under `backend/public`, designed for cPanel routing and `.htaccess`

Initial integration surfaces:

- Payment gateway
- SMS provider
- Email provider
- Push notification provider
- File storage provider

## Delivery Phases

### Phase 1

- Monorepo setup
- Shared packages
- PHP API foundation for auth, onboarding, bookings, attendance, and billing basics
- Public web only if it can be statically exported
- Superadmin shell only if it can be statically exported or kept lightweight in Expo web
- Tenant app shell
- Auth and onboarding
- Branches, rooms, roles
- Services, products, appointments
- Attendance
- Basic policies
- Basic billing
- Core audit log

### Phase 2

- Shift templates and roster planner
- Leave management
- Discipline and suspension workflows
- Credit and payroll expansion
- Inventory procurement
- Waitlist
- Richer reports

### Phase 3

- Whitelabel features
- Payout settlement
- AI booking assistant
- Visual room mapping
- Advanced marketing automation

## Acceptance Criteria For Blueprint Sign-Off

- App boundaries are clear and non-overlapping
- MVP routes and screens are locked
- Backend modules are separated by responsibility
- Tenant and branch isolation rules are explicit
- Policy hierarchy is defined
- Financial integrity model is defined
- Offline workflows are identified before implementation starts

## Recommended Next Artifact

Create `MVP_SCOPE.md` next to freeze:

- exact v1 features
- non-goals
- dependencies between modules
- implementation order
