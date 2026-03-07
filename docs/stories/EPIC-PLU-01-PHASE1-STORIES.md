# EPIC-PLU-01: Phase 1 Core — CRM + Auth + Multi-tenant

**Epic Lead:** @sm (River)
**Status:** Draft → Ready (awaiting @po validation)
**Timeline:** 4 weeks
**Business Value:** R$30k → R$60k/mês (100% growth + operational CRM)

---

## Story Dependency Map

```
PLU-01.1 (Supabase Auth Setup)
├── PLU-01.2 (Multi-tenant RLS Policies)  [depends on 01.1]
├── PLU-01.3 (Frontend Auth Flow)         [depends on 01.1]
├── PLU-01.4 (Subdomain Routing)          [depends on 01.1, 01.2]
│
├── PLU-01.5 (CRM Dashboard)              [depends on 01.4]
├── PLU-01.6 (Leads CRUD)                 [depends on 01.4]
├── PLU-01.7 (Reservation Calendar)       [depends on 01.4, 01.6]
└── PLU-01.8 (Payment Foundation Prep)    [depends on 01.2]

PLU-01.9 (Quotation Engine Integration)   [depends on 01.6]
PLU-01.10 (RLS Audit + Monitoring)        [depends on 01.2]
```

---

## STORY PLU-01.1: Supabase Auth Setup (Email + Password + JWT)

**Assignee:** @dev
**Status:** Draft
**Type:** Backend Infrastructure
**Complexity:** Large (L) / 13 points
**Timeline:** Days 1-2

### Description

Setup Supabase Authentication with email/password login. Configure JWT tokens to include tenant_id claim for multi-tenant isolation. Implement password recovery and session management endpoints.

### Acceptance Criteria

**Given** a user visits the application
**When** they sign up with email + password
**Then** a Supabase Auth user is created + JWT token returned + token contains tenant_id claim

**Given** a user has a valid JWT
**When** they make an API request
**Then** auth middleware validates JWT + extracts tenant_id + attaches to request context

**Given** a user forgets their password
**When** they click "Forgot Password"
**Then** password reset email sent + link valid for 24h + user can reset + session invalidated

**Given** a user is logged in
**When** they call GET /auth/me
**Then** returns: user_id, email, tenant_id, roles[], expires_at

### Business Value

- ✅ Foundation for all authenticated features
- ✅ Multi-tenant isolation starts here (JWT tenant_id claim)
- ✅ Enables role-based access control (admin, receptionist, analyst)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| Code Review | CodeRabbit --base main (0 CRITICAL issues) | CodeRabbit |
| Unit Tests | 100% coverage for auth endpoints (login, signup, logout, password-reset) | npm test |
| Integration Tests | JWT validation, token refresh, session timeout | npm test |
| Security Review | No secrets in code, password strength validation, rate limiting on login | Manual review |
| Type Check | `npm run typecheck` (100% pass) | TypeScript |
| Lint | `npm run lint` (0 errors) | ESLint |

### Implementation Notes

- Use Supabase JS client + Supabase Auth Helpers (Next.js)
- JWT token structure: `{ sub, email, tenant_id, roles[], iat, exp }`
- Store JWT in httpOnly cookie (security best practice)
- Implement refresh token mechanism (7 day rotation)
- Add rate limiting: 5 attempts / 15 minutes per email on login

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Tenant_id not in JWT | Low | CRITICAL (multi-tenant breaks) | Automated tests verify JWT structure |
| Password reset email fails | Low | Medium | Test email service, add fallback |
| Session timeout too short | Medium | Medium | Set to 24h, add refresh token |
| Brute force attacks | Medium | High | Implement rate limiting + CAPTCHA |

### Dependencies

- ✅ Supabase project created (vwgqhonbbiqubuahkyij)
- ✅ Database schema deployed (001_schema_initial.sql)
- ✅ Next.js project scaffolded

### Files to Create/Modify

- `src/auth/server.ts` — Server auth utilities (login, signup, logout, verify)
- `src/auth/client.ts` — Client auth hooks (useAuth, useSession)
- `src/middleware/auth.ts` — JWT validation middleware
- `src/api/auth/login.ts` — POST /api/auth/login
- `src/api/auth/signup.ts` — POST /api/auth/signup
- `src/api/auth/logout.ts` — POST /api/auth/logout
- `src/api/auth/refresh.ts` — POST /api/auth/refresh
- `tests/auth.test.ts` — Auth unit + integration tests

### Definition of Done

- [ ] All acceptance criteria passing
- [ ] All quality gates passing (CodeRabbit 0 CRITICAL, tests 100%, lint pass)
- [ ] JWT structure verified (tenant_id in token)
- [ ] Password recovery working end-to-end
- [ ] Rate limiting implemented (5/15min on login)
- [ ] Security review passed (no hardcoded secrets, strong password validation)
- [ ] Tests: signup, login, logout, password-reset, refresh-token (4+ test suites)
- [ ] Documentation: README.md updated with auth flow diagram

