# Decisions

## Task 0.1: monorepo scaffold

- Shared exports point to TypeScript source so Vite, Vitest and TypeScript resolve workspace imports on a fresh clone without a preliminary build. Worker bundling will be configured in task 0.2.
- The API development command watches TypeScript only. pnpm runs it alongside Vite without an additional process orchestration dependency.
- Node.js 24 is the local default, with `engines.node` set to `>=20` as requested. pnpm is pinned to the installed version, 12.21.0.
- Vitest runs one shared package smoke test with its default failure for missing tests. Root and shared build TypeScript configs keep tooling checked and test files out of shared build output.
- Dependencies provide the approved React/Vite and Hono foundations, TypeScript definitions, ESLint, Prettier and Vitest. Only esbuild's dependency build script is allowed for Vite and Vitest.

## Task 0.2: hello world deployment preparation

- `/health` is public and read-only. Hono handles OPTIONS; CORS grants browser access only when Origin exactly matches the runtime `WEB_ORIGIN` binding, with no wildcard fallback.
- Wrangler is the only new direct dependency, providing the local Worker runtime and bundle/deployment CLI. Dependency build scripts are allowed only for esbuild and workerd; no Node.js compatibility flag is needed by the Worker.
- Production WEB_ORIGIN lives in wrangler.toml so plain deployments preserve CORS configuration. CLI --var overrides are not persistent configuration. Local development overrides it through .dev.vars; VITE_API_URL remains embedded at build time.
- API build uses Wrangler's dry-run mode so root build verifies the Worker bundle without publishing. Deployment remains manual, ordered API, Pages, then API with the final Pages origin.

## Task 0.4: design tokens and base layout

- IBM Plex Sans and Mono follow the project typography rules. Fontsource Latin normal 400, 500 and 600 imports self-host only the used weights with swap rendering; tables use tabular numerals.
- CSS variables are the single color source, mapped into Tailwind's CSS-first theme with its defaults removed. The named spacing scale replaces open-ended spacing; the only radius is 4px and the unused dropdown shadow is defined once.
- Secondary text is darker than base silver. Control boundaries use a darker silver-derived token, while offset focus rings use dark blue on light surfaces and accent on navy. Light dividers and status tints are decorative.
- The contrast generator and tests read the actual CSS tokens. The generated report includes every declared text/state pairing plus non-text checks and decorative reference ratios; a stale report fails root tests.
- Native elements cover this kit without shadcn or headless primitives, preserving semantics and avoiding an unused dependency. Placeholder navigation has no links; the mobile navigation uses a disclosure button with Escape handling.
- Tailwind and its Vite plugin provide the requested utility compiler; React Router provides home and styleguide routing. No business features or additional component libraries are introduced.

## Task 1.1: database schema and migrations

- Database-generated UUIDs identify rows; a PostgreSQL sequence starting at 1001 produces unique readable job numbers. Sequence gaps are expected, including after a rollback, and numbers are not a row count.
- The shared package defines job status values once with underscores. The web maps these values to its existing hyphenated CSS names without changing the displayed labels or colors. Email-extracted drafts belong in a separate Phase 2 table, not a job status.
- `job_events` records history and rejects UPDATE, DELETE and TRUNCATE through a statement trigger. Task 1.4 will save the status change and event atomically, preferably with one data-modifying CTE: conditionally update the expected current status and insert the event only from the returned row. Zero updated rows means a conflict, not a successful event.
- Neon HTTP has no interactive transactions. A fixed batch can use a non-interactive transaction when its statements enforce their dependencies in SQL; workflows that require application decisions between statements can switch to the same driver's WebSocket Pool. `client.ts` is only an HTTP Drizzle factory, without a repository wrapper or transaction abstraction that would prevent either approach. No status-changing behavior is implemented in 1.1.
- Nullable actor foreign keys represent system actions; manual jobs still require `created_by`. `audit_log.entity_id` intentionally has no foreign key because it is a polymorphic historical reference; its actor remains a real foreign key.
- `audit_log` rejects UPDATE, DELETE and TRUNCATE through its own statement trigger with an accurate table-specific message; the rollback-only verification script checks all three operations.
- Composite foreign keys keep job and contact branches within their customer and equipment within its job branch. Coordinates must be paired and in range. User emails are unique through `lower(email)`; contacts store one email or phone address per row and are not globally unique.
- All timestamps use `timestamptz`; database triggers maintain `updated_at` on mutable tables. Local migration and verification sessions use UTC. Append-only events and audit rows have no `updated_at`.
- Migration generation is offline. The manual migration runner reads a private `DATABASE_URL`, prints only its hostname, and uses the approved Neon driver's WebSocket transport for transactional migration execution. Verification uses the same transport with savepoints and an unconditional outer rollback; neither command belongs in CI.
- Drizzle ORM, the Neon serverless driver and drizzle-kit are the only new direct database dependencies. Existing Hono, TypeScript and Vitest cannot supply PostgreSQL queries or migration generation; Node.js 24 supplies dotenv parsing and WebSocket support without extra packages.
- Assignments, roster and inventory belong to later tasks. This migration deliberately creates no such tables, status transition rules, API routes, screens or seed dataset.

