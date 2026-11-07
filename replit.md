# Steady — Goals Tracker

A simple personal goals tracker with deadlines, numeric progress, completion, and private Supabase-backed persistence.

## Run & Operate

- `pnpm --filter @workspace/goals-tracker run dev` — goals tracker, served at `/` through its managed workflow.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configure the public Supabase client. Never use a service-role key in browser code.

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

- The user explicitly selected their connected Supabase project for the backend and database. Do not migrate this product to the template's Replit database.
- Supabase's existing goals table, row-level security, and email authentication are reused. The frontend talks directly to Supabase; the template Express service is not the goals backend.
- Supabase email authentication is used rather than adding a second identity provider because the existing goals policies already enforce Supabase user ownership.

## Product

Create, edit, delete, search and filter goals; track progress toward a numeric target; set deadlines; complete and reopen goals; sign in to access private goals across devices.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
