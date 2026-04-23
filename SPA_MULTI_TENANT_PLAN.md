# Multi-Tenant Spa Management System Plan

## Summary

This project will be a multi-tenant spa SaaS platform with:

- A public web experience for marketing, pricing, help, and onboarding
- A superadmin portal for platform-wide operations and billing
- A tenant workspace for spa owners, managers, receptionists, and employees
- A customer-facing experience for booking, history, and communication

Recommended default product shape:

- `Public web`: landing page, pricing tiers, FAQs, support, contact, sign-up, login
- `Superadmin web`: tenant management, billing, modules, platform monitoring, support tools
- `Tenant app`: Expo app with role-based access for Owner, Manager, Receptionist, Employee
- `Customer app/web`: booking, appointments, history, messages, wallet, notifications

Recommended default technical direction:

- Frontend: Expo + Expo Router for mobile/tablet flows
- Separate web surfaces for marketing and superadmin admin-heavy workflows
- API-first backend with multi-tenant RBAC, billing, notifications, queues, and audit logs
- Strong tenant isolation across data, permissions, usage, and reporting

## Core Roles And Capabilities

### 1. Public Visitor

- View product overview and platform benefits
- See pricing tiers and plan comparison
- Read FAQs, help articles, and support options
- Contact sales or support
- Request a demo
- Register or log in

### 2. Superadmin

- Create, suspend, reactivate, archive, and monitor tenant accounts
- Manage pricing tiers, add-ons, trials, discounts, and plan limits
- Handle billing lifecycle: invoices, receipts, renewals, failed payments, grace periods
- Review tenant usage: branches, employees, bookings, storage, messaging usage
- Manage feature modules enabled per tenant
- View platform analytics and tenant health
- Send platform-wide or tenant-specific notifications
- Manage support tickets and internal notes
- Impersonate tenants for support with full audit trail
- Review upgrade and downgrade requests
- Manage fraud/risk flags, alerts, and compliance controls

### 3. Owner

- Register a spa workspace
- Create and manage multiple branches
- Create rooms within branches
- Configure branch-based services and products
- Move employee assignments, services, or products between branches
- Invite employees and assign roles
- Define permissions and branch access
- Manage customers, appointments, pricing, stock, and reports
- Pay bills and manage subscription status
- Request plan upgrades, downgrades, and feature changes
- Send notifications and messages to customers
- Review payroll, attendance, and staff performance
- Configure approved Wi-Fi networks for employee attendance

### 4. Manager

- Manage branch operations within assigned scope
- Manage employees, schedules, and attendance
- Manage services, products, pricing, and inventory
- Oversee bookings, room allocation, and customer handling
- Review branch sales and performance reports
- Approve operational requests delegated by owner

### 5. Receptionist

- Create bookings and manage walk-ins
- Check customers in and out
- Assign rooms and staff based on availability
- Process payments, invoices, receipts, and rebookings
- Register new customers and update customer records
- Send reminders and booking-related messages
- View customer visit history needed for front-desk work

### 6. Employee

- Check in and check out for attendance
- Attendance is allowed only when connected to a manager-approved network
- Start and stop assigned services
- View current balance, commission, payroll, and attendance history
- View assigned tasks and schedule
- Submit credit or salary advance requests
- View credit eligibility, status, outstanding balance, and repayments
- Receive work notifications and service updates

### 7. Customer

- Browse services by branch
- Book appointments if available
- View upcoming and past bookings
- Reschedule or cancel within policy
- View treatment and purchase history
- Receive reminders, promotions, and support messages
- Save preferences and profile details
- Review packages, memberships, or loyalty balance

## Important Features To Include

### Public Web

- Landing page with product overview
- Feature highlights by user type
- Pricing page with clear tier comparison
- FAQ and help center
- Contact and demo request forms
- Self-serve sign-up and login entry points

### Tenant And Operations

- Multi-branch setup and management
- Room management per branch
- Branch-based services, products, inventory, and pricing
- Employee invitation, access control, and branch assignment
- Calendar scheduling with staff and room availability
- Walk-in and appointment flow
- Point of sale for services and products
- Split payments, discounts, refunds, and tips
- Gift cards, packages, and memberships
- Customer records with notes, preferences, and history
- Messaging and notifications through push, SMS, and email

### Employee Management

