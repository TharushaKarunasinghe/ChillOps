# ChillOps

Operations software for refrigeration and air conditioning service work. All project data must be synthetic.

## Setup

Use Node.js 24.16.0 (see `.nvmrc`) or newer and pnpm 12.21.0, pinned in `package.json`. The supported minimum is 24.16.0 in `engines.node`; CI reads the same version from `.nvmrc`. Direct TypeScript imports need Node's type stripping, enabled without flags from 22.18; this project standardizes on the tested Node 24 LTS version. No TypeScript runner is needed.

Run these commands from the repository root in Windows PowerShell. Copy the examples once; keep any existing local settings.

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars
pnpm dev
```

`pnpm dev` builds web assets only when `apps/web/dist` does not exist, then starts Vite at `http://localhost:5173` and Wrangler at `http://localhost:8787` in parallel. Vite proxies `/api` to Wrangler without changing the path. Open the Vite URL for live web development; stop both with Ctrl+C. Wrangler serves the last built web assets when opened directly.

`apps/api/.dev.vars` holds private database configuration. No web environment file is needed. Existing local files are not modified: remove obsolete `WEB_ORIGIN=...` from `apps/api/.dev.vars` and `VITE_API_URL=...` from `apps/web/.env.local` yourself, preserving any other settings.

## Workspace

- `apps/web`: React app and styleguide, using relative `/api/health` requests and `@chillops/shared`.
- `apps/api`: Hono Worker with public `GET /api/health` returning `{ "status": "ok" }`, authentication, and the built web assets. API routes require a session unless explicitly public; authenticated unknown paths return JSON 404 responses.
- `packages/shared`: shared TypeScript exports and a workspace smoke test.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Lint includes ESLint and Prettier checks. Typechecking covers root configuration and all three packages. Vitest checks API routing, shared exports, database schema and design contrast. Build runs shared, then web, then the Worker dry-run in order so its assets directory is ready. CI already calls this root build script; it does not deploy or require Cloudflare login.

The browser uses relative `/api/...` URLs on the same origin as the web app. No CORS middleware or origin environment variables are needed. Static asset routing serves the SPA while `/api` and `/api/*` run the Worker first. An unauthenticated API request returns JSON 401; an authenticated unknown route returns JSON 404, including when opened directly in a browser.

## Design system

Open `/styleguide` while running `pnpm dev` to review tokens, typography, spacing, all six status labels, native form controls, button states and a fictional job table. `/` retains the API health check. On narrow screens, use the Menu button to open navigation; Escape closes it and restores focus. Placeholder operations entries are non-interactive and marked Not built yet.

Colors live in `apps/web/src/styles/tokens.css` and map into a restricted Tailwind CSS theme. Use the named spacing steps and semantic colors instead of arbitrary utilities. Text uses IBM Plex Sans; IDs, times and quantities use IBM Plex Mono. Only Latin normal 400, 500 and 600 font files are imported, with `font-display: swap`.

Run `pnpm design:contrast` with Node.js 24 from `.nvmrc` after changing tokens. This generates [the contrast report](docs/design-contrast.md) from the CSS values through `apps/web/src/design/contrast.ts`. Root `pnpm test` checks the text and non-text ratios and fails if the report is stale. Decorative status tints are listed for reference; meaning is always conveyed by their text labels.

## Database schema and migrations (task 1.1)

The nine tables are defined in `apps/api/src/db/schema.ts`. Drizzle ORM supplies the typed schema and queries, `@neondatabase/serverless` supplies HTTP and WebSocket transports, and drizzle-kit generates the SQL and migration metadata. No database connection is needed for generation, tests or builds.

Use Node.js 24 from `.nvmrc`. Set `DATABASE_URL` privately in `apps/api/.dev.vars`, or in your shell environment; an environment value takes precedence. Keep credentials out of commands, screenshots and commits. Tooling prints only the database hostname and suppresses raw driver errors.

