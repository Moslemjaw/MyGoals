const STORAGE_KEY = 'steady-goals-v1';

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

function readGoals(): Goal[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (
    !Array.isArray(parsed) ||
    parsed.some((goal) =>
      !goal ||
      typeof goal !== 'object' ||
      typeof goal.id !== 'string' ||
      typeof goal.title !== 'string' ||
      typeof goal.target !== 'number' ||
      typeof goal.current !== 'number' ||
      typeof goal.completed !== 'boolean'
    )
  ) {
    throw new Error('Your saved goals could not be read. Your browser data has not been changed.');
  }
  return parsed as Goal[];
}

function writeGoals(goals: Goal[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('This browser is out of storage space. Free up browser storage and try again.');
    }
    throw new Error('Your browser could not save this change. Check that local storage is available.');
  }
}

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
  return readGoals().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  validate(input);
  const now = new Date().toISOString();
  const goal: Goal = {
    ...input,
    title: input.title.trim(),
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  };
  writeGoals([goal, ...readGoals()]);
  return goal;
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal> {
  validate(input);
  const goals = readGoals();
  const index = goals.findIndex((goal) => goal.id === id);
  if (index === -1) throw new Error('This goal was not found. Refresh and try again.');

  const goal: Goal = {
    ...goals[index],
    ...input,
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    updated_at: new Date().toISOString(),
  };
  goals[index] = goal;
  writeGoals(goals);
  return goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const goals = readGoals();
  const remaining = goals.filter((goal) => goal.id !== id);
  if (remaining.length === goals.length) throw new Error('This goal was not found. Refresh and try again.');
  writeGoals(remaining);
}