---

## STORY PLU-01.2: Multi-tenant RLS Policies (Tenant Isolation)

**Assignee:** @dev
**Status:** Draft
**Type:** Backend Infrastructure + Database
**Complexity:** Large (L) / 13 points
**Timeline:** Days 2-3

### Description

Implement Row Level Security (RLS) policies in Supabase to isolate data by tenant_id. Verify that authenticated users can only access their own tenant's data. Add audit logging for all RLS decisions.

### Acceptance Criteria

**Given** a user from tenant A with valid JWT
**When** they query SELECT * FROM leads
**Then** only leads.tenant_id = auth.tenant_id() are returned

**Given** a user from tenant A
**When** they try SELECT * FROM leads WHERE tenant_id = 'B'
**Then** query returns 0 rows (RLS policy blocks)

**Given** an admin user from tenant A
**When** they INSERT a new lead
**Then** lead.tenant_id automatically set to current tenant (not user input)

**Given** a DELETE operation on any table
**When** the operation completes
**Then** audit log records: user_id, table, operation, timestamp, tenant_id

### Business Value

- ✅ Data isolation = Foundation for SaaS scalability (10+ tenants safe)
- ✅ Compliance = Each tenant sees only their own data
- ✅ Auditability = Full trace of who accessed/modified what

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| RLS Policy Review | All 10 tables have RLS enabled + policies tested | Manual inspection |
| Policy Testing | Positive tests (user sees own data) + negative tests (user blocked from other tenant) | SQL tests |
| Audit Logging | All INSERT/UPDATE/DELETE logged + verified | Query audit table |
| Performance | RLS policies add <50ms latency (baseline benchmark) | Query performance test |
| CodeRabbit | SQL code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript interfaces match RLS structure | TypeScript |

### Implementation Notes

- Create RLS policies for: leads, conversations, reservations, proposals, payments, followups, ai_logs, daily_metrics, settings
- Use Supabase function: `auth.user_id()` for current user + custom `auth.tenant_id()` for tenant
- Audit table structure: `audit_logs(id, user_id, table_name, operation, record_id, tenant_id, created_at)`
- Baseline performance: measure query time WITHOUT RLS, WITH RLS, verify difference <50ms

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| RLS blocks legitimate access | Low | CRITICAL | Comprehensive positive/negative test suite |
| Performance degradation >100ms | Low | High | Benchmark baseline, add indexes |
| Audit table grows unbounded | Medium | Low | Retention policy (30d rolling) |
| Tenant_id bypass vulnerability | Very Low | CRITICAL | Code review + penetration test |

### Dependencies

- ✅ PLU-01.1 (Auth setup — JWT with tenant_id in token)
- ✅ Database schema deployed (all tables have tenant_id column)

### Files to Create/Modify

- `database/migrations/003_rls_policies.sql` — RLS policies for all 10 tables
- `database/migrations/004_audit_logging.sql` — Audit table + triggers
- `src/db/rls-test.sql` — Comprehensive RLS test suite (positive + negative cases)
- `src/db/audit-cleanup.sql` — Retention policy (keep 30d of audit logs)

### Definition of Done

- [ ] All 10 tables have RLS enabled
- [ ] Positive tests: user sees own tenant data (passes)
- [ ] Negative tests: user blocked from other tenant data (passes)
- [ ] Audit logging verified for INSERT/UPDATE/DELETE
- [ ] Performance baseline: <50ms overhead per query
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH issues
- [ ] Manual security review passed
- [ ] Documentation: RLS policy explanation + test suite results

---

## STORY PLU-01.3: Frontend Auth Flow (Next.js + Login/Signup Pages)

**Assignee:** @dev
**Status:** Draft
**Type:** Frontend UI
**Complexity:** Medium (M) / 8 points
**Timeline:** Days 3-4

### Description

Build login and signup pages using Next.js + React + TailwindCSS. Integrate with Supabase Auth. Implement protected routes (redirect to login if not authenticated). Add loading states and error handling.

### Acceptance Criteria

**Given** a user navigates to /login
**When** page loads
**Then** shows form: email input + password input + [Login] button + "Forgot password?" link

**Given** a user enters valid credentials + clicks Login
**When** API call succeeds
**Then** JWT stored in httpOnly cookie + redirect to /dashboard

**Given** a user enters invalid credentials
**When** API call fails
**Then** error message displayed: "Invalid email or password" + password field cleared

**Given** a user is logged in + navigates to /login
**When** page loads
**Then** redirect to /dashboard (no need to login again)

**Given** a user is NOT logged in + navigates to /dashboard
**When** page loads
**Then** redirect to /login

### Business Value