Run these commands from the repository root in PowerShell:

```powershell
# Offline: generate a migration after an approved schema change.
pnpm --filter @chillops/api db:generate

# Review every SQL file in apps/api/drizzle before applying it.
# This command writes to the selected database. Check the printed hostname.
pnpm --filter @chillops/api db:migrate

# After migration, verify constraints with synthetic fixtures and roll them back.
pnpm --filter @chillops/api db:verify-schema
```

Migration and verification are manual, never part of CI or application startup. Both use the Neon driver's WebSocket connection and Node's built-in WebSocket support. The migration runner sets UTC on its session; PostgreSQL `timestamptz` stores instants regardless of the session display timezone. Mutable tables update `updated_at` with database triggers.

Verification checks cross-customer branches, cross-branch equipment, contact ownership, coordinate pairing, case-insensitive user email uniqueness, nullable system actors, the manual actor requirement, job-number generation, and rejection of UPDATE, DELETE and TRUNCATE on `job_events`. It uses savepoints and an outer `ROLLBACK`, even on failure. Fixture rows do not persist, but PostgreSQL sequence increments are not transactional: verification can leave gaps in job numbers. Run it against a development branch while no other work is using it; the TRUNCATE rejection check briefly requests a table lock, bounded by a five-second lock timeout.

`0000_core_schema.sql` is generated from the Drizzle schema. `0001_database_guards.sql` is a drizzle-kit custom migration for database triggers, which Drizzle's table declarations do not express. Root tests inspect the offline schema and migration guards; only the manual verification command proves enforcement against PostgreSQL. The runtime HTTP client is an unconnected factory until used and does not connect when serving `/api/health`.

## Authentication (task 1.2)

`/login` and `/styleguide` are public web routes. Other pages wait for the single initial `/api/auth/me` request and require a session. The top bar shows the signed-in user's name, role and Log out button. All API responses use `Cache-Control: no-store`; passwords and bearer tokens are never stored in browser storage.

Before using authentication, review `apps/api/drizzle/0003_authentication.sql`, then run these commands yourself from the repository root. They write to the database selected by private `DATABASE_URL` in `apps/api/.dev.vars` or your environment:

```powershell
pnpm --filter @chillops/api db:migrate
pnpm --filter @chillops/api auth:create-user
```

User creation requires a real interactive terminal, rejects command-line arguments, and prompts for a synthetic full name, email, role and hidden password. Passwords are normalized to Unicode NFC and must contain 12 to 128 Unicode characters, with no composition rules. The script reports the target hostname and created email; it does not echo passwords or print hashes or connection strings. This is an explicit operator command, not a seed script or public registration endpoint.

Run `pnpm dev` and open `http://localhost:5173/login`. Localhost uses a `session` cookie; HTTPS uses `__Host-session`. Both are HttpOnly, Secure, SameSite=Lax, Path=/, with no Domain. Use literal `localhost` for local browser testing. Sessions expire after 12 hours idle or 7 days absolute, and last-seen writes occur no more than once every five minutes. Successful login creates a fresh session and revokes any carried old session; logout revokes the current session.

`POST /api/auth/login` accepts `{ "email": "...", "password": "..." }`; `POST /api/auth/logout` accepts `{}`. Every non-GET API request must send an Origin exactly equal to the request origin, including scheme and port. Browsers supply this automatically. `GET /api/auth/me` returns public user fields or 401. Authentication applies by default to all API paths; only GET health and POST login are public. Protected feature routes can additionally use `requireRole(...roles)`.

The Vite proxy explicitly sets `changeOrigin: false` to preserve the browser-facing Host. This lets the Worker apply the same exact Origin check locally and in production, without origin rewriting or a development allowlist.

