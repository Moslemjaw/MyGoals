# Stripe test checkout for Steady

The Pro button starts a one-time **USD $1 test-mode** Stripe Checkout. Only a
verified Stripe webhook can grant Pro access; a full refund removes it. The
entitlement table is isolated from the other app tables and uses row-level
security so each signed-in guest can read only their own status.

## Supabase setup

1. Apply `migrations/20261109000000_goal_tracker_pro_entitlements.sql` to the
   `xwnqnehjznhjikcayhon` Supabase project. The migration is also applied
   directly when this feature is set up.
2. In **Supabase → Edge Functions → Secrets**, add:
   - `STRIPE_SECRET_KEY` — a Stripe **test-mode** secret key (`sk_test_...`).
   - `STRIPE_WEBHOOK_SECRET` — the signing secret for the webhook below.
3. Deploy the `create-pro-checkout` and `stripe-webhook` functions from this
   repository. The webhook function must allow unauthenticated requests at the
   Supabase gateway; it verifies Stripe's signature itself.
4. In Stripe test mode, add a webhook endpoint:
   `https://xwnqnehjznhjikcayhon.supabase.co/functions/v1/stripe-webhook`
   Subscribe to `checkout.session.completed` and `charge.refunded`, then save
   the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.

The Stripe publishable key is not used: Checkout is hosted by Stripe and the
browser only receives a redirect URL. Never put the Stripe secret or webhook
signing secret in Vercel or frontend code.