- ✅ Professional login experience
- ✅ Self-service signup (reduces manual work)
- ✅ Users can change password + recover forgotten passwords

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| Component Tests | Login form tests (input validation, API call, error handling) | React Testing Library |
| Visual Regression | Login/signup pages match Figma design (if available, or approved design) | Manual visual QA |
| Accessibility | WCAG 2.1 AA (keyboard nav, contrast ratio, labels) | axe accessibility checker |
| E2E Tests | User signup flow (fill form → API success → redirect) | Playwright or Cypress |
| CodeRabbit | React code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript (100% coverage for form components) | TypeScript |
| Lint | `npm run lint` pass | ESLint |

### Implementation Notes

- Use Supabase Auth Helpers for Next.js (useUser, useSession)
- Form validation: email format + password length (min 8 chars)
- Password field: show/hide toggle
- Error display: Toast notifications (top right, auto-dismiss after 5s)
- Protected routes: Middleware to check JWT before rendering

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Password visible in browser console | Low | High | Never log sensitive data, use httpOnly cookies |
| Form validation bypass | Low | Medium | Server-side validation + type checking |
| UX confusion (login vs signup) | Medium | Low | Clear labels, helpful error messages |

### Dependencies

- ✅ PLU-01.1 (Auth endpoints: /api/auth/login, /api/auth/signup)
- ✅ Next.js project structure ready

### Files to Create/Modify

- `src/components/LoginForm.tsx` — Login page component
- `src/components/SignupForm.tsx` — Signup page component
- `src/pages/login.tsx` — Login route
- `src/pages/signup.tsx` — Signup route
- `src/middleware/auth.ts` — Protected route middleware
- `src/hooks/useAuth.ts` — useAuth hook
- `tests/LoginForm.test.tsx` — Component tests
- `e2e/auth-flow.spec.ts` — E2E tests (Playwright)

### Definition of Done

- [ ] Login page loads + renders form
- [ ] Signup page loads + renders form
- [ ] Valid credentials → login success + redirect /dashboard
- [ ] Invalid credentials → error message displayed
- [ ] Protected routes work (redirect /login if not authenticated)
- [ ] All tests passing (unit, component, e2e)
- [ ] Accessibility verified (WCAG 2.1 AA)
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH
- [ ] Visual approved (design QA or manual review)

---

## STORY PLU-01.4: Subdomain Routing + Multi-tenant Request Context

**Assignee:** @dev
**Status:** Draft
**Type:** Backend Infrastructure
**Complexity:** Medium (M) / 8 points
**Timeline:** Days 4-5

### Description

Implement subdomain-based multi-tenant routing. Parse hostname to extract tenant_id from subdomain (empresa1.pousada-luz.com → tenant_id='empresa1'). Attach tenant context to all requests. Validate tenant isolation at middleware layer.

### Acceptance Criteria

**Given** a request to empresa1.pousada-luz.com/dashboard
**When** middleware processes the request
**Then** tenant_id='empresa1' extracted from subdomain + attached to request context

**Given** a request to empresa2.pousada-luz.com/api/leads
**When** API endpoint executes
**Then** only leads belonging to empresa2 returned (RLS enforces isolation)

**Given** a malicious user tries to access empresa1.pousada-luz.com with empresa2 JWT
**When** middleware validates
**Then** request rejected (tenant_id in JWT != subdomain tenant_id)

**Given** a request to localhost:3000 or invalid subdomain
**When** middleware processes
**Then** error response: "Invalid tenant domain" (400 Bad Request)

### Business Value

- ✅ Clean URL structure for SaaS (each tenant has own domain)
- ✅ Automatic tenant isolation (no need to pass tenant_id in each request)
- ✅ Professional appearance (empresa1.pousada-luz.com looks better than param-based)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| Unit Tests | Subdomain parsing logic (valid, invalid, edge cases) | npm test |
| Integration Tests | Full request flow: subdomain → tenant_id → RLS enforcement | npm test |
| Security Tests | Tenant_id mismatch detection, domain validation | npm test |
| CodeRabbit | Middleware code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript middleware + context types | TypeScript |
| Lint | ESLint pass | ESLint |

### Implementation Notes

- Middleware order: subdomain parser → JWT validator → tenant_id match validator
- Subdomain parsing: `req.headers.host.split('.')[0]` (simple) or use library
- Valid subdomains: alphanumeric + hyphen (empresa-1, empresa_2 not allowed — use only empresa1)
- Store tenant_id in request context: `req.context = { tenant_id, user_id, roles }`
- Local development: use `localhost:3000` default tenant or env var for testing

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Subdomain spoofing | Very Low | CRITICAL | Validate JWT matches subdomain tenant_id |
| Wildcard domain issues | Low | High | Use explicit subdomains (pousada-luz.com, *.pousada-luz.com) |
| Development/production confusion | Medium | Medium | Use different TLDs: dev.pousada-luz.local vs pousada-luz.com |

### Dependencies

