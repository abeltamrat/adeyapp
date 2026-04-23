# Phase 1 Status

## Summary

Phase 1 is **complete for the defined operational MVP scope**.

The project now has a working operational core on the `Expo + PHP + MySQL + cPanel-safe` path, and the remaining gaps are mainly phase 2 polish or expansion areas rather than phase 1 blockers.

Current status:

- `Core tenant operations`: working
- `Production deployment path`: aligned to shared hosting constraints
- `Superadmin, billing, and notifications`: operational
- `Phase 1 overall`: complete for the agreed MVP definition

## Status Legend

- `Done`: implemented and reasonably verified in the current repo
- `Partial`: scaffolded, schema-ready, or only partly implemented
- `Missing`: not implemented yet in a usable phase 1 form

## Phase 1 Status By Area

### 1. Platform Foundation

Status: `Partial`

Done:

- Monorepo structure exists
- Shared packages exist for `types`, `api-client`, `auth`, `ui`, and `config`
- PHP backend exists under `backend/`
- Prisma schema and migrations exist for core entities
- Tenant-aware auth/session flow exists
- Core audit logging exists for major operational actions

Missing or partial:

- Shared-hosting-safe background job strategy is not fully implemented
- The offline queue now persists durably on native with file-backed storage, but reconnect-driven background sync can still be expanded later

### 2. Public Web

Status: `Partial`

Done:

- Public marketing routes exist:
  - `/`
  - `/features`
  - `/pricing`
  - `/help`
  - `/contact`
  - `/login`
  - `/signup`

Partial:

- These pages are present, but still mostly starter marketing content rather than a fully finished launch-ready experience
- Demo request flow is not fully implemented

### 3. Superadmin

Status: `Done`

What exists:

- Superadmin login flow using platform users
- Dashboard summary
- Tenant list
- Tenant detail
- Suspend, reactivate, grace-period, and archive tenant actions
- Subscription status visibility
- Latest invoice and latest payment visibility
- Maintenance announcement delivery
- Trial-ending reminder trigger
- Audit review UI and API
- Support ticket queue and status handling
- Tenant usage reporting
- Module entitlement controls

### 4. Tenant Onboarding

Status: `Partial`

Done:

- Account registration
- Login
- Workspace creation
- First branch creation
- Room setup
- Service setup
- Product setup
- Staff invitation/creation
- Approved attendance network setup during onboarding
- Basic workspace policy defaults

Missing or partial:

- Initial plan selection is not implemented as a real billing step
- Owner profile setup is not separated as a proper onboarding step

### 5. Tenant Roles

Status: `Done`

Done:

- Owner role
- Manager role
- Receptionist role
- Employee role
- Customer role exists in schema and architecture direction

Notes:

- Operational role enforcement is working on the tenant side for owner, manager, receptionist, and employee
- Customer role is not fully realized in the customer app yet

### 6. Branch And Operations Management

Status: `Partial`

Done:

- Branch retrieval and branch-scoped operations
- Room management
- Service setup
- Product catalog by branch
- Basic inventory tracking
- Customer management
- Appointment creation
- Appointment status updates
- Walk-in/front-desk-style flow
- Customer check-in and check-out flow via appointment status progression
- Employee assignment to appointments
- Room overlap protection
- Employee overlap protection

Missing or partial:

- Full appointment calendar experience
- Appointment reschedule flow
- Appointment cancel flow as a first-class UX
- POS flow

### 7. Workforce Operations

Status: `Partial`

Done:

- Employee invitation/creation
- Branch assignment
- Basic shift templates and assignments
- Attendance check-in and check-out
- Approved network validation
- Lateness tracking
- Assigned service start and completion
- Attendance visibility for employees
- Attendance review and correction for owner and manager
- Staff suspension/reactivation

Missing or partial:

- Payroll visibility is only attendance-summary oriented, not a proper employee payroll screen/record
- GPS validation is not implemented
- Shift planning is functional but still basic

### 8. Customer Experience

Status: `Done`

What exists:

- Public workspace browsing
- Customer service catalog browsing by branch
- Public booking creation
- Customer booking lookup by phone or email
- Customer app screens for home, booking, and appointment lookup
- Customer registration and login
- Customer profile management
- Authenticated booking history
- Customer booking notifications

### 9. Policy Engine

Status: `Done`

Done:

- Workspace policy storage exists
- Owner policy screen exists
- Manager attendance correction permission toggle exists
- Manager staff suspension permission toggle exists
- Policy enforcement is working for those manager permissions
- Booking cancellation window enforcement exists
- Booking lead time enforcement exists
- Workspace cleanup buffer policy exists
- Branch-level override flow exists for booking windows and cleanup buffer
- Basic employee credit eligibility toggle
- Sensitive action audit trigger configurability
- Policy acknowledgement flow

### 10. Billing And Finance

Status: `Done`

What exists:

- `Subscription`, `Invoice`, `Payment`, and ledger-related schema pieces exist
- Trial subscription seed logic exists during workspace creation
- Superadmin plan/subscription update flow
- Superadmin invoice creation flow
- Superadmin payment recording flow
- Ledger entries for invoice creation and successful payment recording
- Owner billing overview for current plan, latest invoice/payment, and recent billing history
- Owner payroll-attendance summary exists as an operational report

Notes:

- Billing automation depth is still expandable, but the phase 1 billing basics are now working end to end.

### 11. Notifications

Status: `Done`

What exists:

- In-app notification center
- Real notification creation for booking, billing, employee, and maintenance events
- Email notification outbox logging for key phase 1 events
- Maintenance notice delivery
- Trial-ending reminder delivery

Notes:

- Customer-specific notification preferences and richer campaign messaging can be added later, but critical operational notifications are working.

### 12. Reports

Status: `Partial`

Done:

- Attendance review
- Payroll-attendance summaries
- Payroll snapshot records
- Tenant usage summary for superadmin

Missing or partial:

- Revenue summary by branch
- Appointment volume summary
- Basic inventory summary

## Acceptance Criteria Check

### A new tenant can sign up, create a workspace, create a branch, configure rooms, services, and products, invite staff, and begin operations

Status: `Done`

- Sign up, workspace, branch, rooms, services, products, and staff: done

### Superadmin can view and manage tenants and their subscription status

Status: `Done`

### Receptionist can create and manage bookings and check customers in

Status: `Done`

### Employees can check in and out using approved network validation and see their basic work records

Status: `Done`

### Customers can browse services and book appointments

Status: `Done`

### Core tenant isolation, audit logging, and policy enforcement are working

Status: `Done`

- Tenant isolation and audit logging: working
- Policy enforcement: working across booking rules, operational permissions, sensitive audit triggers, and staff acknowledgement

### Billing basics for subscriptions, invoices, payments, and plan changes are working

Status: `Done`

## Practical Conclusion

Phase 1 is currently best described as:

- `Tenant operations MVP`: complete
- `Phase 1 complete product`: complete for the agreed MVP acceptance criteria
- `Next work`: post-phase polish, richer operations depth, and broader marketing/reporting refinement

## Recommended Finish Order

### 1. Offline Hardening

- Add persistent native storage for queued Expo actions
- Auto-sync queued writes on reconnect or network recovery
- Expand offline-safe write coverage beyond the current minimum

### 2. Superadmin And Reporting Polish

- Implemented

### 3. Customer Account Polish

- Implemented

## Recommended Definition Of "Phase 1 Complete"

We should mark phase 1 complete only when all of the following are true:

- Owner can configure rooms, services, products, and staff
- Reception can manage customers and bookings
- Employees can attend and perform assigned services
- Customers can self-book
- Superadmin can manage tenants and plans
- Subscription billing basics work
- Notifications work for critical events
- Minimum offline queue support works for selected operational flows with durable native persistence

## Suggested Next Implementation Order

1. Public web polish and demo/contact flow completion
2. Calendar, reschedule, cancellation UX, and POS depth
3. GPS attendance validation and richer payroll records
4. Expanded reporting and analytics
