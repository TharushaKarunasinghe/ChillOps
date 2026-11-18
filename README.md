# ChillOps

Operations software for refrigeration and air conditioning service work. All project data must be synthetic.

## Setup

Use Node.js 24 (see `.nvmrc`) and pnpm 12.21.0, pinned in `package.json`. The declared Node.js minimum is 20.

Run these commands from the repository root in Windows PowerShell. Copy the examples once; keep any existing local settings.

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars
Copy-Item apps/web/.env.local.example apps/web/.env.local
pnpm dev
```

`pnpm dev` starts Vite at `http://localhost:5173` and the local Worker at `http://localhost:8787` in parallel. Stop both with Ctrl+C. Open the web page to see the API's health JSON or a clear error message. Keep the web origin at port 5173 to match the example configuration.

`apps/api/.dev.vars` supplies `WEB_ORIGIN=http://localhost:5173`. `apps/web/.env.local` supplies `VITE_API_URL=http://localhost:8787`. Both files are gitignored. The root `.env.example` lists the variables and commented local defaults; the applications load their own local files, not the root example.

## Workspace

- `apps/web`: unstyled React page that fetches `/health`, importing `@chillops/shared`.
- `apps/api`: Hono Worker with public `GET /health` returning `{ "status": "ok" }` and OPTIONS preflight support.
- `packages/shared`: shared TypeScript exports and a workspace smoke test.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Lint includes ESLint and Prettier checks. Typechecking covers root configuration and all three packages. Vitest covers the shared workspace import, health JSON, exact CORS matching and preflight. Build emits shared JavaScript and declarations, a Worker bundle using Wrangler's local dry-run mode, and the Vite web bundle into the respective `dist` directories. Build does not publish anything.

`WEB_ORIGIN` is a non-secret Worker binding read at request time. Only an exact match receives an `Access-Control-Allow-Origin` header; no wildcards or prefix matching are used. Missing configuration grants no browser origin access. CORS does not authenticate requests: `/health` is intentionally public, including requests without an Origin header.

`VITE_API_URL` is public configuration embedded in the web bundle at build time. Changing it requires rebuilding and deploying the web app. Never put secrets in Vite variables. No account IDs or credentials belong in this repository.

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

`0000_core_schema.sql` is generated from the Drizzle schema. `0001_database_guards.sql` is a drizzle-kit custom migration for database triggers, which Drizzle's table declarations do not express. Root tests inspect the offline schema and migration guards; only the manual verification command proves enforcement against PostgreSQL. The runtime HTTP client is an unconnected factory until used and does not change `/health`.

## CI

The `CI` workflow runs on pull requests and pushes to `main`. It reads the pnpm version from `package.json` and the Node.js version from `.nvmrc`, caches the pnpm store, and installs with a frozen lockfile. Lint, Typecheck, Test and Build run as separate named steps on Ubuntu.

Runs have read-only repository permissions and a ten-minute timeout. New runs cancel older runs for the same branch or pull request. `.gitattributes` specifies LF line endings for text files across Windows and Linux. No deployment or secrets are configured; the API build uses Wrangler's local dry-run mode without Cloudflare login. View results under the repository's **Actions** tab or the pull request checks.

## Manual deployment (Windows PowerShell)

Run the steps below in order from the repository root. They publish to Cloudflare and are intended for you to run manually. Authenticate once using the browser login:

```powershell
pnpm --filter @chillops/api exec wrangler login
```

### A. Deploy the API first

```powershell
pnpm --filter @chillops/api exec wrangler deploy
$apiUrl = (Read-Host 'Paste the https://...workers.dev URL printed above').TrimEnd('/')
Invoke-RestMethod "$apiUrl/health"
```

Note the printed `workers.dev` URL. The health endpoint is reachable before a web origin is configured, but cross-origin browser reads remain disabled until step C. Local `.dev.vars` values are not deployed.

### B. Build and deploy the web app to Pages

Choose an available Pages project name when prompted. The project creation command is needed only once. Run the block in the same PowerShell session as step A:

```powershell
$pagesProject = Read-Host 'Choose your Pages project name'
pnpm --filter @chillops/api exec wrangler pages project create $pagesProject --production-branch main
$env:VITE_API_URL = $apiUrl
pnpm --filter @chillops/web build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed; do not deploy.' }
Remove-Item Env:VITE_API_URL
pnpm --filter @chillops/api exec wrangler pages deploy ../web/dist --project-name $pagesProject --branch main
```

The shell variable overrides the local Vite file during the build. The Pages upload path is relative to `apps/api`, where the filtered command runs. Use the stable production Pages URL shown for the project, not an individual deployment's preview URL. Until step C, the page may display a CORS error.

### C. Set the Worker origin and redeploy the API

```powershell
$webOrigin = (Read-Host 'Paste the production https://...pages.dev URL').TrimEnd('/')
pnpm --filter @chillops/api exec wrangler deploy --var "WEB_ORIGIN:$webOrigin"
Invoke-RestMethod "$apiUrl/health"
$healthResponse = Invoke-WebRequest -UseBasicParsing "$apiUrl/health" -Headers @{ Origin = $webOrigin }
$healthResponse.Headers['Access-Control-Allow-Origin']
```

The last command should print the exact Pages origin. Open that Pages URL and confirm the page displays `{ "status": "ok" }` (JSON whitespace may differ). Use an origin only, with no path or trailing slash. Preview URLs are intentionally not allowed by this single-origin configuration.

These commands use [Wrangler deployment options](https://developers.cloudflare.com/workers/wrangler/commands/) and [Pages project creation and upload](https://developers.cloudflare.com/workers/wrangler/commands/pages/). The Worker uses compatibility date `2026-11-01` and does not enable `nodejs_compat`; the health endpoint needs only Web APIs.