- Attendance with approved Wi-Fi validation
- Optional GPS radius validation as extra security
- Shift templates for reusable schedules that can be bulk-assigned to employees
- Rotating rosters with weekly and monthly drag-and-drop assignment views
- Overlap-aware staffing logic that evaluates room capacity and staff availability together
- Shift scheduling and lateness tracking
- Shift-based payroll and commission calculation
- Service assignment and completion tracking
- Commission and payroll visibility
- Credit or salary advance workflows
- Employee eligibility rules for credit access
- Leave management with branch impact awareness
- Penalty, infraction, suspension, and termination workflows

### Inventory And Sales

- Stock tracking by branch
- Inventory transfers between branches
- Purchase orders and restocking workflow
- Low-stock alerts
- Wastage and adjustment tracking
- Sales analytics by branch, employee, service, and product

### Finance And Billing

- Robust tenant billing system
- Tiered pricing and paid add-on modules
- Trial support, coupons, prorations, and renewals
- Failed payment retry flow
- Grace periods and service suspension logic
- Invoice, payment, refund, and receipt records
- Immutable ledger-style financial records

### Superadmin Platform Features

- Tenant usage dashboards
- Tenant health scorecards to identify low-engagement or churn-risk tenants
- Module entitlement controls
- Dynamic feature gating by tenant, tier, or trial status
- Whitelabel theme and branding management for eligible tenants
- Resource usage quotas and enforcement by plan
- Global promo code management for sign-up and seasonal campaigns
- System-wide maintenance window scheduling and notifications
- Automated payout and escrow management if the platform processes tenant payments
- Platform announcements
- Feature flags
- Support ticket operations
- Audit log review
- Risk and anomaly monitoring
- Optional workspace-level blacklist controls for terminated employees

### Reporting

- Revenue reports
- Appointment and utilization reports
- Employee productivity and commission reports
- Employee rebooking rate and retail attach-rate benchmarking
- Shift attendance, lateness, absence, and leave-impact reports
- Disciplinary and infraction trend reports
- Inventory movement reports
- Subscription and churn reports
- Outstanding balances and collections reports

## Important Product Rules

- Tenant isolation must be strict across data and permissions
- Access control should be role-based and branch-scoped
- Owners should be able to further limit employee permissions
- Attendance should validate a trusted network identifier, not only Wi-Fi name
- Services and products are branch-owned by default
- Transfers between branches should be explicit and auditable
- All billing and payroll operations should be auditable
- Financial records should support double-entry ledger integrity for cash, payouts, refunds, credits, and inventory value movement
- Sensitive actions should generate audit log entries
- Notifications, billing tasks, and reporting jobs should support background processing
- Mobile operations should degrade gracefully offline and sync safely when connectivity returns
- Tenant policies should be configurable data with workspace-level defaults and branch-level overrides
- Suspensions and terminations must trigger immediate access revocation and downstream payroll-safe handling

## Recommended MVP Scope

### MVP In

- Public marketing website
- Authentication and tenant onboarding
- Workspace, branches, and rooms
- Role-based access for Owner, Manager, Receptionist, Employee
- Customer booking and history
- Services, products, appointments, and customers
- Attendance with approved network validation
- Basic payroll and commission visibility
- Superadmin tenant management and billing basics
- Plan upgrades and downgrades
- Notifications
- Basic analytics and audit logs

### MVP Out For Later Phase

- Advanced payroll engine
- Full loyalty program
- Deep marketing automation
- AI insights and forecasting
- Franchise-level advanced analytics
- Rich external integrations
- Visual room mapping and advanced floor-plan interactions
- AI booking optimization assistant
- Automated tenant payout and escrow settlement

## Suggested Product Modules

- `core`
- `auth`
- `tenant-management`
- `branch-management`
- `appointments`
- `services`
- `products`
- `inventory`
- `procurement`
- `equipment-maintenance`
- `customers-crm`
- `policy-management`
- `document-repository`
- `shift-scheduling`
- `leave-management`
- `marketing-automation`
- `attendance`
- `discipline`
- `access-control`
- `payroll`
- `employee-credit`
- `billing`
- `ledger`
- `payouts`
- `notifications`
- `reports`
- `support`
- `audit-log`
- `offline-sync`

## Suggested High-Level Architecture

### Frontend