- ✅ PLU-01.1 (JWT with tenant_id)
- ✅ PLU-01.2 (RLS policies)
- ✅ Next.js API routes set up

### Files to Create/Modify

- `src/middleware/tenant.ts` — Subdomain parser + tenant context middleware
- `src/types/context.ts` — RequestContext interface
- `src/lib/tenant-parser.ts` — Subdomain extraction utility
- `tests/tenant-routing.test.ts` — Unit + integration tests
- `next.config.js` — Verify rewrites/middleware config (if needed)

### Definition of Done

- [ ] Subdomain parsing working (valid domains extracted)
- [ ] Invalid subdomains rejected (400 error)
- [ ] Tenant_id attached to request context
- [ ] Tenant_id mismatch validation working (JWT tenant != subdomain tenant = reject)
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH
- [ ] Documentation: subdomain routing explanation + valid domain format

---

## STORY PLU-01.5: CRM Dashboard (KPIs + Overview)

**Assignee:** @dev
**Status:** Draft
**Type:** Frontend UI + Backend
**Complexity:** Large (L) / 13 points
**Timeline:** Days 5-7

### Description

Build CRM executive dashboard showing KPIs: conversion rate, occupancy, revenue, leads pipeline. Display charts (conversion funnel, daily revenue, room occupancy timeline). Real-time data from database. Responsive design (mobile-friendly).

### Acceptance Criteria

**Given** a user navigates to /dashboard
**When** page loads
**Then** shows 4 KPI cards: Conversion Rate (%), Occupancy (%), Monthly Revenue (R$), Active Leads (count)

**Given** the dashboard is loaded
**When** user views metrics
**Then** data calculated from database (leads, reservations, proposals) + accurate

**Given** a new reservation is created
**When** user refreshes dashboard
**Then** revenue KPI updates immediately + occupancy % recalculated

**Given** a user views conversion funnel chart
**When** page is loaded
**Then** shows stages: new leads → qualified → proposal sent → confirmed + percentage progress at each stage

### Business Value

- ✅ Real-time visibility into sales pipeline
- ✅ Data-driven decision making (know when to lower/raise prices)
- ✅ Motivates team (see conversion improvements month-over-month)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| SQL Queries | Dashboard queries optimized (< 200ms per query) | Database performance test |
| Data Accuracy | KPI calculation verified against raw data | Manual SQL spot-check |
| Chart Libraries | Charts render correctly (no console errors) | Visual regression test |
| Responsive Design | Mobile (375px), Tablet (768px), Desktop (1440px) all work | Responsive testing |
| CodeRabbit | React + SQL code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Component Tests | Dashboard data loading + chart rendering | React Testing Library |
| Type Check | TypeScript 100% coverage | TypeScript |
| Lint | ESLint pass | ESLint |

### Implementation Notes

- Use Chart library: Chart.js (with react-chartjs-2) or Recharts (cleaner for React)
- KPI queries: GROUP BY funnel_stage, date_range = current month + last 3 months
- Real-time updates: Use Supabase Realtime subscriptions (listen for changes on leads/reservations tables)
- Performance: Pre-calculate daily metrics (use stored procedure or scheduled job to avoid slow queries)
- Mobile: TailwindCSS grid responsive (sm:, md:, lg: breakpoints)

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Slow dashboard load (>2s) | Medium | High | Query optimization + caching |
| KPI calculation errors | Low | CRITICAL | Manual spot-check + unit tests |
| Chart library bugs | Low | Low | Use well-maintained library (Recharts) |
| Real-time delays | Low | Medium | Test Realtime subscription performance |

### Dependencies

- ✅ PLU-01.1, 01.2, 01.4 (Auth + RLS + Subdomain routing)
- ✅ PLU-01.6 (Leads data structure)
- ✅ Database schema with conversion funnel data

### Files to Create/Modify

- `src/pages/dashboard.tsx` — Dashboard page
- `src/components/KPICard.tsx` — KPI display component
- `src/components/ConversionFunnel.tsx` — Funnel chart component
- `src/components/RevenueChart.tsx` — Revenue timeline chart
- `src/components/OccupancyChart.tsx` — Room occupancy visualization
- `src/api/metrics/kpis.ts` — GET /api/metrics/kpis (KPI data endpoint)
- `src/hooks/useDashboardData.ts` — Hook for real-time dashboard updates
- `tests/Dashboard.test.tsx` — Component tests
- `database/queries/dashboard-metrics.sql` — Optimized SQL for KPIs

### Definition of Done

- [ ] Dashboard page loads + renders 4 KPI cards
- [ ] KPI values accurate (verified against database)
- [ ] Conversion funnel chart displays correct percentages
- [ ] Revenue chart shows last 30 days trend
- [ ] Occupancy chart shows room utilization
- [ ] Mobile responsive (375px - 1440px all layouts work)
- [ ] Dashboard load time <2s (measured)
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH
- [ ] Realtime updates working (changes reflect within <5s)

