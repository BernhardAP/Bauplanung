import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanies, fetchTasks, flattenTree } from '@/lib/queries';
import { TaskRow, NewTaskRow, nextStatus } from '@/components/task-row';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { CompanyBadge } from '@/components/company-badge';
import { StatusIcon } from '@/lib/status-icon';
import type { Task, TaskStatus } from '@/lib/types';
import { STATUS_ORDER, STATUS_LABEL } from '@/lib/types';
import { useStatusMeta } from '@/lib/use-status-meta';
import { toast } from 'sonner';
import { Search, X, LogOut, Plus } from 'lucide-react';
import { undoStore } from '@/lib/undo-store';
import { UndoButton } from '@/components/undo-button';
import { Button } from '@/components/ui/button';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { HelpButton } from '@/components/help-button';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Aufgaben — Bauplanung Leiwen' },
      { name: 'description', content: 'Aufgaben der Bauplanung mit Status, Unternehmen und Anhängen.' },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const statusMeta = useStatusMeta();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attachments').select('id, task_id');
      if (error) throw error;
      return data as { id: string; task_id: string }[];
    },
  });

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(new Set());
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set());

  const ordered = useMemo(() => flattenTree(tasks), [tasks]);
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const attCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attachments) m.set(a.task_id, (m.get(a.task_id) ?? 0) + 1);
    return m;
  }, [attachments]);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) if (t.parent_id) m.set(t.parent_id, (m.get(t.parent_id) ?? 0) + 1);
    return m;
  }, [tasks]);

  const filterActive = statusFilter.size + companyFilter.size > 0 || search.trim().length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // First apply filters
    const matchesFilters = (t: Task) => {
      if (statusFilter.size > 0 && !statusFilter.has(t.status)) return false;
      if (companyFilter.size > 0) {
        if (!t.company_id || !companyFilter.has(t.company_id)) return false;
      }
      if (q && !(t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))) return false;
      return true;
    };
    // Hide descendants of any collapsed parent (only when no filter is active,
    // so search/filters always show all matches regardless of collapse state).
    const hideByCollapse = (t: Task): boolean => {
      if (filterActive) return false;
      let p = t.parent_id;
      while (p) {
        if (collapsedParents.has(p)) return true;
        const parent = tasks.find((x) => x.id === p);
        p = parent?.parent_id ?? null;
      }
      return false;
    };
    return ordered.filter((t) => matchesFilters(t) && !hideByCollapse(t));
  }, [ordered, tasks, search, statusFilter, companyFilter, collapsedParents, filterActive]);

  const editTask = ordered.find((t) => t.id === editTaskId) ?? null;

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Undoable wrapper around updateTask: captures previous values for the
  // patched keys and pushes an inverse onto the undo stack.
  function applyUpdate(id: string, patch: Partial<Task>, label: string) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const prev: Partial<Task> = {};
    for (const k of Object.keys(patch) as (keyof Task)[]) {
      (prev as Record<string, unknown>)[k] = current[k];
    }
    updateTask.mutate({ id, patch });
    undoStore.push(label, async () => {
      const { error } = await supabase.from('tasks').update(prev).eq('id', id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['tasks'] });
    });
  }

  const createTask = useMutation({
    mutationFn: async ({ title, parent_id, depth, sort_order }: {
      title: string; parent_id: string | null; depth: number; sort_order: number;
    }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ title, parent_id, depth, sort_order })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (data?.id) {
        const newId = data.id;
        undoStore.push(`Aufgabe „${vars.title || 'ohne Titel'}" erstellt`, async () => {
          const { error } = await supabase.from('tasks').delete().eq('id', newId);
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ['tasks'] });
        });
      }
    },
  });

  async function handleAddSubtask(parent: Task) {
    const maxOrder = tasks.reduce(
      (m, t) => (t.parent_id === parent.id ? Math.max(m, t.sort_order) : m),
      0,
    );
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: '',
        parent_id: parent.id,
        depth: parent.depth + 1,
        sort_order: maxOrder + 1000,
      })
      .select('id')
      .single();
    if (error) { toast.error(error.message); return; }
    setCollapsedParents((s) => { const n = new Set(s); n.delete(parent.id); return n; });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (data?.id) {
      const newId = data.id;
      undoStore.push(`Unteraufgabe erstellt`, async () => {
        const { error: e } = await supabase.from('tasks').delete().eq('id', newId);
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ['tasks'] });
      });
      setEditTaskId(newId);
    }
  }

  // ----- Long-press drag-to-reparent -----
  type DragState = { id: string; x: number; y: number; targetId: string | null };
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  const childrenByParentId = useMemo(() => {
    const m = new Map<string | null, Task[]>();
    for (const t of tasks) {
      const arr = m.get(t.parent_id) ?? [];
      arr.push(t);
      m.set(t.parent_id, arr);
    }
    return m;
  }, [tasks]);

  function collectDescendants(id: string): Task[] {
    const out: Task[] = [];
    const walk = (pid: string) => {
      for (const c of childrenByParentId.get(pid) ?? []) { out.push(c); walk(c.id); }
    };
    walk(id);
    return out;
  }

  async function handleReparent(draggedId: string, newParentId: string) {
    const dragged = tasks.find((t) => t.id === draggedId);
    const newParent = tasks.find((t) => t.id === newParentId);
    if (!dragged || !newParent) return;
    if (draggedId === newParentId) return;
    const descendants = collectDescendants(draggedId);
    if (descendants.some((d) => d.id === newParentId)) {
      toast.error('Aufgabe kann nicht in eigene Unteraufgabe verschoben werden');
      return;
    }
    const newDepth = newParent.depth + 1;
    const depthDelta = newDepth - dragged.depth;
    const maxOrder = tasks.reduce(
      (m, t) => (t.parent_id === newParentId ? Math.max(m, t.sort_order) : m),
      0,
    );
    // capture inverse for undo
    const prevDragged = {
      parent_id: dragged.parent_id,
      depth: dragged.depth,
      sort_order: dragged.sort_order,
    };
    const prevDescendants = descendants.map((d) => ({ id: d.id, depth: d.depth }));

    const { error: e1 } = await supabase.from('tasks').update({
      parent_id: newParentId,
      depth: newDepth,
      sort_order: maxOrder + 1000,
    }).eq('id', draggedId);
    if (e1) { toast.error(e1.message); return; }
    for (const d of descendants) {
      const { error: e2 } = await supabase.from('tasks').update({ depth: d.depth + depthDelta }).eq('id', d.id);
      if (e2) { toast.error(e2.message); return; }
    }
    setCollapsedParents((s) => { const n = new Set(s); n.delete(newParentId); return n; });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    toast.success(`Verschoben unter „${newParent.title || 'Aufgabe'}"`);
    undoStore.push(`Verschoben: „${dragged.title || 'Aufgabe'}"`, async () => {
      const { error: u1 } = await supabase.from('tasks').update(prevDragged).eq('id', draggedId);
      if (u1) throw u1;
      for (const d of prevDescendants) {
        const { error: u2 } = await supabase.from('tasks').update({ depth: d.depth }).eq('id', d.id);
        if (u2) throw u2;
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
    });
  }

  function handleLongPressStart(taskId: string, x: number, y: number) {
    setDragState({ id: taskId, x, y, targetId: null });
  }

  useEffect(() => {
    if (!dragState) return;
    const findTarget = (clientX: number, clientY: number): string | null => {
      const el = document.elementFromPoint(clientX, clientY);
      const row = el?.closest('[data-task-id]') as HTMLElement | null;
      const id = row?.getAttribute('data-task-id') ?? null;
      if (!id || id === dragState.id) return null;
      // forbid descendants
      const descIds = new Set(collectDescendants(dragState.id).map((d) => d.id));
      if (descIds.has(id)) return null;
      return id;
    };
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const targetId = findTarget(e.clientX, e.clientY);
      setDragState((s) => (s ? { ...s, x: e.clientX, y: e.clientY, targetId } : s));
    };
    const onUp = () => {
      const s = dragStateRef.current;
      if (s?.targetId) handleReparent(s.id, s.targetId);
      setDragState(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.touchAction = prevTouchAction;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.id]);

  const draggedTask = dragState ? tasks.find((t) => t.id === dragState.id) ?? null : null;

  function handleIndent(task: Task) {
    const sameParent = tasks.filter((t) => t.parent_id === task.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameParent.findIndex((t) => t.id === task.id);
    if (idx <= 0) { toast.info('Keine vorherige Schwester-Aufgabe zum Einrücken'); return; }
    const newParent = sameParent[idx - 1];
    applyUpdate(task.id, { parent_id: newParent.id, depth: newParent.depth + 1 }, `Eingerückt: „${task.title || 'Aufgabe'}"`);
  }
  function handleOutdent(task: Task) {
    if (!task.parent_id) { toast.info('Schon auf oberster Ebene'); return; }
    const parent = tasks.find((t) => t.id === task.parent_id);
    if (!parent) return;
    applyUpdate(task.id, { parent_id: parent.parent_id, depth: parent.depth }, `Ausgerückt: „${task.title || 'Aufgabe'}"`);
  }
  function handleCreateAtEnd(title: string) {
    const maxOrder = tasks.reduce((m, t) => (t.parent_id === null ? Math.max(m, t.sort_order) : m), 0);
    createTask.mutate({ title, parent_id: null, depth: 0, sort_order: maxOrder + 1000 });
  }
  async function handleCreateAndEdit() {
    const maxOrder = tasks.reduce((m, t) => (t.parent_id === null ? Math.max(m, t.sort_order) : m), 0);
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: '', parent_id: null, depth: 0, sort_order: maxOrder + 1000 })
      .select('id')
      .single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (data?.id) {
      const newId = data.id;
      undoStore.push(`Aufgabe erstellt`, async () => {
        const { error: e } = await supabase.from('tasks').delete().eq('id', newId);
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ['tasks'] });
      });
      setEditTaskId(newId);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleChildren(id: string) {
    setCollapsedParents((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
    const n = new Set(set);
    if (n.has(item)) n.delete(item); else n.add(item);
    return n;
  }
  function clearFilters() {
    setStatusFilter(new Set()); setCompanyFilter(new Set()); setSearch('');
  }

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg md:text-xl font-semibold">Bauplanung Leiwen</h1>
              <HelpButton title="Aufgabenliste">
                <p>Hier verwaltest Du alle Aufgaben des Bauprojekts.</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Tippen</b> auf eine Zeile: Details ein-/ausklappen</li>
                  <li><b>Tippen</b> auf das Status-Symbol: Status weiterschalten</li>
                  <li><b>Swipe →</b>: Aufgabe einrücken (Unterpunkt)</li>
                  <li><b>Swipe ←</b>: Aufgabe ausrücken</li>
                  <li><b>Lange drücken</b>: Aufgabe verschieben</li>
                  <li>Oben filtern nach Status, Unternehmen oder Suchbegriff</li>
                </ul>
              </HelpButton>
            </div>
            <p className="text-xs text-muted-foreground">
              {filtered.length}{filterActive ? ` / ${ordered.length}` : ''} Aufgaben ·{' '}
              <span className="md:hidden">Tippen klappt auf · Swipe ⇆ Hierarchie</span>
              <span className="hidden md:inline">Tippen klappt auf · ✏️ bearbeiten · Swipe ⇆ Hierarchie</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <UndoButton />
            <ChangePasswordDialog />
            <Button variant="ghost" size="icon" title="Abmelden" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full pl-7 pr-7 py-1.5 text-sm rounded-md border bg-background outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {statusMeta.order.map((s) => {
              const m = statusMeta.meta[s];
              const active = statusFilter.has(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter((cur) => toggleSetItem(cur, s))}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition ${active ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  <StatusIcon status={s} className="h-3 w-3" color={m.color ?? undefined} label={m.label} /> {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {companies.map((c) => {
              const active = companyFilter.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setCompanyFilter((cur) => toggleSetItem(cur, c.id))}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition ${active ? 'ring-2 ring-offset-1 ring-foreground' : 'opacity-70 hover:opacity-100'}`}
                  title={c.name}
                >
                  <CompanyBadge company={c} />
                </button>
              );
            })}
            {filterActive && (
              <button onClick={clearFilters} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline px-2">
                zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Desktop column headers */}
        <div
          className="hidden md:grid items-center gap-3 px-4 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground border-t pt-2"
          style={{ gridTemplateColumns: 'auto minmax(0, 1fr) 180px 160px 90px auto', paddingLeft: 16 }}
        >
          <button
            onClick={handleCreateAndEdit}
            className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Neue Aufgabe"
            title="Neue Aufgabe"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span>Aufgabe</span>
          <span>Unternehmen</span>
          <span>Zeitraum</span>
          <span>Status</span>
          <span className="w-4" />
        </div>
      </header>

      <ul className="divide-y">
        {filtered.map((t) => (
          <li key={t.id}>
            <TaskRow
              task={t}
              company={t.company_id ? companyById[t.company_id] ?? null : null}
              expanded={expanded.has(t.id)}
              hasChildren={(childrenByParent.get(t.id) ?? 0) > 0}
              childrenCollapsed={collapsedParents.has(t.id)}
              attachmentCount={attCount.get(t.id) ?? 0}
              isDropTarget={dragState?.targetId === t.id}
              dragLocked={!!dragState}
              onToggleExpand={() => toggleExpand(t.id)}
              onToggleChildren={() => toggleChildren(t.id)}
              onEdit={() => setEditTaskId(t.id)}
              onCycleStatus={() => applyUpdate(t.id, { status: nextStatus(t.status, statusMeta.order) }, `Status: „${t.title || 'Aufgabe'}"`)}
              onIndent={() => handleIndent(t)}
              onOutdent={() => handleOutdent(t)}
              onAddSubtask={() => handleAddSubtask(t)}
              onLongPressStart={(x, y) => handleLongPressStart(t.id, x, y)}
            />
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Aufgaben gefunden.</li>
        )}
      </ul>

      <TaskDetailSheet
        task={editTask}
        open={!!editTaskId}
        onOpenChange={(o) => { if (!o) setEditTaskId(null); }}
      />

      {dragState && draggedTask && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 rounded-md border bg-card shadow-lg text-sm max-w-[80vw] truncate"
          style={{
            left: dragState.x,
            top: dragState.y,
            transform: 'translate(-50%, -120%)',
          }}
        >
          {draggedTask.title || '(ohne Titel)'}
          {dragState.targetId && (
            <span className="ml-2 text-xs text-primary">→ Unteraufgabe</span>
          )}
        </div>
      )}
    </div>
  );
}
