# Public Web Phase 3

## Summary

The public web app already exists, but it is still a starter shell.

Current routes are present:

- `/`
- `/features`
- `/pricing`
- `/help`
- `/contact`
- `/login`
- `/signup`

Phase 3 should turn that shell into a launch-ready acquisition surface that:

- explains the product clearly
- supports pricing and plan comparison
- gives prospects a real contact and demo path
- matches the product that actually exists in the repo

## Current State

### What exists

- basic homepage hero
- basic feature page
- basic pricing page
- starter help page
- starter contact page
- login and sign-up entry routes

### What is still missing

- stronger product positioning
- screenshots or product walkthrough sections
- role-based storytelling
- full pricing comparison
- real demo request flow
- real contact flow
- FAQ depth
- launch-quality visual polish

## Phase 3 Goals

### 1. Clear Positioning

Anyone landing on the site should understand in seconds that AdeyApp is:

- a spa operations platform
- multi-tenant
- built for owners, managers, receptionists, employees, customers, and platform operators

### 2. Strong Conversion Paths

The site should drive visitors toward:

- sign-up
- demo request
- contact sales
- support/help discovery

### 3. Honest Product Messaging

The public site should reflect what the product really does now, not what is only planned for later.

### 4. Static-Friendly Delivery

The public web should remain compatible with static export or simple browser hosting so it stays aligned with the no-Node production constraint.

## Recommended Site Structure

### 1. Home

Primary sections:

- hero with one clear value proposition
- proof of scope by persona
- operations highlights
- platform highlights
- why it fits multi-branch spas
- pricing entry section
- FAQ preview
- CTA footer

Primary CTA:

- `Start onboarding`

Secondary CTA:

- `Book a demo`

### 2. Features

Break the page by persona instead of only by module.

Recommended sections:

- owners
- managers
- receptionists
- employees
- customers
- superadmin / platform team

Each section should map product value to real implemented features.

### 3. Pricing

Turn the current three-tier shell into a real comparison page.

Recommended structure:

- top-level plan summary cards
- feature comparison matrix
- quota examples
- module and add-on callouts
- enterprise contact CTA
- billing FAQ

Recommended plan posture:

- `Starter`
- `Growth`
- `Enterprise`

### 4. Help

Turn the help page into a lightweight support hub.

Recommended sections:

- getting started
- owner onboarding help
- booking and front-desk help
- attendance and staff help
- billing help
- support ticket/contact handoff

### 5. Contact

Make this a real conversion route.

Recommended sections:

- demo request
- sales contact
- support contact
- expected response times

### 6. Login And Signup

These routes should become true handoff pages, not placeholders.

Recommended behavior:

- explain whether the user belongs in tenant app, customer app, or superadmin
- give clear “who are you?” entry points
- avoid confusing first-time public visitors

## Messaging Direction

### Hero message

The current hero is directionally correct, but phase 3 should sharpen it around a clearer promise:

- one system for bookings, staff, branches, attendance, and customer care
- built for spa operations, not generic business admin

### Tone

- calm
- operationally confident
- premium but not vague
- practical rather than hype-heavy

### Proof points

Use sections that reflect real implemented capabilities:

- multi-branch setup
- receptionist booking and waitlist
- employee attendance and shift logic
- customer self-booking
- superadmin billing and support operations

## Content Blocks To Build

### Homepage Blocks

- hero
- role strip
- “what you can run from AdeyApp”
- branch operations section
- staffing and attendance section
- customer experience section
- platform control section
- pricing teaser
- FAQ teaser
- final CTA

### Features Blocks

- owner controls
- manager branch operations
- reception front-desk flow
- employee attendance and work records
- customer booking and notifications
- superadmin control and billing

### Pricing Blocks

- plan card row
- comparison matrix
- quotas and entitlement examples
- “best for” labels
- contact-sales CTA

### Help Blocks

- onboarding articles list
- billing help
- policy and attendance help
- support escalation CTA

### Contact Blocks

- demo request form
- support form
- direct email/contact options

## UX Priorities

### Priority 1

- clearer copy
- better structure
- stronger CTA placement
- pricing clarity

### Priority 2

- screenshots or mock product panels
- stronger typography and spacing
- polished FAQ layout

### Priority 3

- richer animation
- customer stories or case-study sections
- interactive plan calculator

## Technical Delivery Rules

- keep the public site static-friendly
- avoid server-only dependencies that block simple hosting
- use content that can later be migrated to CMS or structured config
- keep forms compatible with PHP-backed endpoints or external form handling

## Non-Goals For This Slice

- do not build a full CMS first
- do not overcomplicate animations
- do not market features that are not implemented or clearly marked as upcoming
- do not rely on Node SSR for the production path

## Recommended Implementation Order

1. rewrite homepage content and structure
2. replace pricing placeholder with a comparison page
3. build real contact/demo route
4. expand help route into a support hub
5. improve login/signup handoff pages
6. polish visual system and screenshots

## Acceptance Criteria

The public-web phase 3 slice should be considered complete when:

- homepage clearly explains the product and who it is for
- pricing page helps a prospect understand the tiers
- contact page supports demo and sales outreach
- help page is no longer placeholder copy
- login/signup pages reduce role confusion
- content matches implemented product reality
- site remains compatible with static-friendly hosting

## Practical Next Step

The best implementation move after this document is:

- rebuild `apps/public-web/app/page.tsx`

That should be followed by:

- `apps/public-web/app/pricing/page.tsx`
- `apps/public-web/app/contact/page.tsx`
- `apps/public-web/app/help/page.tsx`

