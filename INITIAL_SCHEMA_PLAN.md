# Initial Schema Plan

## Summary

This document defines the first database implementation plan for the platform using:

- `Prisma`
- `MySQL 8`
- cPanel-hosted shared MySQL

The goal is to sequence the schema in safe migration batches and avoid early mistakes around:

- tenant isolation
- branch scoping
- status enums
- MySQL index limits
- auditable finance records

## Schema Design Principles

- Every tenant-owned model includes `tenantId`
- Branch-owned models include `branchId` where operationally relevant
- Status fields should use explicit enums
- Audit and ledger tables are append-only in behavior
- Avoid oversized indexed text fields in MySQL
- Prefer `VARCHAR(191)`-safe uniqueness patterns where needed for utf8mb4 compatibility
- Use `DATETIME(3)` precision consistently for operational timestamps
- Use decimal fields for money, never floats

## Migration Batch Order

### Batch 1: Identity And Tenant Foundation

Models:

- `User`
- `Tenant`
- `Branch`
- `Room`
- `Role`
- `PermissionGrant`
- `EmployeeProfile`
- `CustomerProfile`

Why first:

- Everything else depends on tenant, branch, and user context

Key enums:

- `UserStatus`
- `TenantStatus`
- `BranchStatus`
- `RoomStatus`
- `RoleType`
- `EmploymentStatus`

Key constraints:

- unique tenant slug
- unique branch code per tenant
- unique room code per branch
- unique employee code per tenant
- one owner reference per tenant at creation time

Recommended indexes:

- `Tenant.slug`
- `(Branch.tenantId, Branch.status)`
- `(Room.tenantId, Room.branchId, Room.status)`
- `(EmployeeProfile.tenantId, EmployeeProfile.userId)`
- `(CustomerProfile.tenantId, CustomerProfile.phone)`

### Batch 2: Catalog And Customer Operations

Models:

- `Service`
- `Product`
- `InventoryItem`
- `Appointment`
- `AppointmentLine`

Why second:

- These unlock the first usable operational flows

Key enums:

- `ServiceStatus`
- `ProductStatus`
- `InventoryStatus`
- `AppointmentStatus`
- `AppointmentSource`

Key constraints:

- unique service code per tenant and branch
- unique product SKU per tenant and branch
- one inventory row per product per branch

Recommended indexes:

- `(Service.tenantId, Service.branchId, Service.status)`
- `(Product.tenantId, Product.branchId, Product.status)`
- `(InventoryItem.tenantId, InventoryItem.branchId, InventoryItem.status)`
- `(Appointment.tenantId, Appointment.branchId, Appointment.startAt)`
- `(Appointment.tenantId, Appointment.employeeId, Appointment.startAt)`
- `(Appointment.tenantId, Appointment.roomId, Appointment.startAt)`
- `(Appointment.tenantId, Appointment.customerId, Appointment.startAt)`

Important MySQL note:

- True exclusion constraints are not available like in PostgreSQL, so overlapping booking protection must be enforced in application logic with transactional checks

### Batch 3: Attendance And Policy Core

Models:

- `AttendanceRecord`
- `WorkspacePolicy`
- `BranchPolicy`
- `PolicyAcknowledgement`
- optional phase-1-ready `ShiftAssignment` stub

Why third:

- Attendance and policy enforcement are core to the first release

Key enums:

- `AttendanceStatus`
- `PolicyScope`

Key constraints:

- one active policy record per key per scope and version
- acknowledgements should reference exact policy versions or effective policy records

Recommended indexes:

- `(AttendanceRecord.tenantId, AttendanceRecord.branchId, AttendanceRecord.checkInAt)`
- `(AttendanceRecord.tenantId, AttendanceRecord.employeeId, AttendanceRecord.checkInAt)`
- `(WorkspacePolicy.tenantId, WorkspacePolicy.policyKey, WorkspacePolicy.isActive)`
- `(BranchPolicy.tenantId, BranchPolicy.branchId, BranchPolicy.policyKey, BranchPolicy.isActive)`

### Batch 4: Billing And Ledger Foundation

Models:

- `Plan`
- `Subscription`
- `Invoice`
- `Payment`
- `LedgerEntry`

Why fourth:

- Subscription billing is in phase 1, but should sit on top of the tenant foundation

Key enums:

- `SubscriptionStatus`
- `InvoiceStatus`
- `PaymentStatus`
- `LedgerDirection`

Key constraints:

- one active subscription per tenant
- unique invoice number
- provider reference uniqueness where safe

Recommended indexes:

- `(Subscription.tenantId, Subscription.status)`
- `(Invoice.tenantId, Invoice.subscriptionId, Invoice.status)`
- `(Invoice.tenantId, Invoice.dueAt)`
- `(Payment.tenantId, Payment.invoiceId, Payment.status)`
- `(LedgerEntry.tenantId, LedgerEntry.entryGroupId)`
- `(LedgerEntry.tenantId, LedgerEntry.referenceType, LedgerEntry.referenceId)`

Important behavior:

- Ledger balancing must be validated in service logic and transaction boundaries, not only by schema

### Batch 5: Notifications And Audit

Models:

- `Notification`
- `NotificationDelivery`
- `AuditLog`

