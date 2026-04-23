# MVP Scope

## Summary

This document defines the exact phase 1 scope for the multi-tenant spa management platform. Its purpose is to keep the first implementation narrow, usable, and technically sound while preserving clear extension paths for later phases.

Phase 1 goals:

- Launch a usable multi-tenant foundation
- Support core spa operations for owners, managers, receptionists, employees, and customers
- Support superadmin tenant onboarding and SaaS billing basics
- Establish secure tenant isolation, RBAC, policy enforcement, auditability, and core offline-safe flows

## Phase 1 In Scope

### 1. Platform Foundation

- Monorepo structure with separate apps and shared packages
- Shared auth, API client, types, and UI package foundations
- Backend API with tenant-aware authorization
- Background jobs for notifications, billing tasks, and reporting jobs
- Core audit logging
- Core offline sync support for selected operational flows

### 2. Public Web

- Landing page
- Features overview
- Pricing page
- FAQ and help page
- Contact and demo request entry
- Login and sign-up entry points

### 3. Superadmin

- Superadmin authentication
- Tenant list and tenant detail
- Create, suspend, reactivate, and review tenants
- Plan assignment and billing overview
- Basic module entitlement controls
- Basic usage overview
- Platform notifications and maintenance announcements
- Basic support and audit visibility

### 4. Tenant Onboarding

- Account registration
- Workspace creation
- Initial plan selection
- First branch creation
- Room setup
- Service setup
- Product setup
- Owner profile setup
- Staff invitation
- Basic policy defaults setup
- Approved attendance network setup

### 5. Tenant Roles

- Owner role
- Manager role
- Receptionist role
- Employee role
- Customer role

Phase 1 role model:

- Role-based permissions with branch scoping where applicable
- Owners can manage branch access and staff assignment
- Fine-grained custom permission editing is limited to core operational controls in phase 1

### 6. Branch And Operations Management

- Branch management
- Room management
- Service catalog by branch
- Product catalog by branch
- Basic inventory tracking
- Customer management
- Appointment calendar
- Appointment create, update, cancel, and reschedule
- Walk-in handling
- Customer check-in and check-out
- Waitlist is out of scope for phase 1

### 7. Workforce Operations

- Employee invitation and activation
- Branch assignment
- Basic shift assignment
- Attendance check-in and check-out
- Approved network validation
- Optional GPS validation design-ready but not required in first release
- Lateness tracking
- Assigned service start and stop
- Attendance and payroll visibility for employees

### 8. Customer Experience

- Customer registration and login
- Browse services by branch
- Book appointments
- View upcoming bookings
- View booking history
- Manage profile
- Receive booking notifications

### 9. Policy Engine

Phase 1 policy groups:

- Booking cancellation window
- Booking lead time
- Room cleanup buffer
- Approved network attendance policy
- Basic employee credit eligibility toggle
- Sensitive action audit triggers

Phase 1 policy hierarchy:

- Workspace-level default
- Branch-level override where applicable

### 10. Billing And Finance

- Tenant plans
- Subscription state
- Invoices
- Payments
- Upgrades and downgrades
- Grace period handling
- Basic ledger posting for SaaS billing events

Phase 1 financial requirement:

- All subscription billing actions must create auditable financial records
- Full payout orchestration and advanced accounting are deferred

### 11. Notifications

- In-app notifications
- Email notifications for key events
- Optional SMS integration point reserved but not required in first release

Phase 1 notification events:

- Appointment created
- Appointment changed
- Appointment canceled
- Employee invited
- Leave support is out of scope for phase 1
- Payment failed
- Trial ending
- Maintenance notice

### 12. Reports

- Revenue summary by branch
- Appointment volume summary
- Staff attendance summary
- Basic payroll totals view
- Basic inventory summary
- Tenant usage summary for superadmin

## Phase 1 Explicitly Out Of Scope

### Workforce And HR

- Rotating roster planner
- Drag-and-drop scheduling
- Advanced shift templates
- Leave accrual and approval workflows
- Infraction management
- Strike system
- Suspension workflows
- Termination workflows
- Asset recovery workflows
- Workspace blacklist workflows

### Commercial And Marketing

- Loyalty program
- Membership engine
- Referral and affiliate engine
- Dynamic pricing and happy hours
- Marketing automation campaigns
- Deep CRM segmentation

### Finance

