import { withSupabase } from 'npm:@supabase/server';
import Stripe from 'npm:stripe@17.7.0';

const webhookHandler = withSupabase({ auth: 'none' }, async (req, ctx) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature');
  if (!stripeSecret?.startsWith('sk_test_') || !webhookSecret || !signature) {
    return new Response('Webhook is not configured for Stripe test mode.', { status: 503 });
  }

  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return new Response('Invalid webhook signature.', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : null;

    if (
      session.mode === 'payment' &&
      session.payment_status === 'paid' &&
      session.metadata?.plan === 'pro_test' &&
      userId
    ) {
      const { error } = await ctx.supabaseAdmin
        .from('goal_tracker_entitlements')
        .upsert(
          {
            user_id: userId,
            status: 'active',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            purchased_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (error) {
        console.error('Could not save Pro entitlement from Stripe webhook:', error);
        return new Response('Could not save entitlement.', { status: 500 });
      }
    }
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

    if (charge.refunded && paymentIntentId) {
      const { error } = await ctx.supabaseAdmin
        .from('goal_tracker_entitlements')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', paymentIntentId);

      if (error) {
        console.error('Could not revoke refunded Pro entitlement:', error);
        return new Response('Could not update entitlement.', { status: 500 });
      }
    }
  }

  return Response.json({ received: true });
});

Deno.serve(webhookHandler);