- Expo app for tenant staff flows and customer mobile flows
- Separate public website for SEO and first-time visitors
- Separate superadmin web dashboard for dense operational screens
- Shared design system and shared API client where practical

### Backend

- Central API service with tenant-aware authorization
- Background job system for billing, notifications, and reports
- File/media storage with tenant scoping
- Event and audit logging for key actions
- Rules/configuration layer for feature gating, quotas, and tier entitlements
- Ledger and settlement services for financial integrity and payout flows
- Sync engine for conflict-aware offline mobile data reconciliation

### Core Data Entities

- `Tenant`
- `Branch`
- `Room`
- `User`
- `Role`
- `EmployeeProfile`
- `ShiftTemplate`
- `ShiftAssignment`
- `Roster`
- `WorkspacePolicy`
- `BranchPolicy`
- `PolicyDocument`
- `PolicyAcknowledgement`
- `LeaveType`
- `LeaveBalance`
- `LeaveRequest`
- `InfractionRecord`
- `PenaltyRule`
- `StrikeRecord`
- `SuspensionRecord`
- `TerminationRecord`
- `AssetRecoveryItem`
- `Customer`
- `Service`
- `Product`
- `ConsumableRule`
- `Supplier`
- `PurchaseOrder`
- `EquipmentAsset`
- `MaintenanceLog`
- `InventoryItem`
- `Appointment`
- `WaitlistEntry`
- `AttendanceRecord`
- `PayrollRecord`
- `CreditRequest`
- `CommissionRule`
- `SkillTag`
- `EmployeeSkill`
- `AvailabilityBlock`
- `Subscription`
- `Invoice`
- `Payment`
- `LedgerAccount`
- `LedgerEntry`
- `Payout`
- `QuotaUsage`
- `FeatureEntitlement`
- `ThemeProfile`
- `Referral`
- `Campaign`
- `Notification`
- `SupportTicket`
- `AuditLog`

## Strategic Enhancements

### Superadmin Enhancements

- Tenant health scorecard using engagement, booking volume, payment behavior, and support signals
- Dynamic feature gating to enable or disable modules per tenant without code changes
- Whitelabel theme engine for enterprise tenants with logos, colors, and custom domains
- Automated payout and escrow management when collecting payments on behalf of tenants
- Resource usage quotas for branches, employees, storage, messaging, and optional premium modules
- Scheduled maintenance windows with advance notifications and tenant-visible status
- Global promo code engine for platform-level acquisition and retention campaigns

### Owner And Workspace Enhancements

- Consumables tracking that deducts stock automatically when a service is completed
- Equipment maintenance logs and downtime tracking for spa machines and rooms
- Supplier directory and purchase order workflow for replenishment
- Automated retention engine for 30, 60, and 90-day win-back campaigns
- Dynamic pricing and happy-hour pricing by branch, service, and time slot
- Referral and affiliate tracking for customer acquisition rewards
- Multi-level commission structures with thresholds and conditional rules
- Performance benchmarking for rebooking success, upsell rates, and productivity
- Employee skill matrix to control service eligibility and booking assignment
- Policy repository for handbooks, HSE documents, and operational standards
- Configurable policy engine with workspace-level and branch-level rules
- Variable rule toggles for cancellation windows, booking lead times, room cleanup buffers, and employee credit rules
- Digital acknowledgement of latest policies for staff on first login or after policy updates
- Custom audit triggers for tenant-defined sensitive actions
- Capacity-aware leave approval with automatic calendar blocking
- Automated or manual penalties, strikes, suspensions, and termination checklists
- Behavioral infraction logging with notes and optional photo evidence

### Strategic Product Improvements

- Queue-first waitlist flow for high-demand periods and walk-in optimization
- Visual room mapping and occupancy view for operational awareness
- AI booking assistant to reduce dead gaps and suggest better staff-room scheduling
- Double-entry accounting support for all financial and stock-related movements
- Offline-first mobile workflows with background sync and conflict handling
- Policy-as-data architecture so operational rules are configurable instead of hard-coded
- Workforce lifecycle controls with instant access revocation and final settlement workflows

## Workforce And Policy Logic

### Shift And Roster Management

- Shift templates should define reusable time slots such as morning, late, or mid-day shifts
- Managers should be able to build rotating rosters in calendar form and drag employees into shifts by branch
- Overlapping shifts must be supported without allowing staff or room overbooking
- Staff availability calculations should consider shift assignment, leave, existing bookings, room cleanup buffers, and branch policy
- Approved-network attendance should validate against the branch assigned for that specific shift
- Shift-based payroll should calculate hours, lateness, and commissions from actual approved attendance and services completed