## Task 1.2a: same-origin deployment

- One Worker serves the SPA and `/api/*`; relative URLs remove CORS configuration and avoid reliance on cross-site session cookies, which browsers can block through third-party cookie restrictions. Authentication remains task 1.2.
- Explicit Worker-first API patterns prevent SPA fallback from turning unknown API requests into HTML. Other routes use Cloudflare's static assets and `index.html` fallback, without an assets binding in application code.
- Build order is shared, web, then Worker dry-run. `pnpm run release` builds web before deployment; development builds initial web assets only when the output directory is absent, then uses Vite's API proxy. This supersedes the separate Pages/API deployment and origin settings recorded in task 0.2.

## Task 1.2: authentication

- PBKDF2-SHA256 uses `PASSWORD_ITERATIONS = 100_000`, the current production-default ceiling in Cloudflare's runtime source. The Web Crypto documentation supports PBKDF2 but does not state that numeric ceiling; local workerd accepted 100,000, 100,001 and 1,000,000, so local acceptance cannot establish the deployed limit. Sources: [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [runtime limit](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/limit-enforcer.h).
- Passwords are NFC-normalized, salted independently with 16 random bytes, and stored with algorithm, iteration count and a 32-byte hash. Verification uses the stored cost and native constant-time comparison; successful login atomically replaces a differing-cost hash. Unknown emails perform the same dummy derivation. No hashing library or Node compatibility flag is needed in the Worker.
- The Free plan has a 10 ms CPU allowance per HTTP request. The 20-hash Node benchmark measures local wall time only and cannot establish production CPU compliance; a paid plan may be necessary without weakening the hash policy. See [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/).
- Sessions store only SHA-256 hashes of random 32-byte tokens, with revocation, a 12-hour idle timeout and 7-day absolute expiry. Conditional touches are throttled to five minutes. Every successful login rotates a carried session; login creation/rehash/rotation and logout revocation each include their audit write atomically.
- Cookies are HttpOnly, Secure, SameSite=Lax and host-only with Path=/. HTTPS uses `__Host-session`; only literal http://localhost uses `session`. Every non-GET API request requires an exact Origin match, including scheme and port; missing Origin is rejected even on public login.
- Vite's proxy explicitly preserves Host with `changeOrigin: false`, so local and production requests use the same strict Origin comparison without rewriting Origin or adding an allowlist.
- Authentication is default-deny for every API path, including newly registered routes. Only GET `/api/health` and POST `/api/auth/login` are allowlisted; `requireRole` rejects unlisted roles with 403. Responses never expose password hashes or session hashes, and failures never log credentials or driver error objects.
- A conditional INSERT with count subqueries alone can race. Neon HTTP `db.batch` sends a single transaction containing SET TRANSACTION READ COMMITTED, a separate transaction-scoped advisory-lock statement, 24-hour cleanup, then INSERT SELECT conditional on both counts. The fresh snapshot after lock acquisition sees prior committed reservations. All reservations and successful email resets share this lock; no interactive HTTP transaction or new database function is required. The global lock serializes only short attempt operations, not password hashing.
- Attempt keys are namespaced SHA-256 digests of normalized email or validated IP. Limits are five per email and twenty per IP over fifteen minutes; successful login deletes email attempts only. Missing/invalid IP uses one fallback bucket and SQL NULL. The two-column attempts table intentionally permits duplicate rows and has only a key/time index; sessions have only their primary key and unique token-hash index.
- Zod is the only new dependency, providing the requested shared runtime schemas. Node.js supplies hidden terminal input and benchmarking; create-user is explicit operator tooling rather than task 1.3 seeding. No database-writing command was run during implementation.
