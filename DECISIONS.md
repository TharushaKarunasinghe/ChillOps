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
- Local configuration lives in ignored package-local files with committed examples. Production `WEB_ORIGIN` is supplied with Wrangler's `--var` option, while `VITE_API_URL` is embedded at build time.
- API build uses Wrangler's dry-run mode so root build verifies the Worker bundle without publishing. Deployment remains manual, ordered API, Pages, then API with the final Pages origin.