### Policy Management

- Policies should be managed as configurable records with workspace-level defaults and optional branch-level overrides
- Owners should be able to define cancellation windows, booking lead times, room cleanup buffers, employee credit eligibility, and other operational rules
- Workspace-level policies should cover shared business rules such as employee tenure requirements for credit access
- Branch-level policies should support location-specific rules such as cleanup time between sessions
- A policy document repository should support handbook uploads, HSE rules, and internal standards
- Staff should acknowledge the latest required policy versions digitally before continuing into normal app usage
- Owners should be able to define custom audit triggers for actions such as price overrides, stock adjustments, or manual settlement changes

### Leave, Discipline, Suspension, And Termination

- Leave types should support accrual rules, caps, carryover rules, and prorated earning logic where required
- Leave approval should show branch impact and warn when approving leave would reduce service capacity too far
- Approved leave should automatically block employee availability in scheduling and booking flows
- Penalty rules should support automated lateness deductions, manual infractions, and configurable strike progression
- Strike policies should support outcomes such as formal warning, commission-bonus suspension, and termination review
- Suspension should support paid and unpaid modes and automatically pause the right payroll and commission calculations
- Termination workflows should include final settlement, deductions, outstanding employee-credit recovery, and asset-return checklist tracking
- Suspended or terminated employees must lose app access immediately across all branches
- Workspace-level blacklist flags should prevent accidental rehire within the same tenant, with optional superadmin oversight

## Security And Compliance Priorities

- Role-based access control with branch-level scoping
- Tenant data partitioning
- Attendance spoofing protection using approved network identity and optional GPS
- Shift-specific branch validation so check-in is only allowed at the assigned branch or approved network for that shift
- Immutable audit logs for sensitive actions
- Payment and billing traceability
- Double-entry ledger consistency checks and reconciliation controls
- Session security and device management for staff accounts
- Immediate access revocation for suspended or terminated employees
- Backup, restore, and disaster recovery planning
- Offline sync conflict resolution and tamper-resistant local action logs

## Testing And Validation Areas

- Tenant isolation between spas
- Branch-scoped access restrictions
- Billing flows: trial, renewal, proration, downgrade, failed payment, grace period
- Feature gating, quota enforcement, and plan entitlement behavior
- Booking conflict prevention for rooms and employees
- Waitlist promotion and off-peak pricing behavior
- Attendance acceptance only on approved network/location
- Shift overlap handling, room capacity checks, and branch-specific check-in eligibility
- Inventory deductions, transfers, and refund reversal
- Consumable auto-deduction and purchase order replenishment flow
- Equipment maintenance downtime impact on booking availability
- Payroll and commission correctness
- Multi-tier commission thresholds and employee skill eligibility checks
- Leave accrual, capacity-aware approval, and automatic calendar blocking
- Lateness penalties, strike progression, suspension behavior, and termination settlement correctness
- Credit eligibility and repayment tracking
- Ledger balancing, payout splits, and reconciliation correctness
- Notification delivery and visibility rules
- Offline capture and safe sync reconciliation after reconnection
- Audit logging for critical actions

## Default Assumptions Chosen For Planning

- The system is greenfield and not constrained by an existing app
- Expo will be used for the tenant-facing mobile experience
- Public website and superadmin dashboard should be web-first experiences
- Customer access may be mobile-first, but can later share some web surfaces
- Billing must support scalable SaaS subscription logic, not only manual invoicing
- Role permissions will be configurable beyond simple fixed roles
- The platform may eventually process money on behalf of tenants, so payouts and settlement should not be an afterthought
- Offline operation is important for branch-level continuity during unstable internet or Wi-Fi outages
- Tenant policies should be stored as configurable data, not embedded in code
- Workforce status changes such as suspension or termination must revoke access immediately and trigger downstream operational controls

## Recommended Next Planning Step

Turn this product plan into an implementation blueprint covering:

- Monorepo or multi-app repository structure
- Route map for each role and platform
- Backend modules and service boundaries
- Database schema draft
- MVP screen inventory
- Authentication and tenant onboarding flow
- Billing and entitlement rules