Login protection reserves both an email attempt and an IP attempt before hashing. The sixth email attempt or twenty-first IP attempt within 15 minutes receives the same 429 message. Successful login clears only that email's attempts; IP attempts remain. Each login reservation removes attempts older than 24 hours. Missing or invalid `CF-Connecting-IP` uses a shared fallback bucket and stores NULL in the session's inet column. Only Cloudflare's header is used, never X-Forwarded-For.

Passwords use Web Crypto PBKDF2-SHA256 with the named 100,000-iteration policy, random 16-byte salts and a 32-byte result. Stored records include algorithm, cost, salt and hash. Successful login upgrades a differing stored cost in the same transaction as session creation and audit. Run the offline benchmark with:

```powershell
pnpm auth:benchmark
```

It prints mean and worst wall-clock time over 20 hashes and one unknown-email failed login, using an in-memory repository. It never loads DATABASE_URL or contacts a database. These Node timings are not production Worker CPU measurements: the Free plan allows 10 ms CPU per request, so maximum-cost password hashing may require Workers Paid. The isolated local workerd probe accepted 100,000, 100,001 and 1,000,000 iterations; local acceptance above 100,000 does not prove the production limit has changed.

Production also needs `DATABASE_URL` as a Worker secret; `.dev.vars` is local only. Set it interactively yourself, without putting the value in command arguments, and release only after the migration and account are ready:

```powershell
pnpm --filter @chillops/api exec wrangler secret put DATABASE_URL
pnpm run release
```

No migration, user creation or deployment is performed by tests, benchmarks, build or CI. Database tests use fake repositories or intercepted HTTP requests; live SQL enforcement and production CPU remain manual checks.

## Synthetic demo data (task 1.3)

After applying the existing migrations, run these commands yourself from the repository root:

```powershell
pnpm --filter @chillops/api db:seed
pnpm --filter @chillops/api db:seed:check

# Deletes this dataset and the seeded users' sessions and audit history.
pnpm --filter @chillops/api db:seed:reset --allow-append-only-bypass
```

Seed and reset print the database hostname and require you to type it exactly before any writes. Seed asks for one demo password twice with hidden input, using the existing 12 to 128 character NFC password validation and API password hasher. Passwords cannot be passed as arguments. Each new account gets its own random salt. Use an interactive terminal. Successful seed/reset commands print no row data; a nonzero exit means failure. Check prints table counts and PASS/FAIL results in a read-only transaction.

The fixture contains 15 users (2 ops, 1 finance, 1 storekeeper, 1 director, 10 technicians), 10 technician profiles (4 senior, 6 junior), 5 customers, 14 branches, 45 equipment items, 21 email contacts, 30 jobs and 130 events. It creates no sessions, audit entries, login attempts, roster, assignment or inventory data.

| Customer              | Branches | Equipment |
| --------------------- | -------: | --------: |
| Frostfern Markets     |        4 |        15 |
| Cloudberry Grocers    |        3 |        10 |
| Moonwell Picturehouse |        2 |         6 |
| Driftwillow Hotels    |        3 |         8 |
| Silvermoss Pharmacies |        2 |         6 |

Scenarios: six recent unassigned breakdowns (two critical), four pending jobs with reasons, and twenty completed jobs over sixty days (twelve breakdowns, eight planned services). One freezer has three breakdowns within six weeks; Frostfern has twelve of the twenty-two breakdowns. One completed job includes a pending/reassigned revisit. Two Frostfern branches deliberately share an extra contact address. Jobs mix email/system intake and manual/ops intake. Travel and site events include nearby coordinates. Visit durations vary by priority and fixed-seed jitter.

Names, phones and branch names are fictional; addresses are area names only. Staff emails use `chillops.test`, customer emails use `.example`. Inspect the complete fixture in `apps/api/src/seed/data.ts`. The named staff include Mira Vale, Oren Finch, Tavi Reed, Nela Moss and Lio Wren; email addresses follow `first.last@chillops.test`.

