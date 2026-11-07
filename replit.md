# Steady — Goals Tracker

A simple no-login goals tracker with deadlines, numeric progress, completion, and browser-local persistence.

## Run & Operate

- `pnpm --filter @workspace/goals-tracker run dev` — goals tracker, served at `/` through its managed workflow.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- The user chose no-login, browser-local goal storage instead of Supabase sync. Goals are isolated by browser and site origin; clearing browser data can remove them.
- The connected Supabase project is shared with another app and has its own signup requirements. Do not change its authentication or database policies for this tracker unless the user requests Supabase sync again.

## Product

Create, edit, delete, search and filter goals; track progress toward a numeric target; set deadlines; complete and reopen goals without signing in.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