- Full payroll engine
- Commission thresholds and multi-level commission rules
- Employee credit ledger expansion
- Payout and escrow settlement
- Refund orchestration beyond basic records
- Full double-entry accounting across all operational domains

### Operations

- Consumables auto-deduction
- Procurement workflows
- Purchase orders
- Supplier management
- Equipment maintenance scheduling
- Visual room maps
- Queue-first waitlist
- AI booking assistant

### Branding And Platform Expansion

- Whitelabel custom branding
- Custom domains
- Enterprise theme engine
- Advanced feature flag experiments
- Churn prediction and advanced health scoring

## MVP Apps And Screen Targets

### Public Web

- Home
- Features
- Pricing
- Help
- Contact
- Login
- Sign Up

### Superadmin Web

- Dashboard
- Tenants
- Tenant Detail
- Billing Overview
- Plans
- Usage
- Maintenance
- Audit

### Tenant App

Shared:

- Login
- Workspace Select
- Branch Select
- Notifications
- Profile

Owner:

- Dashboard
- Branches
- Rooms
- Services
- Products
- Inventory
- Employees
- Bookings
- Customers
- Billing
- Policies

Manager:

- Dashboard
- Bookings
- Rooms
- Inventory
- Employees

Receptionist:

- Dashboard
- Calendar
- Bookings
- Check-In
- Customers
- POS

Employee:

- Dashboard
- Attendance
- Services
- Payroll
- Profile

### Customer App

- Home
- Branches
- Services
- Booking
- Appointments
- History
- Profile

## Phase 1 Data Model Minimum

Must exist in the first release:

- `User`
- `Tenant`
- `Branch`
- `Room`
- `Role`
- `EmployeeProfile`
- `CustomerProfile`
- `Service`
- `Product`
- `InventoryItem`
- `Appointment`
- `AttendanceRecord`
- `WorkspacePolicy`
- `BranchPolicy`
- `PolicyAcknowledgement`
- `Subscription`
- `Invoice`
- `Payment`
- `LedgerEntry`
- `Notification`
- `AuditLog`

Can be stubbed or designed but not fully implemented:

- `ShiftTemplate`
- `LeaveRequest`
- `CommissionRule`
- `CreditRequest`
- `WaitlistEntry`
- `Referral`
- `Payout`

## Offline Scope For Phase 1

Required offline-safe flows:

- View today’s bookings
- Reception customer lookup
- Customer check-in queue
- Employee attendance check-in and check-out queue

Phase 1 offline rules:

- Writes queue locally and sync when reconnected
- Appointment edits made offline should be limited and conflict-reviewed
- Financial writes should require connectivity
- Audit records should still be created when queued actions sync

## Security And Access Requirements

- All tenant-owned records must include `tenantId`
- Branch-owned records must include `branchId` where relevant
- Server-side authorization must never trust client role claims alone
- Suspended tenants should lose access to tenant operations
- Sensitive actions must produce audit logs
- Approved network attendance must validate against branch-approved identifiers

## Acceptance Criteria

Phase 1 is complete when:

- A new tenant can sign up, create a workspace, create a branch, configure rooms, services, and products, invite staff, and begin operations
- Superadmin can view and manage tenants and their subscription status
- Receptionist can create and manage bookings and check customers in
- Employees can check in and out using approved network validation and see their basic work records
- Customers can browse services and book appointments
- Core tenant isolation, audit logging, and policy enforcement are working
- Billing basics for subscriptions, invoices, payments, and plan changes are working

## Implementation Order

1. Monorepo and shared package setup
2. Auth and tenant-aware session model
3. Public web marketing pages
4. Superadmin shell and tenant management
5. Tenant onboarding flow
6. Branches, rooms, services, and products
7. Roles, employee invites, and branch assignment
8. Customers and appointment calendar
9. Reception and employee operational flows
10. Policies, audit logs, and notifications
11. Billing basics and subscription lifecycle
12. Offline queue support for selected flows

## Dependency Notes

- Billing depends on tenant and plan models
- Attendance depends on branch-approved network configuration
- Bookings depend on branches, rooms, services, staff assignment, and customers
- Policy enforcement depends on tenant and branch context resolution
- Offline sync depends on stable auth, local storage strategy, and server idempotency

## Recommended Next Artifact

Create `DATA_MODEL_DRAFT.md` next with:

- entity relationships
- key fields per model
- tenant and branch scoping rules
- lifecycle states
- audit and ledger event points
