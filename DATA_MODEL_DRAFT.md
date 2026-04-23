# Data Model Draft

## Summary

This document defines the initial domain model for the multi-tenant spa management platform. It focuses on:

- Core entities needed for phase 1
- Extension-ready entities already anticipated by the product plan
- Tenant and branch scoping rules
- Key lifecycle states
- Audit and ledger event points

Design principles:

- Tenant isolation is mandatory
- Branch scoping is explicit where operationally relevant
- Financial and sensitive operational actions are auditable
- Policies are stored as data, not hard-coded rules
- Employee scheduling, attendance, and booking are modeled separately

## Scoping Rules

### Tenant Scope

Every tenant-owned record must include:

- `id`
- `tenantId`
- `createdAt`
- `updatedAt`
- `createdBy` where relevant

Tenant-scoped domains:

- Branches
- Rooms
- Staff and staff profiles
- Customers
- Services and products
- Inventory
- Appointments
- Policies
- Billing records tied to a tenant subscription
- Notifications
- Audit logs

### Branch Scope

Branch-scoped records must include:

- `branchId`

Branch-scoped domains:

- Rooms
- Services when configured per branch
- Products when stocked per branch
- Inventory items and stock movements
- Appointments
- Attendance
- Shift assignments
- Branch policy overrides

### Platform Scope

Platform-only records should not be tenant-scoped unless linked intentionally:

- Superadmin users
- Platform plans
- Global promotions
- Platform maintenance notices
- Platform feature defaults

## Relationship Overview

```text
User -> EmployeeProfile -> Tenant
User -> CustomerProfile -> Tenant
Tenant -> Branch -> Room
Tenant -> Branch -> Service
Tenant -> Branch -> Product
Tenant -> Branch -> InventoryItem
Tenant -> Branch -> Appointment
Tenant -> Branch -> AttendanceRecord
Tenant -> WorkspacePolicy
Branch -> BranchPolicy
Tenant -> Subscription -> Invoice -> Payment
Tenant -> AuditLog
Tenant -> Notification
EmployeeProfile -> ShiftAssignment
EmployeeProfile -> AttendanceRecord
EmployeeProfile -> PayrollRecord
CustomerProfile -> Appointment
Appointment -> Service
Appointment -> Room
Appointment -> EmployeeProfile
```

## Core Entities

### 1. User

Purpose:

- Identity record for authentication and account ownership

Key fields:

- `id`
- `email`
- `phone`
- `passwordHash`
- `status`
- `lastLoginAt`
- `isPlatformUser`
- `createdAt`
- `updatedAt`

Important notes:

- A single user may participate in multiple tenants if invited separately
- Role assignments should not live directly on `User`

Suggested statuses:

- `pending_verification`
- `active`
- `locked`
- `disabled`

### 2. Tenant

Purpose:

- Represents a spa workspace or business account

Key fields:

