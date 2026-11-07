import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const LEGACY_STORAGE_KEY = 'steady-goals-v1';
const STORAGE_MIGRATION_KEY = 'steady-supabase-import-v1';

const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'steady-auth',
      },
    })
  : null;

export const configReady = Boolean(supabase);

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

function backend() {
  if (!supabase) throw new Error('Supabase is not configured. Add its project URL and publishable key, then reload.');
  return supabase;
}

export async function startGuestSession() {
  const auth = backend().auth;
  const { data: current, error: sessionError } = await auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session) return;

  // The shared Supabase project has a profile trigger that requires these
  // non-privileged fields when it creates a new auth user.
  const { error } = await auth.signInAnonymously({
    options: { data: { role: 'customer', full_name: 'Steady guest' } },
  });
  if (error) {
    if (error.message.toLowerCase().includes('anonymous') || error.status === 422) {
      throw new Error('Anonymous sign-ins are not enabled in Supabase yet. In your Supabase dashboard, open Authentication → Sign In / Providers, enable Anonymous Sign-Ins, and reload this app.');
    }
    throw error;
  }
}

function readLegacyGoals(): Goal[] {
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];

  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    value.some((goal) =>
      !goal ||
      typeof goal !== 'object' ||
      typeof goal.id !== 'string' ||
      typeof goal.title !== 'string' ||
      typeof goal.target !== 'number' ||
      typeof goal.current !== 'number' ||
      typeof goal.completed !== 'boolean' ||
      typeof goal.created_at !== 'string' ||
      typeof goal.updated_at !== 'string'
    )
  ) {
    throw new Error('A locally saved goal could not be imported. Your browser copy is still intact.');
  }
  return value as Goal[];
}

export async function importLegacyGoals() {
  if (window.localStorage.getItem(STORAGE_MIGRATION_KEY) === 'complete') return;
  const legacyGoals = readLegacyGoals();
  if (legacyGoals.length) {
    const { error } = await backend()
      .from('goal_tracker_goals')
      .upsert(legacyGoals, { onConflict: 'id' });
    if (error) throw error;
  }

  // Mark the import only after Supabase confirms the whole batch. This makes
  // retries safe and preserves the browser copy if a request fails.
  window.localStorage.setItem(STORAGE_MIGRATION_KEY, 'complete');
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
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
  const { data, error } = await backend().from('goal_tracker_goals')
    .select(fields).order('created_at', { ascending: false });
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
    .update({
      ...input,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).select(fields).single();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { data, error } = await backend().from('goal_tracker_goals').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This goal was not found. Refresh and try again.');
}
