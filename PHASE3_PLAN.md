# Phase 3 Plan

## Summary

Phase 3 is the product-expansion phase after the operational core from phase 1 and the deeper operations tooling from phase 2.

This phase should focus on:

- commercial differentiation
- better customer and staff experience
- stronger tenant retention
- deployment hardening for real hosted use

Phase 3 is **not started yet** in a formal implementation sense. This document defines what should count as phase 3, what should come first, and what should wait until the hosting model can support it safely.

## Starting Point

Already complete before phase 3:

- `Phase 1`: operational MVP
- `Phase 2`: expanded workforce, finance, procurement, waitlist, and reporting

Current architecture constraints:

- mobile apps are `Expo`
- backend runtime is `PHP + MySQL`
- primary deployment target is `cPanel shared hosting`
- no persistent Node runtime should be assumed for production

That means every phase 3 feature should be judged against two questions:

1. does it materially improve tenant value or retention?
2. can it run safely on the current hosting model?

## Phase 3 Goals

### 1. Commercial Maturity

Make the platform more valuable as a SaaS business, not just as an internal operations tool.

Target outcomes:

- better plan differentiation
- stronger enterprise upsell path
- better billing and payout controls
- higher tenant retention

### 2. Experience Maturity

Improve the user experience for staff, owners, and customers where the current flows are functional but still basic.

Target outcomes:

- faster front-desk operation
- better planning views
- better customer self-service
- less operational friction

### 3. Deployment Maturity

Reduce the risk of production problems on hosted MySQL and cPanel.

Target outcomes:

- safer migrations
- stronger backup and rollback process
- scheduled cron-based jobs that match the hosting model
- clearer deployment playbooks

## Phase 3 Workstreams

### 1. Public Web Polish

Current state:

- routes exist
- content is present
- the experience is still starter-level

Phase 3 scope:

- stronger landing page content
- better feature storytelling by persona
- launch-ready pricing page
- demo request flow
- contact flow
- FAQ and help refinement
- clearer app screenshots and product messaging

Definition of done:

- public site feels launch-ready
- core conversion paths work
- content matches the actual implemented product

### 2. Calendar And Scheduling UX

Current state:

- bookings work
- shifts work
- waitlist works
- current views are functional, not premium

Phase 3 scope:

- richer branch calendar
- reschedule UX
- cancellation UX
- staff availability view
- room utilization view
- overlap visibility
- optional visual room mapping

Definition of done:

- reception and managers can manage a day or week visually instead of only through list-based flows

### 3. POS And Front-Desk Commerce Depth

Current state:

- booking and appointment progression exists
- product and inventory basics exist
- billing and ledger basics exist

Phase 3 scope:

- POS sale flow
- mixed service + product checkout
- discounts and overrides
- split payments
- refunds
- gift cards
- packages and memberships

Definition of done:

- front desk can close out real customer transactions without leaving the system

### 4. GPS And Device-Side Attendance Hardening

Current state:

- approved network validation exists
- offline queue exists
- GPS validation is still absent

Phase 3 scope:

- optional GPS radius enforcement
- stronger exception flags for mismatch cases
- device-level attendance diagnostics
- policy controls for network-only vs network-plus-GPS attendance

Definition of done:

- attendance can be hardened beyond manual network validation where tenants need it

### 5. Reporting And Analytics Expansion

Current state:

- phase 2 reporting is useful but operationally focused

Phase 3 scope:

- richer revenue reporting
- customer retention and rebooking reports
- service performance reports
- staff productivity benchmarking
- branch comparison reports
- superadmin tenant health scorecards

Definition of done:

- owners and superadmins can spot operational problems and commercial trends without exporting raw data first

### 6. Whitelabel And Tenant Branding

Current state:

- planned in earlier strategy docs
- not implemented

Phase 3 scope:

- tenant logo and color branding
- branded customer-facing surfaces
- optional custom domain support for enterprise tier
- theme profiles and brand assets

Definition of done:

- enterprise tenants can make the customer experience feel like their own brand

### 7. Advanced Billing, Entitlements, And Payouts

Current state:

- plan basics, invoices, payments, and module toggles exist

Phase 3 scope:

- add-on billing
- quota dashboards
- plan comparison and upgrade path improvements
- proration refinement
- payout settlement flows if the platform processes money for tenants
- financial reconciliation reports

Definition of done:

- the SaaS business model is flexible enough for tiered monetization and clearer finance operations

### 8. Marketing Automation And Loyalty

Current state:

- notifications exist
- customer accounts exist

Phase 3 scope:

- retention campaigns
- birthday and lapse campaigns
- referral tracking
- loyalty balances
- targeted promotional messaging

Definition of done:

- tenants can use the system for growth and retention, not only operations

### 9. AI-Assisted Features

Current state:

- only conceptual

Phase 3 scope:

- AI booking gap suggestions
- schedule optimization hints
- tenant health insights
- demand and staffing suggestions

Important note:

- AI features should come after the data quality, analytics, and cron/job maturity are strong enough

Definition of done:

- AI features produce actionable suggestions instead of novelty outputs

### 10. Deployment Hardening

Current state:

- local smoke tests and typechecks are in place
- shared-hosting-compatible runtime is in place

Phase 3 scope:

- hosted migration runbook
- rollback plan
- cron job definitions
- backup verification
- storage path hardening
- production env checklist
- deployment validation checklist

Definition of done:

- a real hosted deployment can be repeated safely and consistently

## Recommended Priority Order

### Priority 1

- deployment hardening
- public web polish
- calendar and scheduling UX

Reason:

- these improve launch readiness immediately without requiring the riskiest domain expansion

### Priority 2

- POS and front-desk commerce depth
- reporting and analytics expansion
- GPS attendance hardening

Reason:

- these deepen operational value for active tenants

### Priority 3

- whitelabel and branding
- advanced billing and payouts
- marketing automation and loyalty

Reason:

- these are strong commercial differentiators, but they are easier to execute after the launch and deployment layers are cleaner

### Priority 4

- AI-assisted features

Reason:

- this should sit on top of strong data and reporting, not replace them

## What Not To Rush

- do not build features that require a persistent Node runtime in production
- do not introduce infrastructure that cPanel cannot support unless the hosting model changes
- do not overbuild AI before analytics and data quality are reliable
- do not add payout complexity before ledger and billing workflows are fully deployment-tested

## Suggested Phase 3 Milestones

### Milestone A: Launch Hardening

- deployment runbook
- hosted migration checklist
- cron-backed recurring jobs
- public web polish
- production env review

### Milestone B: Scheduling And Front Desk

- richer calendar
- reschedule and cancel UX
- room/staff planning improvements
- POS foundation

### Milestone C: Commercial Expansion

- whitelabel branding
- advanced entitlements
- quota dashboards
- add-on billing
- payout groundwork

### Milestone D: Growth And Intelligence

- loyalty and referral tooling
- retention automation
- analytics expansion
- AI suggestions

## Recommended Definition Of "Phase 3 Complete"

We should only call phase 3 complete when all of the following are true:

- launch and deployment are hardened for real hosted use
- public web is launch-ready
- scheduling UX is materially improved
- front-desk commercial flow is stronger
- reporting is deeper
- at least one commercial differentiator is live beyond phase 2

## Practical Next Step

The deployment runbook now exists in:

- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)

The launch-readiness artifact now exists in:

- [PUBLIC_WEB_PHASE3.md](PUBLIC_WEB_PHASE3.md)

The next strongest implementation move is:

- rebuild the actual public-web homepage and pricing surfaces

After that, the next planning artifact should be:

- `CALENDAR_UX_PLAN.md`
