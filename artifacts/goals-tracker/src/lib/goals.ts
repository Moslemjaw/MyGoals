import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configReady = Boolean(url && key);
const client = configReady ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'steady-auth' },
}) : null;

function backend() {
  if (!client) throw new Error('Supabase connection is not configured yet.');
  return client;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type GoalInput = Omit<Goal, 'id' | 'created_at' | 'updated_at'>;

export async function getSession() {
  const { data, error } = await backend().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: () => void) {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange(() => { callback(); });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string) {
  const { error } = await backend().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  // The shared Supabase project's existing profile trigger requires this
  // non-privileged role. Keep its other application's signup rules intact.
  const { data, error } = await backend().auth.signUp({
    email,
    password,
    options: { data: { role: 'customer' } },
  });
  if (error) throw error;
  if (data.user?.identities?.length === 0) throw new Error('This email is already registered. Please sign in instead.');
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await backend().auth.signOut();
  if (error) throw error;
}

const fields = 'id,title,description,category,target,current,unit,due_date,completed,created_at,updated_at';

function validate(input: Partial<GoalInput>) {
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 200))
    throw new Error('Give your goal a title of 1–200 characters.');
  if (input.description !== undefined && input.description.length > 5000)
    throw new Error('Keep the description under 5,000 characters.');
  if (input.target !== undefined && (!Number.isFinite(input.target) || input.target <= 0))
    throw new Error('Target must be a positive number.');
  if (input.current !== undefined && (!Number.isFinite(input.current) || input.current < 0))
    throw new Error('Progress must be zero or greater.');
  if (input.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date))
    throw new Error('Choose a valid deadline.');
}

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await backend().from('goal_tracker_goals').select(fields).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Goal[];
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  validate(input);
  const { data, error } = await backend().from('goal_tracker_goals')
    .insert({ ...input, title: input.title.trim() }).select(fields).single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal> {
  validate(input);
  const { data, error } = await backend().from('goal_tracker_goals')
    .update({ ...input, ...(input.title !== undefined ? { title: input.title.trim() } : {}), updated_at: new Date().toISOString() })
    .eq('id', id).select(fields).single();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { data, error } = await backend().from('goal_tracker_goals').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This goal was not found. Refresh and try again.');
}
