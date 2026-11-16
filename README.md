# ChillOps

Operations software for refrigeration and air conditioning service work. All project data must be synthetic.

## Setup

Use Node.js 24 (see `.nvmrc`) and pnpm 12.21.0, pinned in `package.json`. The declared Node.js minimum is 20.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the Vite web server and the API TypeScript watcher in parallel. The API watcher is a scaffold placeholder, not an HTTP server. Stop both with Ctrl+C. The web entry is intentionally blank.

## Workspace

- `apps/web`: React and Vite entry, importing `@chillops/shared`.
- `apps/api`: Hono application with no routes, importing `@chillops/shared`.
- `packages/shared`: shared TypeScript exports and a workspace smoke test.

## Commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Lint includes ESLint and Prettier checks. Typechecking covers root configuration and all three packages. Tests use Vitest and fail if no tests are found. Build emits shared/API JavaScript and declarations and the Vite web bundle into each package's `dist` directory. The API output is not yet a deployable Worker bundle.

No environment variables are required for the scaffold, so `.env.example` is empty. Future local secrets belong in ignored `.env` or `.dev.vars` files.