Why fifth:

- These are cross-cutting but depend on users, tenants, and business events

Key enums:

- `NotificationStatus`
- `NotificationChannel`

Recommended indexes:

- `(Notification.tenantId, Notification.userId, Notification.status)`
- `(NotificationDelivery.tenantId, NotificationDelivery.notificationId, NotificationDelivery.channel)`
- `(AuditLog.tenantId, AuditLog.createdAt)`
- `(AuditLog.tenantId, AuditLog.entityType, AuditLog.entityId)`
- `(AuditLog.tenantId, AuditLog.actorUserId, AuditLog.createdAt)`

## Initial Model Field Guidance

### Money Fields

Use:

- `Decimal(18,2)` for prices and totals
- `Decimal(18,4)` only where fractional precision is truly needed

Apply to:

- service price
- product prices
- invoice totals
- payment amounts
- ledger amounts

### Identifier Fields

Use:

- UUID string ids for application records if preferred for distributed-safe generation
- or CUID if team prefers shorter identifiers

Recommendation:

- Use Prisma string IDs with generated CUID for phase 1 simplicity

### Date Fields

Use:

- `DATETIME(3)` for all operational timestamps
- store all timestamps in UTC
- store tenant and branch timezone separately for presentation and business rules

### JSON Fields

Safe phase 1 uses:

- policy values
- user preferences
- audit metadata
- provider webhook payload snapshots

Avoid:

- storing core relational workflow data in JSON when it needs filtering or joins

## Proposed Enum Set For Phase 1

- `UserStatus`
- `TenantStatus`
- `BranchStatus`
- `RoomStatus`
- `RoleType`
- `EmploymentStatus`
- `ServiceStatus`
- `ProductStatus`
- `InventoryStatus`
- `AppointmentStatus`
- `AppointmentSource`
- `AttendanceStatus`
- `SubscriptionStatus`
- `InvoiceStatus`
- `PaymentStatus`
- `LedgerDirection`
- `NotificationStatus`
- `NotificationChannel`

## Table Notes By Model

### `User`

Important fields:

- `email` should be unique globally if one account can span multiple tenants
- `phone` may be nullable initially
- `status` should be indexed

### `Tenant`

Important fields:

- `slug` should be unique
- `status`, `planId`, `trialEndsAt`, and `suspendedAt` support billing lifecycle queries

### `Branch`

Important fields:

- use `(tenantId, code)` unique
- add `(tenantId, isDefault)` non-unique index for quick default branch lookup

### `Role`

Important fields:

- system roles may exist per tenant or as seeded templates copied into tenant scope

Recommendation:

- seed fixed role types in phase 1 and reserve custom roles for later

### `Appointment`

Important fields:

- `startAt` and `endAt` are mandatory
- `employeeId` nullable only if booking can be created before staff assignment
- `roomId` nullable only if service does not require a room

Operational rule:

- active booking overlap checks happen in transactional service logic

### `AttendanceRecord`

Important fields:

- `networkIdentifier` should be stored for validation traceability
- `latenessMinutes` defaults to `0`
- `exceptionFlag` defaults to `false`

### `WorkspacePolicy` and `BranchPolicy`

Recommendation:

- store one row per `policyKey`
- use `policyValueJson` for structured settings
- keep `effectiveFrom` to support future scheduled changes

### `Invoice` and `Payment`

Recommendation:

- invoice numbers should be generated by service logic
- provider references should be indexed but not always globally unique across providers unless namespaced

### `AuditLog`

Recommendation:

- make it append-only at application level
- use `metadataJson` for rich context
- do not update records after insert except in exceptional archival pipelines

## Seed Dependency Order

Recommended first seed sequence:

1. plans
2. superadmin user
3. tenant
4. branch
5. rooms
6. tenant roles
7. owner user + employee profile
8. manager, receptionist, employee users + profiles
9. customer user + profile
10. services
11. products
12. inventory items
13. policy defaults
14. subscription

## MySQL-Specific Cautions

- Be careful with long unique indexed strings under utf8mb4
- Avoid too many nullable columns in frequently filtered indexes without reviewing performance
- Use explicit foreign-key index coverage for tenant and branch joins
- Large audit and notification tables should be designed for archival later
- Remote MySQL on shared hosting may have lower connection limits, so pool sizing must stay conservative

## Suggested Prisma Implementation Order

1. Define enums
2. Implement tenant and identity models
3. Implement branch and room models
4. Implement role and employee models
5. Implement customer and catalog models
6. Implement appointment and attendance models
7. Implement policy models
8. Implement billing and ledger models
9. Implement notification and audit models
10. Add seeds and test data

## Validation Checklist Before First Migration

- All tenant-owned models include `tenantId`
- All branch-bound models include `branchId`
- Every status field uses an enum
- Money fields use decimal types
- Unique constraints are scoped correctly
- Indexes match likely list and lookup queries
- No model assumes PostgreSQL-only features
- Audit and ledger write behavior is handled in service logic

## Recommended Next Artifact

Create `IMPLEMENTATION_SEQUENCE.md` next to define:

- the first coding milestone
- exact module-by-module build order
- what to implement in week 1, week 2, and week 3
- integration checkpoints across apps and backend