---

## STORY PLU-01.6: Leads CRUD (Create, Read, Update, Delete + Filter)

**Assignee:** @dev
**Status:** Draft
**Type:** Frontend UI + Backend
**Complexity:** Large (L) / 13 points
**Timeline:** Days 6-8

### Description

Implement full Leads management: list all leads (paginated, filterable), create new lead, view lead details, update lead status + notes, delete lead. Integrate with RLS (only see tenant's leads). Add conversation history.

### Acceptance Criteria

**Given** a user navigates to /leads
**When** page loads
**Then** shows paginated list of leads (20 per page) + filters: status, date range, source

**Given** a user clicks on a lead
**When** detail view opens
**Then** shows: name, phone, email, status, created_at, notes, conversation history

**Given** a user changes lead status (e.g., new → qualified)
**When** they click Save
**Then** database updates + conversation history appended: "[System] Status changed: new → qualified"

**Given** a user wants to add a note
**When** they type in notes field + press Save
**Then** note saved + timestamp recorded

**Given** a user tries to view lead from different tenant
**When** they manually craft URL /leads/[other-tenant-lead-id]
**Then** 404 error or "Access denied" (RLS enforces)

### Business Value

- ✅ Centralized lead tracking (no more WhatsApp scrolling)
- ✅ Team visibility (everyone sees same lead pipeline)
- ✅ Historical context (conversation history prevents "I told you" confusion)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| CRUD Operations | Create, Read, Update, Delete all work + verified | npm test |
| RLS Isolation | User sees only own tenant's leads (can't access other tenant) | Integration test |
| Pagination | Pagination works (jump to page, next/prev buttons) | Component test |
| Filtering | Filters work correctly (date range, status, source) | Unit test |
| Conversation History | Conversation history displays all messages chronologically | Component test |
| CodeRabbit | Code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript 100% coverage | TypeScript |
| Lint | ESLint pass | ESLint |

### Implementation Notes

- Lead status values: new, qualified, proposal, negotiation, confirmed, lost
- Pagination: offset/limit pattern (page=1, pageSize=20 → offset=0, limit=20)
- Filters: status (select), date_range (date picker), source (checkbox multi-select: whatsapp, facebook, google, referral, organic)
- Conversation history: fetch from conversations table WHERE lead_id = ? ORDER BY created_at ASC
- Bulk actions: select multiple leads + bulk status change

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| RLS bypass (user sees other tenant leads) | Very Low | CRITICAL | RLS integration test + security review |
| Slow list load (100+ leads) | Medium | High | Add database index on (tenant_id, created_at DESC) |
| Conversation history missing | Low | Medium | Query leads + conversations JOIN, verify completeness |

### Dependencies

- ✅ PLU-01.1, 01.2, 01.4 (Auth + RLS + Subdomain routing)
- ✅ Database schema: leads + conversations tables

### Files to Create/Modify

- `src/pages/leads/index.tsx` — Leads list page
- `src/pages/leads/[id].tsx` — Lead detail page
- `src/components/LeadsTable.tsx` — Leads table component (pagination + filters)
- `src/components/LeadForm.tsx` — Create/edit lead form
- `src/components/ConversationHistory.tsx` — Conversation timeline
- `src/api/leads/index.ts` — GET /api/leads (list), POST /api/leads (create)
- `src/api/leads/[id].ts` — GET /api/leads/[id], PUT /api/leads/[id], DELETE /api/leads/[id]
- `tests/LeadsCRUD.test.ts` — CRUD operation tests
- `tests/LeadsRLS.test.ts` — RLS isolation tests

### Definition of Done