- `id`
- `name`
- `slug`
- `status`
- `ownerUserId`
- `timezone`
- `currency`
- `country`
- `planId`
- `trialEndsAt`
- `activatedAt`
- `suspendedAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `draft`
- `trial`
- `active`
- `grace_period`
- `suspended`
- `archived`

Audit events:

- tenant created
- tenant suspended
- tenant reactivated
- plan changed

### 3. Branch

Purpose:

- Physical operating location under a tenant

Key fields:

- `id`
- `tenantId`
- `name`
- `code`
- `status`
- `addressLine1`
- `addressLine2`
- `city`
- `country`
- `timezone`
- `phone`
- `email`
- `isDefault`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `active`
- `inactive`
- `closed`

### 4. Room

Purpose:

- Bookable treatment or service room within a branch

Key fields:

- `id`
- `tenantId`
- `branchId`
- `name`
- `code`
- `roomType`
- `capacity`
- `status`
- `cleanupBufferMinutes`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `active`
- `maintenance`
- `inactive`

### 5. Role

Purpose:

- Role template for access resolution

Key fields:

- `id`
- `tenantId`
- `name`
- `roleType`
- `isSystemRole`
- `createdAt`
- `updatedAt`

Suggested role types:

- `owner`
- `manager`
- `receptionist`
- `employee`
- `customer`

### 6. PermissionGrant

Purpose:

- Explicit permission overrides or scoped grants for a user within a tenant

Key fields:

- `id`
- `tenantId`
- `userId`
- `roleId`
- `branchId`
- `permissionKey`
- `effect`
- `createdAt`
- `updatedAt`

Suggested effects:

- `allow`
- `deny`

### 7. EmployeeProfile

Purpose:

- Employment context of a user inside a tenant

Key fields:

- `id`
- `tenantId`
- `userId`
- `employeeCode`
- `employmentStatus`
- `primaryBranchId`
- `hireDate`
- `terminationDate`
- `creditEligible`
- `canEarnCommission`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `invited`
- `active`
- `suspended_paid`
- `suspended_unpaid`
- `terminated`

Related records:

- shift assignments
- attendance
- payroll
- infractions
- policy acknowledgements

### 8. CustomerProfile

Purpose:

- Customer identity and booking context within a tenant

Key fields:

- `id`
- `tenantId`
- `userId`
- `fullName`
- `phone`
- `email`
- `dateOfBirth`
- `preferencesJson`
- `notes`
- `marketingConsent`
- `createdAt`
- `updatedAt`

## Catalog And Operations

### 9. Service

Purpose:

- A bookable spa service

Key fields:

- `id`
- `tenantId`
- `branchId`
- `name`
- `code`
- `description`
- `durationMinutes`
- `price`
- `status`
- `categoryId`
- `requiresRoom`
- `requiresEmployeeSkill`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `active`
- `inactive`

### 10. Product

Purpose:

- Retail or operational product configured for a branch

Key fields:

- `id`
- `tenantId`
- `branchId`
- `name`
- `sku`
- `description`
- `unitPrice`
- `costPrice`
- `status`
- `isRetail`
- `createdAt`
- `updatedAt`

### 11. InventoryItem

Purpose:

- Branch-level stock record for a product

Key fields:

- `id`
- `tenantId`
- `branchId`
- `productId`
- `quantityOnHand`
- `reorderLevel`
- `status`
- `lastCountedAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `active`
- `low_stock`
- `out_of_stock`
- `inactive`

### 12. InventoryMovement

Purpose:

- Append-only stock movement log

Key fields:

- `id`
- `tenantId`
- `branchId`
- `inventoryItemId`
- `movementType`
- `quantity`
- `referenceType`
- `referenceId`
- `notes`
- `createdAt`
- `createdBy`

Suggested movement types:

- `sale`
- `adjustment`
- `transfer_in`
- `transfer_out`
- `restock`
- `wastage`

Audit and ledger notes:

- Manual adjustments should always create audit entries
- Inventory value movement should be ledger-ready even if full accounting is phased later

### 13. Appointment

Purpose:

- Core booking record

Key fields:

- `id`
- `tenantId`
- `branchId`
- `customerId`
- `roomId`
- `employeeId`
- `status`
- `startAt`
- `endAt`
- `source`
- `notes`
- `checkInAt`
- `checkOutAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `draft`
- `confirmed`
- `checked_in`
- `in_service`
- `completed`
- `canceled`
- `no_show`

Suggested sources:

- `customer_app`
- `reception`
- `manager`
- `owner`

Constraints:

- Booking must respect room availability
- Booking must respect employee availability
- Booking must respect lead time and cancellation policies

### 14. AppointmentLine

Purpose:

- Line-level service detail for appointments with multiple services

Key fields:

- `id`
- `tenantId`
- `appointmentId`
- `serviceId`
- `employeeId`
- `durationMinutes`
- `unitPrice`
- `status`
- `createdAt`
- `updatedAt`

### 15. WaitlistEntry

Purpose:

- Deferred phase entity for future queue-first booking

Key fields:

- `id`
- `tenantId`
- `branchId`
- `customerId`
- `serviceId`
- `preferredTimeWindow`
- `status`
- `createdAt`

## Workforce Model

### 16. ShiftTemplate

Purpose:

- Reusable shift definition

Key fields:

- `id`
- `tenantId`
- `name`
- `startTime`
- `endTime`
- `crossesMidnight`
- `defaultBranchId`
- `isActive`
- `createdAt`
- `updatedAt`

### 17. ShiftAssignment

Purpose:

- Decouples employees from reusable time slots and branch-specific shift placement

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `branchId`
- `shiftTemplateId`
- `shiftDate`
- `scheduledStartAt`
- `scheduledEndAt`
- `status`
- `assignedBy`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `scheduled`
- `completed`
- `missed`
- `canceled`

### 18. AttendanceRecord

Purpose:

- Captures actual employee clock-in and clock-out events

Key fields:

- `id`
- `tenantId`
- `branchId`
- `employeeId`
- `shiftAssignmentId`
- `checkInAt`
- `checkOutAt`
- `attendanceStatus`
- `networkIdentifier`
- `gpsLatitude`
- `gpsLongitude`
- `latenessMinutes`
- `exceptionFlag`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `present`
- `late`
- `absent`
- `partial`
- `flagged`

Rules:

- Check-in should validate against assigned branch and approved attendance network
- Out-of-policy attendance should be flagged, not silently accepted

### 19. AvailabilityBlock

Purpose:

- Shared availability exclusion model for leave, suspension, maintenance, or manual blocking

Key fields:

- `id`
- `tenantId`
- `branchId`
- `employeeId`
- `blockType`
- `startAt`
- `endAt`
- `reason`
- `referenceType`
- `referenceId`
- `createdAt`

Suggested block types:

- `leave`
- `suspension`
- `manual`
- `training`

### 20. LeaveType

Purpose:

- Tenant-defined leave category

Key fields:

- `id`
- `tenantId`
- `name`
- `code`
- `isPaid`
- `accrualMode`
- `maxBalance`
- `requiresApproval`
- `createdAt`
- `updatedAt`

### 21. LeaveBalance

Purpose:

- Employee leave entitlement balance

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `leaveTypeId`
- `balance`
- `accruedToDate`
- `usedToDate`
- `updatedAt`

### 22. LeaveRequest

Purpose:

- Employee time-off request

Key fields:

- `id`
- `tenantId`
- `branchId`
- `employeeId`
- `leaveTypeId`
- `startDate`
- `endDate`
- `status`
- `impactScore`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `pending`
- `approved`
- `rejected`
- `canceled`

### 23. SkillTag

Purpose:

- Skill or certification used in service eligibility

Key fields:

- `id`
- `tenantId`
- `name`
- `code`
- `createdAt`

### 24. EmployeeSkill

Purpose:

- Links an employee to a skill

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `skillTagId`
- `verifiedAt`
- `expiresAt`
- `createdAt`

### 25. CommissionRule

Purpose:

- Extension-ready rule model for payroll and service commission

Key fields:

- `id`
- `tenantId`
- `branchId`
- `name`
- `ruleType`
- `thresholdJson`
- `rateJson`
- `isActive`
- `createdAt`
- `updatedAt`

### 26. PayrollRecord

Purpose:

- Payroll summary record for an employee and period

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `periodStart`
- `periodEnd`
- `baseAmount`
- `commissionAmount`
- `deductionAmount`
- `netAmount`
- `status`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `draft`
- `approved`
- `paid`
- `reversed`

### 27. CreditRequest

Purpose:

- Employee salary advance or credit request

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `requestedAmount`
- `approvedAmount`
- `reason`
- `status`
- `repaymentStatus`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `pending`
- `approved`
- `rejected`
- `closed`

### 28. InfractionRecord

Purpose:

- Disciplinary record for behavioral or attendance-related issues

Key fields:

- `id`
- `tenantId`
- `branchId`
- `employeeId`
- `infractionType`
- `severity`
- `notes`
- `evidenceUrl`
- `status`
- `createdBy`
- `createdAt`

### 29. PenaltyRule

Purpose:

- Policy-backed automation for lateness deductions and strike logic

Key fields:

- `id`
- `tenantId`
- `branchId`
- `name`
- `triggerType`
- `triggerConfigJson`
- `actionConfigJson`
- `isActive`
- `createdAt`
- `updatedAt`

### 30. StrikeRecord

Purpose:

- Tracks disciplinary progression per employee

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `sourceType`
- `sourceId`
- `strikeNumber`
- `outcome`
- `issuedAt`
- `expiresAt`

### 31. SuspensionRecord

Purpose:

- Employee suspension period and effects

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `branchId`
- `suspensionType`
- `startAt`
- `endAt`
- `reason`
- `payrollEffect`
- `status`
- `createdAt`
- `updatedAt`

Suggested suspension types:

- `paid`
- `unpaid`

### 32. TerminationRecord

Purpose:

- Final employment exit record

Key fields:

- `id`
- `tenantId`
- `employeeId`
- `terminationDate`
- `reason`
- `finalSettlementStatus`
- `blacklistFlag`
- `createdAt`
- `updatedAt`

### 33. AssetRecoveryItem

Purpose:

- Tracks exit checklist items that must be returned

Key fields:

- `id`
- `tenantId`
- `terminationRecordId`
- `name`
- `status`
- `notes`
- `updatedAt`

Suggested statuses:

- `pending`
- `returned`
- `waived`

## Policy And Document Model

### 34. WorkspacePolicy

Purpose:

- Tenant-wide operational policy defaults

Key fields:

- `id`
- `tenantId`
- `policyKey`
- `policyValueJson`
- `version`
- `isActive`
- `effectiveFrom`
- `createdAt`
- `updatedAt`

Examples:

- booking cancellation window
- booking lead time
- employee credit eligibility rule
- default cleanup buffer

### 35. BranchPolicy

Purpose:

- Branch-level override for workspace policy

Key fields:

- `id`
- `tenantId`
- `branchId`
- `policyKey`
- `policyValueJson`
- `version`
- `isActive`
- `effectiveFrom`
- `createdAt`
- `updatedAt`

### 36. PolicyDocument

Purpose:

- Human-readable policy or handbook file

Key fields:

- `id`
- `tenantId`
- `branchId`
- `title`
- `documentType`
- `currentVersionId`
- `isAcknowledgementRequired`
- `createdAt`
- `updatedAt`

### 37. PolicyVersion

Purpose:

- Version history for a policy document

Key fields:

- `id`
- `tenantId`
- `policyDocumentId`
- `versionNumber`
- `contentUrl`
- `summary`
- `publishedAt`
- `publishedBy`

### 38. PolicyAcknowledgement

Purpose:

- Staff acknowledgement of required policy versions

Key fields:

- `id`
- `tenantId`
- `policyVersionId`
- `userId`
- `acknowledgedAt`
- `ipAddress`
- `deviceInfo`

## Subscription And Finance Model

### 39. Plan

Purpose:

- Platform subscription plan definition

Key fields:

- `id`
- `name`
- `code`
- `price`
- `billingInterval`
- `isActive`
- `quotaJson`
- `moduleJson`
- `createdAt`
- `updatedAt`

### 40. Subscription

Purpose:

- Tenant subscription state

Key fields:

- `id`
- `tenantId`
- `planId`
- `status`
- `startedAt`
- `renewsAt`
- `graceEndsAt`
- `canceledAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `trial`
- `active`
- `past_due`
- `grace_period`
- `suspended`
- `canceled`