Times are relative to the seed run, mostly 08:00 to 18:00 Asia/Colombo, with some evening calls and no Sundays. On Sunday, recent jobs use Saturday slots within the last 24 hours; near midnight several different jobs can share a report time. Event times within each job remain strictly increasing. Existing fixed-ID rows, passwords and dates are left unchanged on reruns. Existing job IDs are read under a table lock before inserts, so reruns never evaluate their sequence defaults. New jobs are inserted in ascending `reported_at` order. Job numbers are database-generated and may differ after reset; rollbacks can leave normal sequence gaps. Rerunning an older dataset does not refresh its ages. Reset then seed to refresh it.

Reset uses one transaction, checks that both append-only guards are enabled, locks affected tables, disables only the named guards, deletes its fixed IDs in dependency order, then re-enables guards before commit. It also deletes **all sessions and actor-owned audit rows for seeded users, including rows created later by real logins**. Login attempts and unrelated users are untouched. Non-seed foreign-key references cause reset to fail and roll back; they are never silently cascaded. If a guard is already disabled or missing, reset refuses to proceed. Transaction rollback restores guard state on failure, including connection loss.

The scripts reuse Neon `Pool` transactions with `neonConfig.webSocketConstructor = globalThis.WebSocket`, supplied by Node 24, without a `ws` dependency. See [Neon's driver configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md) and [Node type stripping](https://nodejs.org/api/typescript.html). Unit tests exercise transaction ordering and rollback using fake clients; they do not prove live connectivity or privileges. None of these database commands runs in CI, startup, tests or build.

## CI

The `CI` workflow runs on pull requests and pushes to `main`. It reads the pnpm version from `package.json` and the Node.js version from `.nvmrc`, caches the pnpm store, and installs with a frozen lockfile. Lint, Typecheck, Test and Build run as separate named steps on Ubuntu.

Runs have read-only repository permissions and a ten-minute timeout. New runs cancel older runs for the same branch or pull request. `.gitattributes` specifies LF line endings for text files across Windows and Linux. No deployment or secrets are configured; the API build uses Wrangler's local dry-run mode without Cloudflare login. View results under the repository's **Actions** tab or the pull request checks.

## Manual release (Windows PowerShell)

Run these commands from the repository root. Authenticate if needed, then release the web app and API together:

```powershell
pnpm --filter @chillops/api exec wrangler login
pnpm run release
if ($LASTEXITCODE -ne 0) { throw 'Release failed.' }
```

`pnpm run release` builds the web app first, then runs Wrangler deploy only if that build succeeds. Use `run release` explicitly; pnpm has its own built-in `deploy` command. Wrangler uploads `apps/web/dist` with the Worker, using the path `../web/dist` relative to `apps/api/wrangler.toml`. Database migrations remain separate and manual.

Verify the Worker URL printed by Wrangler:

```powershell
$workerUrl = (Read-Host 'Paste the https://...workers.dev URL').TrimEnd('/')
Invoke-RestMethod "$workerUrl/api/health"
$page = Invoke-WebRequest -UseBasicParsing "$workerUrl/styleguide"
$page.StatusCode
$page.Headers['Content-Type']
Start-Process "$workerUrl/styleguide"
Start-Process "$workerUrl/"
```

Expected: health returns `{ "status": "ok" }`; `/styleguide` returns HTTP 200 with HTML and displays the styleguide after a direct navigation or refresh. The home page shows **API connected**. In browser Network tools, the health request should go to `/api/health` on that same Worker origin.

The old Pages deployment stops working after this change because its separate API URL and CORS support have been removed. Once the Worker deployment is verified, the old Pages project can be deleted manually. This repository change does not deploy anything or delete that project.

Static assets use `not_found_handling = "single-page-application"` for the `index.html` fallback and `run_worker_first = ["/api", "/api/*"]` to reserve API paths. See Cloudflare's [static assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/) and [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). The existing compatibility date remains `2026-11-01`; no `nodejs_compat` flag is required.
