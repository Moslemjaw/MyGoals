import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { format, isPast, parseISO } from 'date-fns';
import { Check, Pencil, Plus, Search, Trash2, RotateCcw, Minus, CalendarDays } from 'lucide-react';
import {
  listGoals, createGoal, updateGoal, deleteGoal, startGuestSession, importLegacyGoals, configReady, configError,
  type Goal, type GoalInput,
} from '@/lib/goals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Personal', 'Health', 'Learning', 'Career', 'Finance', 'Fitness'] as const;
const CAT_HUE: Record<string, string> = {
  Personal: '18 78% 62%', Health: '150 30% 45%', Learning: '42 75% 52%',
  Career: '188 42% 32%', Finance: '260 22% 55%', Fitness: '340 45% 58%',
};
const KEY = ['goals'];
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pct = (g: Goal) => (g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0);

function ConnectionProblem({ message }: { message: string }) {
  return (
    <main className="min-h-[100dvh] grid place-items-center p-6">
      <div className="rise max-w-lg rounded-3xl border bg-card p-8 shadow-sm" data-testid="status-connection-needed">
        <Mark className="h-10 w-10" />
        <h1 className="font-display mt-4 text-3xl">One quick setup step</h1>
        <p className="mt-3 text-muted-foreground">{message}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Your existing browser-saved goals have not been removed. Reload after enabling guest access to import them into Supabase.
        </p>
        <Button className="mt-6 rounded-full" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </main>
  );
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="4" y="20" width="6" height="8" rx="2" fill="hsl(var(--primary))" opacity=".45" />
      <rect x="13" y="14" width="6" height="14" rx="2" fill="hsl(var(--primary))" opacity=".75" />
      <rect x="22" y="6" width="6" height="22" rx="2" fill="hsl(var(--accent))" />
    </svg>
  );
}

/* ---------- Goal form ---------- */
const blank: GoalInput = { title: '', description: '', category: 'Personal', target: 100, current: 0, unit: '%', due_date: null, completed: false } as GoalInput;