### 41. Invoice

Purpose:

- Bill issued to a tenant

Key fields:

- `id`
- `tenantId`
- `subscriptionId`
- `invoiceNumber`
- `status`
- `currency`
- `subtotal`
- `taxAmount`
- `totalAmount`
- `dueAt`
- `issuedAt`
- `paidAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `draft`
- `issued`
- `paid`
- `void`
- `overdue`

### 42. Payment

Purpose:

- Recorded payment against an invoice

Key fields:

- `id`
- `tenantId`
- `invoiceId`
- `paymentMethod`
- `providerReference`
- `status`
- `amount`
- `currency`
- `receivedAt`
- `createdAt`
- `updatedAt`

Suggested statuses:

- `pending`
- `succeeded`
- `failed`
- `reversed`

### 43. Refund

Purpose:

- Reversal or refund of a payment

Key fields:

- `id`
- `tenantId`
- `paymentId`
- `amount`
- `status`
- `reason`
- `createdAt`
- `updatedAt`

### 44. LedgerAccount

Purpose:

- Chart-of-accounts style bucket for ledger postings

Key fields:

- `id`
- `tenantId`
- `accountCode`
- `name`
- `accountType`
- `isSystem`
- `createdAt`
- `updatedAt`

Suggested account types:

- `asset`
- `liability`
- `equity`
- `revenue`
- `expense`

### 45. LedgerEntry

Purpose:

- Append-only double-entry posting line

Key fields:

- `id`
- `tenantId`
- `entryGroupId`
- `accountId`
- `direction`
- `amount`
- `currency`
- `referenceType`
- `referenceId`
- `description`
- `createdAt`
- `createdBy`

Suggested directions:

- `debit`
- `credit`

Rules:

- Each `entryGroupId` must balance
- Manual postings require elevated permission and audit logging

### 46. Payout

Purpose:

- Future phase tenant settlement record

Key fields:

- `id`
- `tenantId`
- `status`
- `grossAmount`
- `feeAmount`
- `netAmount`
- `scheduledAt`
- `paidAt`
- `createdAt`

## Platform And Messaging

### 47. Notification

Purpose:

- In-app notification envelope

Key fields:

- `id`
- `tenantId`
- `userId`
- `type`
- `title`
- `body`
- `status`
- `referenceType`
- `referenceId`
- `createdAt`

Suggested statuses:

- `unread`
- `read`
- `archived`

### 48. NotificationDelivery

Purpose:

- Delivery record for push, email, or SMS

Key fields:

- `id`
- `tenantId`
- `notificationId`
- `channel`
- `status`
- `providerReference`
- `sentAt`
- `deliveredAt`
- `failedAt`

### 49. SupportTicket

Purpose:

- Superadmin support and tenant issue tracking

Key fields:

- `id`
- `tenantId`
- `createdByUserId`
- `assignedToUserId`
- `subject`
- `status`
- `priority`
- `category`
- `createdAt`
- `updatedAt`

### 50. AuditLog

Purpose:

- Immutable log of sensitive actions

Key fields:

- `id`
- `tenantId`
- `branchId`
- `actorUserId`
- `actionKey`
- `entityType`
- `entityId`
- `metadataJson`
- `ipAddress`
- `deviceInfo`
- `createdAt`

Recommended audited actions:

- price override
- stock adjustment
- role change
- policy change
- tenant suspension
- manual billing adjustment
- attendance exception override
- termination approval

### 51. FeatureEntitlement

Purpose:

- Module and feature gating by tenant or plan

Key fields:

- `id`
- `tenantId`
- `featureKey`
- `sourceType`
- `isEnabled`
- `effectiveFrom`
- `expiresAt`
- `createdAt`

### 52. QuotaUsage

Purpose:

- Tracks measured resource usage against plan limits

Key fields:

- `id`
- `tenantId`
- `quotaKey`
- `periodStart`
- `periodEnd`
- `usedValue`
- `limitValue`
- `createdAt`
- `updatedAt`

### 53. ThemeProfile

Purpose:

- Enterprise or future whitelabel settings

Key fields:

- `id`
- `tenantId`
- `logoUrl`
- `primaryColor`
- `secondaryColor`
- `customDomain`
- `createdAt`
- `updatedAt`

### 54. SyncBatch

Purpose:

- Server-side representation of a client sync attempt

Key fields:

- `id`
- `tenantId`
- `userId`
- `deviceId`
- `status`
- `submittedAt`
- `processedAt`
- `createdAt`

### 55. SyncConflict

Purpose:

- Review record for offline merge conflicts

Key fields:

- `id`
- `tenantId`
- `syncBatchId`
- `entityType`
- `entityId`
- `conflictType`
- `resolutionStatus`
- `createdAt`
- `updatedAt`

## Lifecycle State Tables

### Employee Lifecycle

```text
invited -> active -> suspended_paid -> active
invited -> active -> suspended_unpaid -> active
invited -> active -> terminated
```

### Appointment Lifecycle

```text
draft -> confirmed -> checked_in -> in_service -> completed
confirmed -> canceled
confirmed -> no_show
checked_in -> canceled
```

### Subscription Lifecycle

```text
trial -> active -> past_due -> grace_period -> suspended
active -> canceled
suspended -> active
```

### Leave Lifecycle

```text
pending -> approved
pending -> rejected
pending -> canceled
approved -> canceled
```

## Audit Event Points

Minimum audit events for phase 1:

- tenant created
- branch created or closed
- staff invited
- role changed
- policy changed
- approved attendance network changed
- booking manually overridden
- booking canceled after policy cutoff
- manual stock adjustment
- invoice status manually changed
- plan upgraded or downgraded

Additional audit events planned:

- leave approval
- infraction logged
- strike issued
- suspension created
- termination finalized

## Ledger Event Points

Phase 1 required ledger postings:

- invoice issued
- payment received
- refund recorded
- plan upgrade adjustment
- plan downgrade credit

Phase 2 planned ledger postings:

- payroll approved
- employee credit disbursed
- employee credit repayment
- payout created
- inventory value adjustment

## Recommended Database Constraints

- Unique tenant slug
- Unique branch code per tenant
- Unique room code per branch
- Unique employee code per tenant
- Unique service code per branch
- Unique product SKU per branch
- Unique active subscription per tenant
- Unique policy key per scope and active version

Important integrity rules:

- Appointments cannot overlap on the same room when status is active
- Appointments cannot overlap on the same employee when status is active
- Ledger entry groups must balance
- Suspended or terminated employees cannot create attendance records
- Attendance records should reference a valid shift assignment when scheduling is enabled

## Recommended Next Step

Create `TECH_STACK_DECISIONS.md` next to lock:

- frontend frameworks and runtime choices
- backend framework and database
- auth provider approach
- payments, messaging, and storage providers
- offline storage and sync strategy
