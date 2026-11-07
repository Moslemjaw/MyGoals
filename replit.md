# Steady — Goals Tracker

A simple no-login goals tracker with deadlines, numeric progress, completion, and private Supabase persistence.

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

- The user wants goals saved in Supabase without requiring a visible login. Use Supabase anonymous auth and the existing per-user RLS policies; never expose goals through public unauthenticated policies.
- The user selected the Supabase project `xwnqnehjznhjikcayhon`. Vercel must use that project's URL and publishable key; reject other project hosts so goals do not silently go to a different database.
- Supabase anonymous sign-ins must be enabled in the project's Auth settings. The app prompts for this configuration if guest session creation is disabled.
- A previous app version saved goals under `steady-goals-v1` in browser local storage. On first guest session, import them to Supabase and only clear the local copy after Supabase confirms success.
- The connected Supabase project is shared with another app. Its signup trigger requires `role` and `full_name` metadata; anonymous guest creation sends the non-privileged customer role and a generic name. Do not weaken its trigger or RLS policies.

## Product

Create, edit, delete, search and filter goals; track progress toward a numeric target; set deadlines; complete and reopen goals without signing in.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
