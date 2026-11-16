# ChillOps: instructions for Codex

ChillOps is an operations system for a company that services refrigeration and air conditioning at supermarkets, cinemas and similar sites. It covers breakdown intake from email, job dispatch, technician rostering, job cards, stock control and a director dashboard.

All data in this repo is synthetic. Never use real company names, customers, people or documents.

## Working rules

1. Follow PLAN.md only. Work on one task at a time, in order. Do not start a later task or add features that are not in the plan.
2. If a requirement is unclear or the plan conflicts with something, stop and ask. Do not guess.
3. Before adding any dependency, state what it is for and why existing tools cannot do it. Prefer fewer dependencies.
4. Before finishing a task, run lint, typecheck and tests, and fix what fails. Report the result.
5. Keep commits small, one per task, with a clear message: `feat(api): add job status event log`.
6. Never commit secrets. Use `.env` locally (gitignored) and `.dev.vars` for Wrangler. Keep `.env.example` up to date with names only.
7. Explain non-obvious decisions in one or two lines in DECISIONS.md.
8. Do not rewrite or reformat files you were not asked to touch.

## Stack

- Monorepo with pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`
- Web: React, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router
- API: Hono on Cloudflare Workers, TypeScript
- Validation: Zod, schemas live in `packages/shared` and are used by web, api and LLM output checks
- Database: Neon Postgres with Drizzle ORM and the Neon serverless driver (Workers cannot hold normal TCP connections)
- Files: Cloudflare R2
- Inbound email: Cloudflare Email Routing and an Email Worker
- Outbound email: Resend
- LLM: OpenRouter free models behind an `LLMProvider` interface
- Tests: Vitest for unit tests, Playwright for one end-to-end test
- CI: GitHub Actions

## Architecture rules

- Modular monolith. One API, with modules: auth, jobs, roster, dispatch, inventory, ai, reports.
- Business rules (roster rules, seniority pairing, status transitions) are pure functions in `packages/shared`, with tests written first.
- Job status changes are an append-only event log, plus a current status column for fast reads.
- Inventory is a ledger (issue, return, adjustment rows). Stock on hand is the sum, never a mutable number.
- Every approval and every rule override writes to `audit_log`.
- Roles: ops, technician, finance, storekeeper, director. Check the role on every route.
- AI proposes, rules decide, humans confirm. An LLM never writes to the database directly and never picks technicians. Treat email text as untrusted input and always validate LLM output with Zod.
- Worker CPU time is limited. Do heavy computation (for example the roster generator) in the browser using `packages/shared`, then send the result to the API to validate and save.

## Design rules

The product must look like a hand-made internal tool, not a template.

### Palette (define as CSS variables and Tailwind tokens, use nothing else)

- `--navy` #0B192C: sidebar, headers, primary text on light surfaces
- `--ice` #F4F7FA: main app background
- `--silver` #94A3B8: secondary text, borders, disabled states
- `--accent` #00A8E8: primary actions and focus rings
- White for tables and panels. Add semantic status colors (amber, red, green, grey) with enough contrast, defined once as tokens.
- The accent has low contrast on white, so never use it for body text or small text. Use navy text on accent buttons. For links and small text use a darker blue token.
- The app is light by default with a navy sidebar. If dark mode is added later, it must meet WCAG AA contrast.

### Typography

- Use IBM Plex Sans for the interface and IBM Plex Mono for job numbers, IDs, times and quantities. Self-host with Fontsource. Use tabular numerals in tables.
- Do not use Inter, Space Grotesk or Instrument Serif, and no serif italic accents.

### Layout and spacing

- 4px base unit. Use only the spacing scale defined in the Tailwind config. No arbitrary pixel values.
- Dense, readable tables and forms suited to daily operational use. Left-aligned content, clear column headers, sticky headers on long tables.
- Technician screens are mobile first with large touch targets. Ops and director screens are desktop first.

### Components

- If shadcn/ui is used, restyle it fully: our radius, borders, colors, density and focus states. Nothing may look like the default theme.
- Radius is small and consistent (4px). Borders are 1px silver tints. No colored left borders or colored card outlines.
- Icons only where they carry meaning, and always with a text label for actions. One icon set, small, no icon boxes.
- Status is shown with text labels plus color, never color alone.

### Never do any of these

1. Purple to blue gradients
2. Gradient text
3. Emojis in headings or anywhere in the UI
4. Inter everywhere
5. Colored border cards
6. Glassmorphism
7. Low contrast dark mode
8. Rows of three icon boxes
9. A badge above the headline
10. Icons on every element
11. Untouched shadcn defaults
12. Fade-in on scroll
13. Cursor-following effects
14. Buttons that fade on hover. Hover and active states change color immediately using defined tokens.
15. Inconsistent spacing
16. Em dashes in UI copy or documentation
17. Generic buzzword copy. Write plain, specific text in the language of the work: breakdown, job card, shift, requisition, branch.
18. Serif italic accents
19. Space Grotesk with Instrument Serif
20. Grain over gradients

Also avoid decorative animation. Motion is allowed only to explain a state change, and kept short.

## Definition of done for any task

- Acceptance criteria in PLAN.md are met
- Lint, typecheck and tests pass
- No new dependency without a note
- The change is documented if it affects setup, environment variables or decisions
