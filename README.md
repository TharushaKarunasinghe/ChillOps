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