- [ ] Leads list page loads + displays leads
- [ ] Pagination working (next/prev, jump to page)
- [ ] Filters working (status, date range, source)
- [ ] Create lead form works (saves to database)
- [ ] Lead detail page shows conversation history
- [ ] Update lead (status, notes) working
- [ ] Delete lead working + confirmation dialog
- [ ] RLS verified (user can't access other tenant leads)
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH

---

## STORY PLU-01.7: Reservation Calendar (Visual + Drag-Drop + Booking)

**Assignee:** @dev
**Status:** Draft
**Type:** Frontend UI + Backend
**Complexity:** Large (L) / 13 points
**Timeline:** Days 8-10

### Description

Build interactive reservation calendar showing room occupancy by date. Drag-drop to create reservations. Click on date range to create new booking. Show availability status (available/reserved/blocked). Confirm booking with guest details.

### Acceptance Criteria

**Given** a user navigates to /calendar
**When** page loads
**Then** shows monthly calendar grid (ALA_A, ALA_B, ALA_C_1, ALA_C_2 rows × dates columns)

**Given** a user clicks on available date (white) in ALA_A row
**When** they select date range (check-in to check-out)
**Then** modal opens: guest details form (name, phone, email, # guests)

**Given** a user fills guest details + clicks Book
**When** API call succeeds
**Then** calendar updates: date range turns green (reserved) + calendar shows guest name on cell

**Given** user hovers over reserved cell
**When** tooltip appears
**Then** shows: guest name, phone, check-in, check-out, total price

**Given** user tries to book dates that are already reserved
**When** they click Book
**Then** error: "Dates not available" (RLS ensures no double-booking)

### Business Value

- ✅ Visual occupancy management (see at a glance which rooms are full)
- ✅ Self-service reservations (guests can book directly)
- ✅ Faster bookings (<1 min vs manual 30 min)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| Calendar Render | Calendar displays all rooms × dates correctly | Component test |
| Drag-Drop | Drag reservation to different dates (updates DB) | E2E test |
| Date Range Selection | Click date → drag to end date → select correctly | Component test |
| Double-Booking Prevention | System prevents overbooking (RLS enforces) | Integration test |
| API Atomicity | create_reservation_atomic RPC succeeds or fails (no partial) | Database test |
| Performance | Calendar load <500ms for 365 days × 4 rooms | Performance test |
| CodeRabbit | Code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript 100% coverage | TypeScript |

### Implementation Notes

- Calendar library: React Big Calendar or FullCalendar (both support drag-drop)
- Color coding: white (available), green (reserved), red (blocked), gray (past date)
- Atomic operation: Use create_reservation_atomic RPC (built in database migrations)
- Price calculation: Call quotation engine to calculate total price before showing confirmation
- Availability data: Query from availability table (already seeded with 1460 rows)

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Double-booking race condition | Low | CRITICAL | Database atomic operation (create_reservation_atomic) |
| Performance slow (100+ reservations) | Low | High | Index on availability (room_type, date), caching |
| Drag-drop UX confusion | Medium | Low | Helpful tooltips, visual feedback during drag |

### Dependencies

- ✅ PLU-01.1, 01.2, 01.4 (Auth + RLS + Subdomain routing)
- ✅ PLU-01.9 (Quotation engine for price calculation)
- ✅ Database: availability table seeded (1460 rows)

### Files to Create/Modify

- `src/pages/calendar.tsx` — Calendar page
- `src/components/ReservationCalendar.tsx` — Calendar grid component
- `src/components/BookingModal.tsx` — Booking form modal
- `src/api/reservations/create.ts` — POST /api/reservations (calls create_reservation_atomic RPC)
- `src/api/reservations/availability.ts` — GET /api/reservations/availability (fetch available dates)
- `src/hooks/useCalendarData.ts` — Hook for calendar state + drag-drop handling
- `tests/Calendar.test.tsx` — Calendar component tests
- `tests/Booking.test.ts` — Booking logic tests (atomicity, double-booking prevention)
- `e2e/calendar-booking.spec.ts` — E2E test (user books reservation via calendar)

### Definition of Done

- [ ] Calendar page loads + displays 4 rooms × date grid
- [ ] Available dates show white, reserved green, blocked red
- [ ] Click date range → booking modal opens
- [ ] Fill guest details → book → calendar updates
- [ ] Hover reservation → tooltip shows guest name + dates
- [ ] Double-booking prevented (error message shown)
- [ ] Calendar load <500ms
- [ ] All tests passing (unit, component, e2e)
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH

---

## STORY PLU-01.8: Payment Foundation Prep (Tables + Webhooks Ready)

**Assignee:** @dev
**Status:** Draft
**Type:** Backend Infrastructure
**Complexity:** Medium (M) / 8 points
**Timeline:** Days 10-11

### Description

Prepare infrastructure for Phase 2 payment integration. Ensure payments table exists + properly configured. Setup webhook endpoint structure (ready for Mercado Pago). Add payment status tracking. Do NOT implement actual payment logic yet.

### Acceptance Criteria

**Given** the system is deployed
**When** a POST request arrives at /api/webhooks/mercadopago
**Then** endpoint returns 200 OK + logs webhook body + stores in webhooks audit table

**Given** a reservation exists
**When** /api/payments/status/{reservation_id} is called
**Then** returns: payment status (pending, processing, confirmed, failed), amount, payment_method

**Given** a payment webhook fails (e.g., network error)
**When** system retries (with exponential backoff)
**Then** webhook is eventually delivered + recorded in audit log

### Business Value

- ✅ Reduces Phase 2 implementation time (infrastructure already ready)
- ✅ No last-minute surprises (RLS policies already configured for payments)
- ✅ Risk mitigation (webhook audit trail available for debugging)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| RLS on Payments | payments table has RLS policies enforced | Security review |
| Webhook Endpoint | POST /api/webhooks/mercadopago exists + returns 200 | API test |
| Audit Logging | Webhook payloads logged to audit table | Manual verification |
| Database Schema | payments table has all required fields (amount, status, external_id, etc) | Schema review |
| Type Check | TypeScript types for webhook payload | TypeScript |
| CodeRabbit | Code review (0 CRITICAL, 0 HIGH) | CodeRabbit |

### Implementation Notes

- Webhook endpoint: POST /api/webhooks/mercadopago (no auth required, Mercado Pago signs request)
- Signature verification: Implement HMAC-SHA256 validation (use Mercado Pago webhook signing key)
- Audit table: webhooks(id, status, payload, signature_valid, created_at, processed_at)
- Payment status values: pending, processing, confirmed, failed, refunded
- Retry logic: Store failed webhooks, retry with exponential backoff (1s, 2s, 4s, 8s, stop)

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Webhook signature forgery | Very Low | CRITICAL | Validate HMAC signature, log failures |
| Duplicate webhook processing | Medium | Medium | Idempotency key (use Mercado Pago transaction ID) |
| Audit table unbounded growth | Medium | Low | Retention policy (keep 90 days) |

### Dependencies

- ✅ PLU-01.1, 01.2, 01.4 (Auth + RLS + Subdomain routing)
- ✅ Database schema: payments table created (in 001_schema_initial.sql)

### Files to Create/Modify

- `src/api/webhooks/mercadopago.ts` — POST /api/webhooks/mercadopago
- `src/api/payments/status.ts` — GET /api/payments/status/[reservation_id]
- `src/lib/mercadopago.ts` — Mercado Pago SDK utilities (signature verification, etc)
- `src/lib/webhook-retry.ts` — Retry logic for failed webhooks
- `database/migrations/005_webhook_audit.sql` — Webhooks audit table
- `tests/WebhookEndpoint.test.ts` — Webhook endpoint tests

### Definition of Done

- [ ] POST /api/webhooks/mercadopago endpoint exists
- [ ] Webhook signature verification implemented
- [ ] Webhook payloads logged to audit table
- [ ] Retry logic implemented (exponential backoff)
- [ ] GET /api/payments/status/[reservation_id] returns payment status
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH
- [ ] Documentation: webhook structure + signature verification explained

---

## STORY PLU-01.9: Quotation Engine Integration (Link Backend to Frontend)

**Assignee:** @dev
**Status:** Draft
**Type:** Backend API
**Complexity:** Medium (M) / 8 points
**Timeline:** Days 7-8

### Description

Expose quotation engine via API endpoint. Call quotation engine when user selects reservation dates + room type. Return price breakdown + discounts. Used by Calendar booking flow.

### Acceptance Criteria

**Given** a user selects dates: 2026-03-10 to 2026-03-15 + room type ALA_A
**When** they click "Calculate Price"
**Then** API returns: gross_amount, discount_pct, discount_amount, final_amount, deposit_amount

**Given** a user books 7+ nights
**When** price is calculated
**Then** 10% discount applied automatically

**Given** a user books 14+ nights
**When** price is calculated
**Then** 15% discount applied automatically

**Given** dates fall in high-season (Dec-Jan)
**When** price calculated
**Then** high-season rates applied (R$400/night base)

### Business Value

- ✅ Instant quote response (vs manual 30 min wait)
- ✅ Transparent pricing (customers see exact price before booking)
- ✅ Reduced back-and-forth (no negotiation, price is clear)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| Price Accuracy | Price calculation matches business rules (discounts, seasons) | Unit test |
| Discount Logic | 7+ night = 10%, 14+ night = 15% (verified) | Unit test |
| Season Detection | High-season dates (Dec, Jan, etc) return correct prices | Unit test |
| API Performance | Quotation API responds in <500ms | Performance test |
| CodeRabbit | Code review (0 CRITICAL, 0 HIGH) | CodeRabbit |
| Type Check | TypeScript 100% coverage | TypeScript |

### Implementation Notes

- Quotation engine already exists in `src/quotation/engine.js` (from earlier work)
- API wrapper: POST /api/quotations with payload: { room_type, checkin_date, checkout_date, guests }
- Response: { gross_amount, discount_pct, discount_amount, final_amount, deposit_amount, breakdown: [...] }
- Deposit = 30% of final_amount (configurable in settings table)
- Call quotation engine, NOT database (single source of truth)

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Price mismatch (API ≠ booking) | Low | High | Unit test coverage for all discount scenarios |
| High-season date detection bug | Medium | Medium | Test edge cases (Dec 31, Jan 1, etc) |

### Dependencies

- ✅ PLU-01.1, 01.2, 01.4 (Auth + RLS + Subdomain routing)
- ✅ Quotation engine already implemented (src/quotation/engine.js)

### Files to Create/Modify

- `src/api/quotations/calculate.ts` — POST /api/quotations
- `tests/QuotationAPI.test.ts` — API tests (discount logic, season detection)

### Definition of Done

- [ ] POST /api/quotations endpoint exists
- [ ] Price calculated correctly (base + discounts + seasons)
- [ ] 7+ night discount (10%) applied
- [ ] 14+ night discount (15%) applied
- [ ] High-season rates applied correctly
- [ ] API responds <500ms
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH

---

## STORY PLU-01.10: RLS Audit + Monitoring (Database Security Verification)

**Assignee:** @dev
**Status:** Draft
**Type:** Backend Infrastructure + Security
**Complexity:** Medium (M) / 8 points
**Timeline:** Days 11-12

### Description

Verify all RLS policies are active. Create monitoring dashboard showing: # of RLS violations attempted, audit log for all DDL changes, performance impact of RLS. Baseline security measurements.

### Acceptance Criteria

**Given** the system is running
**When** admin views /admin/rls-audit
**Then** shows: # of tables with RLS enabled (should be 10), # of policies per table, last tested timestamp

**Given** a user attempts to access another tenant's data
**When** the query executes
**Then** RLS blocks it + logs attempt: user_id, table, timestamp, attempt_type (select/insert/update/delete)

**Given** admin views audit logs
**When** they filter by table
**Then** shows all attempts to bypass RLS (sorted by timestamp, newest first)

**Given** baseline performance test run
**When** queries execute with RLS
**Then** latency overhead measured (should be <50ms per query)

### Business Value

- ✅ Security assurance (verifiable that multi-tenant isolation is working)
- ✅ Compliance (audit trail for security reviews)
- ✅ Performance visibility (know if RLS is causing slowdowns)

### Quality Gates (MANDATORY)

| Gate | Definition | Tools |
|------|-----------|-------|
| RLS Coverage | 100% of production tables have RLS enabled | SQL query check |
| Audit Logging | All RLS violations logged + queryable | Audit table inspection |
| Performance Baseline | RLS overhead <50ms per query (measured) | Query performance test |
| Access Controls | /admin/rls-audit only accessible to tenant admin | Authorization test |
| CodeRabbit | Code review (0 CRITICAL, 0 HIGH) | CodeRabbit |

### Implementation Notes

- RLS audit query: `SELECT tablename, COUNT(*) as policy_count FROM pg_policies GROUP BY tablename ORDER BY tablename;`
- Violation logging: Trigger on SELECT/INSERT/UPDATE/DELETE that logs deny attempts
- Performance baseline: Run test queries 1000x with/without RLS, measure avg latency
- Admin page: /admin/rls-audit (protected by role-based access, admin only)

### Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| RLS disabled accidentally | Low | CRITICAL | Monitoring alerts if RLS drops |
| Audit table noise (too many violations) | Low | Low | Normal (expected if users try invalid queries) |
| Performance regression hidden | Low | Medium | Baseline measurements + alerts if latency >100ms |

### Dependencies

- ✅ PLU-01.1, 01.2 (Auth + RLS policies)

### Files to Create/Modify

- `src/pages/admin/rls-audit.tsx` — RLS audit dashboard
- `src/api/admin/rls-status.ts` — GET /api/admin/rls-status (RLS policy status)
- `src/api/admin/rls-violations.ts` — GET /api/admin/rls-violations (audit log)
- `database/migrations/006_rls_monitoring.sql` — RLS violation triggers + monitoring tables
- `tests/RLSAudit.test.ts` — Tests for RLS audit functionality

### Definition of Done

- [ ] /admin/rls-audit page loads + displays RLS status
- [ ] All 10 tables show RLS enabled
- [ ] Violation attempts logged + visible in audit log
- [ ] Performance baseline measured + documented
- [ ] Admin-only access enforced (non-admin users can't access)
- [ ] All tests passing
- [ ] CodeRabbit 0 CRITICAL, 0 HIGH

---

## SUMMARY

**Total Stories:** 10
**Total Points:** ~100 (13×2 + 8×8 = 100)
**Timeline:** 4 weeks (Feb-Mar 2026)
**Team Size:** 1 @dev (can parallelize as 2-3 developers if available)

**Delivery Order:**
1. **Days 1-2:** PLU-01.1 (Auth)
2. **Days 2-3:** PLU-01.2 (RLS)
3. **Days 3-4:** PLU-01.3 (Frontend Auth)
4. **Days 4-5:** PLU-01.4 (Subdomain Routing)
5. **Days 5-7:** PLU-01.5 (Dashboard) + PLU-01.9 (Quotation API, parallel)
6. **Days 6-8:** PLU-01.6 (Leads CRUD)
7. **Days 8-10:** PLU-01.7 (Calendar)
8. **Days 10-11:** PLU-01.8 (Payment Prep)
9. **Days 11-12:** PLU-01.10 (RLS Audit)

**Validation Gate:** @po validates all stories before @dev starts. All stories transition: Draft → Ready (after validation) → InProgress (dev) → InReview (QA) → Done (@devops push).

**Next:** Awaiting @po validation of all 10 stories. Then @dev can begin implementation day 1.
