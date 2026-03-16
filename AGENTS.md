# AGENTS.md

## Repo Summary
- `frontend/`: Next.js 16 App Router prototype UI with React 19, TypeScript, Tailwind 4, Radix UI, and Vercel Analytics.
- `backend/`: Go 1.26 API/worker code using Chi, pgx, Goose migrations, Redis-backed Asynq jobs, and Postgres.
- `docker-compose.yml`: local infra only (`postgres`, `redis`, `mailpit`).

## Key Paths
- `frontend/app/`: routes and pages.
- `frontend/components/`: shared UI and layout components.
- `frontend/lib/api.ts`: frontend API client; prefer extending this instead of ad hoc fetch logic.
- `backend/cmd/api/`: HTTP server entrypoint.
- `backend/cmd/worker/`: background worker entrypoint.
- `backend/internal/`: backend application code.
- `backend/db/migrations/`: Goose SQL migrations.

## Setup And Run
- Start infra: `docker compose up -d`
- Backend env: copy values from `backend/.env.example`
- Run API: `cd backend && go run ./cmd/api`
- Run worker: `cd backend && go run ./cmd/worker`
- Run frontend: `cd frontend && pnpm dev`
- Local Playwright seed account is auto-created by the API in development unless `SEED_PLAYWRIGHT_USER=false`
- Default Playwright seed credentials:
  - email: `playwright@example.com`
  - password: `Playwright123!`

## Build And Test
- Backend tests: `cd backend && GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod-cache go test ./...`
- Frontend typecheck: `cd frontend && pnpm exec tsc --noEmit`
- Frontend production build: `cd frontend && pnpm exec next build --webpack`
- Repo script notes:
  - `cd frontend && pnpm build` exists, but `--webpack` is more reliable in restricted sandboxes.
  - `cd frontend && pnpm lint` currently fails because this repo has no ESLint config. Do not rely on it until a config is added.

## Agent Rules
- Prefer existing commands and project structure; do not introduce a new build system or orchestration layer.
- Keep Docker Compose for infra only. Do not containerize the frontend or backend unless explicitly requested.
- Preserve the backend shape: modular Go code under `backend/internal`, API entrypoint in `backend/cmd/api`, worker in `backend/cmd/worker`.
- When changing database behavior, add or update Goose migrations in `backend/db/migrations`.
- Prefer wiring new frontend API work through `frontend/lib/api.ts`.

## Frontend Prototype Guardrail
- Frontend prototype is visually locked.
- The existing prototype is the fixed visual baseline for this phase.
- Agents may integrate backend APIs, replace mock data, and add state logic, but must preserve the existing UI output exactly.
- Any change that alters appearance, layout, DOM structure, styling, or interaction design is out of scope unless explicitly requested by the user.
- Allowed:
  - connect pages and components to backend APIs
  - replace mock data with real API-backed fetch and mutation flows
  - add API client logic, hooks, context, auth and session wiring, form submission, validation, polling, and response mapping
  - edit page or component files only when needed to swap data sources, handlers, or state wiring without changing the final visual output
- Not allowed unless the user explicitly asks:
  - modify layout or JSX structure
  - change element order, className values, spacing, typography, colors, icons, responsive behavior, or any styling
  - rewrite static copy for design cleanup
  - add new loading, empty, or error UI states that change the prototype presentation
  - redesign, simplify, or clean up existing UI components even if they look redundant

## Practical Workflow
- Inspect the touched area first; this repo has no central README.
- For backend changes, run backend tests after edits.
- For frontend integration work, prefer `frontend/lib/api.ts` plus helper, hook, or context layers before touching UI files.
- If editing a page or component is unavoidable, keep the markup and styling output identical to the prototype.
- For frontend changes, run TypeScript and a production build check if the change affects routing, data fetching, or shared components.
- If a task touches both apps, verify both sides before finishing.
- For any feature that touches auth, protected routes, forms, or user-facing page behavior, run a Playwright smoke test before finishing.
- Prefer the seeded local account for Playwright login checks instead of registering a fresh user each time.
- Minimum Playwright check: log in with the seed account, open the touched route, and exercise the changed user flow once.
