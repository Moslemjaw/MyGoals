import { withSupabase } from 'npm:@supabase/server';
import Stripe from 'npm:stripe@17.7.0';
import { corsHeaders } from 'npm:@supabase/supabase-js/cors';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const checkoutHandler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: jsonHeaders });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecret?.startsWith('sk_test_')) {
    return Response.json(
      { error: 'Test checkout is not configured. Add a Stripe test secret key in Supabase Edge Function secrets.' },
      { status: 503, headers: jsonHeaders },
    );
  }

  const origin = req.headers.get('origin');
  if (!origin) {
    return Response.json({ error: 'Missing app origin.' }, { status: 400, headers: jsonHeaders });
  }
  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.protocol !== 'https:' &&
      !(parsedOrigin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname))
    ) {
      return Response.json({ error: 'Invalid app origin.' }, { status: 400, headers: jsonHeaders });
    }
  } catch {
    return Response.json({ error: 'Invalid app origin.' }, { status: 400, headers: jsonHeaders });
  }

  const userId = ctx.userClaims?.sub;
  if (!userId) {
    return Response.json({ error: 'Sign in before starting checkout.' }, { status: 401, headers: jsonHeaders });
  }

  const { data: entitlement, error: lookupError } = await ctx.supabaseAdmin
    .from('goal_tracker_entitlements')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (lookupError) {
    return Response.json({ error: 'Could not check Pro access.' }, { status: 500, headers: jsonHeaders });
  }
  if (entitlement?.status === 'active') {
    return Response.json({ error: 'Pro test access is already active.' }, { status: 409, headers: jsonHeaders });
  }

  try {
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'kwd',
            unit_amount: 1000,
            product_data: {
              name: 'Steady Pro Test Access',
              description: 'One-time test purchase to verify the Pro checkout flow.',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?pro=success`,
      cancel_url: `${origin}/?pro=cancelled`,
      client_reference_id: userId,
      metadata: { supabase_user_id: userId, plan: 'pro_test' },
      payment_intent_data: {
        metadata: { supabase_user_id: userId, plan: 'pro_test' },
      },
    });

    if (!session.url) {
      return Response.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502, headers: jsonHeaders });
    }
    return Response.json({ url: session.url }, { headers: jsonHeaders });
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    return Response.json({ error: 'Could not create the Stripe checkout session.' }, { status: 502, headers: jsonHeaders });
  }
});

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return checkoutHandler(req);
});
