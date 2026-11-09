---
name: Supabase Edge user identity
description: The authenticated-user identity shape exposed by `@supabase/server`.
---

For `withSupabase({ auth: 'user' }, ...)`, use `ctx.userClaims.id` as the account ID; do not assume `userClaims` is the raw JWT payload with a `sub` field.

**Why:** The checkout function returned 401 despite a valid authenticated session because it read `sub`, while the SDK's user claims expose the normalized account ID as `id`.

**How to apply:** When linking authenticated Edge Function requests to rows owned by the caller, derive the owner ID from `ctx.userClaims.id`.
