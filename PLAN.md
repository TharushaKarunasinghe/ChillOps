# ChillOps development plan

Work top to bottom. Tick a box only when its acceptance criteria are met. One task per commit.

## Phase 0: Foundations

- [x] 0.1 Monorepo scaffold. pnpm workspace with `apps/web`, `apps/api`, `packages/shared`. TypeScript strict mode, ESLint, Prettier, Vitest. Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`.
  Acceptance: all root scripts run cleanly on a fresh clone.
- [x] 0.2 Hello world deploy. A `/health` endpoint on a Cloudflare Worker, and a placeholder page on Cloudflare Pages that calls it.
  Acceptance: both deployed and reachable.
- [x] 0.3 CI. GitHub Actions runs lint, typecheck and tests on every pull request and push.
  Acceptance: a green check on GitHub.
- [x] 0.4 Design tokens and base layout. Palette, fonts, spacing scale, app shell (navy sidebar, ice background), and a small kit: button, input, select, table, status label, form field. Follow the design rules in AGENTS.md.
  Acceptance: a style page at `/styleguide` shows every component and state.

## Phase 1: Core jobs

- [x] 1.1 Database schema and migrations (Drizzle): users, technicians, customers, branches, equipment, jobs, job_events, audit_log.
- [x] 1.2a Same-origin deployment
- [x] 1.2 Auth: email and password, httpOnly cookie session, role middleware.
- [x] 1.3 Seed script with synthetic data (fictional customers, branches, technicians).
- [ ] 1.4 Jobs API and pending jobs screen, with the status event log.

## Phase 2: Email intake and AI

- [ ] 2.1 `LLMProvider` wrapper with JSON validation, retry and fallback, tested with mocks.
- [ ] 2.2 Extraction prompt, schema and an evaluation set of 30 or more sample emails, run from the command line.
- [ ] 2.3 Email Worker, raw email stored in R2, processing pipeline, review screen for draft jobs.

## Phase 3: Roster

- [ ] 3.1 Shift types and roster rules in `packages/shared`, tests first.
- [ ] 3.2 Roster grid UI with live validation.
- [ ] 3.3 Roster generator in the browser.
- [ ] 3.4 Adjustment requests, approvals and call-outs.

## Phase 4: Dispatch and technician flow

- [ ] 4.1 Assignment screen with availability and seniority rules, scored suggestions.
- [ ] 4.2 Technician mobile web app: today's jobs, status updates, location.
- [ ] 4.3 Job card photo upload to R2, closure, next nearest pending job.

## Phase 5: Director dashboard

- [ ] 5.1 Metrics and charts from the event log.
- [ ] 5.2 Natural language questions through fixed query tools.

## Phase 6: Inventory (optional)

- [ ] 6.1 Stock ledger, requisition, finance approval, issue, end of day return check.

## Phase 7: Polish

- [ ] 7.1 README with architecture diagram, demo script, reset script for demo data, error states, screen recording.