function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal: Goal | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState({ title: '', description: '', category: 'Personal', target: '100', current: '0', unit: '%', due_date: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const g = goal ?? (blank as unknown as Goal);
    setF({ title: g.title, description: g.description ?? '', category: g.category, target: String(g.target), current: String(g.current), unit: g.unit, due_date: g.due_date ?? '' });
    setErr(null);
  }, [open, goal]);

  const save = useMutation({
    mutationFn: (input: GoalInput) => (goal ? updateGoal(goal.id, input) : createGoal(input)),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: goal ? 'Goal updated' : 'Goal planted', description: g.title });
      onOpenChange(false);
    },
    onError: (e) => setErr(errMsg(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const target = Number(f.target), current = Number(f.current);
    if (!f.title.trim()) return setErr('Give your goal a name.');
    if (!(target > 0)) return setErr('Target must be a positive number.');
    if (!(current >= 0)) return setErr('Progress cannot be negative.');
    save.mutate({
      title: f.title.trim(), description: f.description.trim(), category: f.category, target,
      current: Math.min(current, target), unit: f.unit.trim() || '%', due_date: f.due_date || null,
      completed: current >= target,
    } as GoalInput);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl bg-card max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{goal ? 'Tend this goal' : 'A new goal'}</DialogTitle>
          <DialogDescription>{goal ? 'Adjust the details as it grows.' : 'Something you mean to do. Keep it honest and specific.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="g-title">Title</Label>
            <Input id="g-title" required value={f.title} onChange={set('title')} placeholder="Read twelve books" data-testid="input-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Why it matters <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="g-desc" rows={2} value={f.description} onChange={set('description')} data-testid="input-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-cat">Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger id="g-cat" data-testid="select-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-due">Due date</Label>
              <Input id="g-due" type="date" value={f.due_date} onChange={set('due_date')} data-testid="input-due-date" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label htmlFor="g-cur">Current</Label><Input id="g-cur" type="number" min={0} step="any" value={f.current} onChange={set('current')} data-testid="input-current" /></div>
            <div className="space-y-1.5"><Label htmlFor="g-tar">Target</Label><Input id="g-tar" type="number" min={0} step="any" value={f.target} onChange={set('target')} data-testid="input-target" /></div>
            <div className="space-y-1.5"><Label htmlFor="g-unit">Unit</Label><Input id="g-unit" value={f.unit} onChange={set('unit')} data-testid="input-unit" /></div>
          </div>
          {err && <p role="alert" className="text-sm text-destructive" data-testid="text-form-error">{err}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">Cancel</Button>
            <Button type="submit" disabled={save.isPending} className="rounded-full px-6" data-testid="button-save-goal">
              {save.isPending ? 'Saving...' : goal ? 'Save changes' : 'Add goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Goal card ---------- */
function GoalCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [burst, setBurst] = useState(0);
  const p = pct(goal);
  const hue = CAT_HUE[goal.category] ?? CAT_HUE.Personal;
  const step = goal.target >= 20 ? Math.max(1, Math.round(goal.target / 20)) : 1;

  const mut = useMutation({
    mutationFn: (input: Partial<GoalInput>) => updateGoal(goal.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast({ title: 'Could not save', description: errMsg(e), variant: 'destructive' }),
  });

  function nudge(d: number) {
    const current = Math.max(0, Math.min(goal.target, +(goal.current + d).toFixed(2)));
    const completed = current >= goal.target;
    if (completed && !goal.completed) setBurst((b) => b + 1);
    mut.mutate({ current, completed });
  }
  function toggle() {
    if (goal.completed) mut.mutate({ completed: false, current: 0 });
    else { setBurst((b) => b + 1); mut.mutate({ completed: true, current: goal.target }); toast({ title: 'Done. Well kept.', description: goal.title }); }
  }
  const overdue = goal.due_date && !goal.completed && isPast(parseISO(goal.due_date + 'T23:59:59'));

  return (
    <motion.article
      layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn('group relative rounded-3xl border bg-card p-5 md:p-6 shadow-[0_1px_0_hsl(var(--border)),0_12px_30px_-18px_hsl(188_42%_20%/.25)]', goal.completed && 'bg-secondary/60')}
      data-testid={`card-goal-${goal.id}`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={toggle} disabled={mut.isPending}
          aria-label={goal.completed ? `Reopen ${goal.title}` : `Mark ${goal.title} complete`}
          aria-pressed={goal.completed}
          className={cn('relative mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            goal.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary')}
          data-testid={`button-toggle-${goal.id}`}
        >
          {goal.completed && <Check key={burst} className="h-4 w-4 pop" strokeWidth={3} />}
          {burst > 0 && <span key={`b${burst}`} className="ring-burst absolute inset-0 rounded-full border-2 border-accent" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${hue})` }} />
            {goal.category}
            {goal.due_date && (
              <span className={cn('ml-auto inline-flex items-center gap-1 normal-case tracking-normal', overdue && 'text-destructive')}>
                <CalendarDays className="h-3.5 w-3.5" />{format(parseISO(goal.due_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <h3 className={cn('font-display mt-1.5 text-xl md:text-2xl leading-tight break-words', goal.completed && 'text-muted-foreground line-through decoration-accent decoration-2')} data-testid={`text-title-${goal.id}`}>{goal.title}</h3>
          {goal.description && <p className="mt-1 text-sm text-muted-foreground break-words">{goal.description}</p>}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span data-testid={`text-progress-${goal.id}`}><span className="font-display text-2xl">{goal.current}</span><span className="text-muted-foreground"> / {goal.target} {goal.unit}</span></span>
          <span className="font-medium tabular-nums" style={{ color: `hsl(${hue})` }}>{p}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.title} progress`}>
          <motion.div className="h-full origin-left rounded-full" style={{ background: `hsl(${hue})` }} initial={false} animate={{ scaleX: p / 100 }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        {!goal.completed ? (
          <>
            <Button size="sm" variant="outline" className="rounded-full h-8 px-3" onClick={() => nudge(-step)} disabled={mut.isPending || goal.current <= 0} aria-label={`Decrease by ${step}`} data-testid={`button-decrease-${goal.id}`}><Minus className="h-3.5 w-3.5" /></Button>
            <Button size="sm" className="rounded-full h-8 px-3" onClick={() => nudge(step)} disabled={mut.isPending} data-testid={`button-increase-${goal.id}`}><Plus className="h-3.5 w-3.5" /> {step} {goal.unit}</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="rounded-full h-8" onClick={toggle} disabled={mut.isPending} data-testid={`button-reopen-${goal.id}`}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>
        )}
        <div className="ml-auto flex gap-1 opacity-100 md:opacity-60 md:group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={onEdit} aria-label={`Edit ${goal.title}`} data-testid={`button-edit-${goal.id}`}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:text-destructive" onClick={onDelete} aria-label={`Delete ${goal.title}`} data-testid={`button-delete-${goal.id}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </motion.article>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: KEY, queryFn: listGoals, refetchInterval: 30000 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'done'>('all');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast({ title: 'Goal removed' }); setToDelete(null); },
    onError: (e) => toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }),
  });

  const goals = q.data ?? [];
  const stats = useMemo(() => {
    const done = goals.filter((g) => g.completed).length;
    const avg = goals.length ? Math.round(goals.reduce((s, g) => s + pct(g), 0) / goals.length) : 0;
    return { total: goals.length, done, active: goals.length - done, avg };
  }, [goals]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return goals.filter((g) =>
      (status === 'all' || (status === 'done' ? g.completed : !g.completed)) &&
      (cat === 'all' || g.category === cat) &&
      (!s || g.title.toLowerCase().includes(s) || (g.description ?? '').toLowerCase().includes(s)));
  }, [goals, search, status, cat]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-6 md:px-8">
        <Mark className="h-7 w-7" /><span className="font-display text-xl">Steady</span>
        <span className="ml-auto text-xs text-muted-foreground sm:text-sm" data-testid="text-storage-mode">Private Supabase guest account</span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <section className="mt-10 grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-end rise">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{greet}</p>
            <h1 className="font-display mt-2 text-4xl md:text-6xl leading-[1.02]">
              {stats.total === 0 ? <>Where would you<br />like to <em className="text-accent">begin</em>?</> : <>You're <em className="text-accent">{stats.avg}%</em> of the<br />way there, overall.</>}
            </h1>
          </div>
          <dl className="grid grid-cols-3 rounded-3xl border bg-card p-1.5" data-testid="summary-counts">
            {[['Goals', stats.total, 'total'], ['In motion', stats.active, 'active'], ['Kept', stats.done, 'done']].map(([l, v, k], i) => (
              <div key={k} className={cn('rounded-[1.1rem] px-4 py-4', i === 2 && 'bg-primary text-primary-foreground')}>
                <dt className={cn('text-xs uppercase tracking-[0.14em]', i === 2 ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{l}</dt>
                <dd className="font-display mt-1 text-3xl tabular-nums" data-testid={`text-count-${k}`}>{q.isLoading ? '–' : v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 flex flex-col gap-3 md:flex-row md:items-center rise" style={{ animationDelay: '.08s' }} aria-label="Filters">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search your goals" aria-label="Search goals" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-full pl-10 bg-card" data-testid="input-search" />
          </div>
          <div className="flex gap-2">
            <div role="tablist" aria-label="Status" className="flex rounded-full border bg-card p-1">
              {(['all', 'active', 'done'] as const).map((s) => (
                <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                  className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors', status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                  data-testid={`filter-status-${s}`}>{s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Done'}</button>
              ))}
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-11 w-[9.5rem] rounded-full bg-card" aria-label="Category" data-testid="filter-category"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={openNew} className="h-11 rounded-full px-5 bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-new-goal"><Plus className="h-4 w-4" /> New goal</Button>
        </section>

        <section className="mt-8" aria-live="polite">
          {q.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2" data-testid="status-loading">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}
            </div>
          ) : q.isError ? (
            <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center" data-testid="status-error">
              <h2 className="font-display text-2xl">Your goals didn't load</h2>
              <p className="mt-2 text-sm text-muted-foreground">{errMsg(q.error)}</p>
              <Button className="mt-5 rounded-full" onClick={() => q.refetch()} data-testid="button-retry">Try again</Button>
            </div>
          ) : goals.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-16 text-center" data-testid="status-empty">
              <Mark className="mx-auto h-14 w-14" />
              <h2 className="font-display mt-5 text-3xl">An open page</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Name one thing you'd like to be true a few months from now. That's enough to start.</p>
              <Button onClick={openNew} className="mt-6 rounded-full px-6" data-testid="button-empty-new-goal"><Plus className="h-4 w-4" /> Set your first goal</Button>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed px-6 py-12 text-center" data-testid="status-no-matches">
              <p className="font-display text-xl">Nothing matches those filters.</p>
              <Button variant="ghost" className="mt-3 rounded-full" onClick={() => { setSearch(''); setStatus('all'); setCat('all'); }} data-testid="button-clear-filters">Clear filters</Button>
            </div>
          ) : (
            <motion.div layout className="grid gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {shown.map((g) => (
                  <GoalCard key={g.id} goal={g} onEdit={() => { setEditing(g); setFormOpen(true); }} onDelete={() => setToDelete(g)} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      </main>

      <GoalDialog open={formOpen} onOpenChange={setFormOpen} goal={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Let this goal go?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.title}" and its progress will be removed for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={del.isPending}
              onClick={(e) => { e.preventDefault(); if (toDelete) del.mutate(toDelete.id); }} data-testid="button-confirm-delete">
              {del.isPending ? 'Removing...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!configReady) {
      setConnectionError(configError ?? 'Supabase configuration is incomplete. Check the project URL and publishable key, then reload.');
      return () => { mounted = false; };
    }
    void (async () => {
      try {
        await startGuestSession();
        await importLegacyGoals();
        if (mounted) setReady(true);
      } catch (error) {
        if (mounted) setConnectionError(errMsg(error));
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (connectionError) return <ConnectionProblem message={connectionError} />;
  if (!ready) return <div className="min-h-[100dvh] grid place-items-center" data-testid="status-session-loading"><Mark className="h-10 w-10 animate-pulse" /></div>;
  return <Dashboard />;
}
