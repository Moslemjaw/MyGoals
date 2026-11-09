create table if not exists public.goal_tracker_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'refunded')),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goal_tracker_entitlements enable row level security;

revoke all on public.goal_tracker_entitlements from anon, authenticated;
grant select on public.goal_tracker_entitlements to authenticated;
grant all on public.goal_tracker_entitlements to service_role;

drop policy if exists "Users can view their own goal tracker entitlement"
  on public.goal_tracker_entitlements;
create policy "Users can view their own goal tracker entitlement"
  on public.goal_tracker_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);
