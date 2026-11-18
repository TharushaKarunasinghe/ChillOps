# ChillOps

Operations software for refrigeration and air conditioning service work. All project data must be synthetic.

## Setup

Use Node.js 24 (see `.nvmrc`) and pnpm 12.21.0, pinned in `package.json`. The declared Node.js minimum is 20.

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
- `apps/api`: Hono Worker with public `GET /api/health` returning `{ "status": "ok" }`, plus the built web assets. Unknown API paths return JSON 404 responses.
- `packages/shared`: shared TypeScript exports and a workspace smoke test.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Lint includes ESLint and Prettier checks. Typechecking covers root configuration and all three packages. Vitest checks API routing, shared exports, database schema and design contrast. Build runs shared, then web, then the Worker dry-run in order so its assets directory is ready. CI already calls this root build script; it does not deploy or require Cloudflare login.

The browser uses relative `/api/...` URLs on the same origin as the web app. No CORS middleware or origin environment variables are needed. Static asset routing serves the SPA while `/api` and `/api/*` run the Worker first. An unknown API route stays a JSON 404, including when opened directly in a browser.

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
