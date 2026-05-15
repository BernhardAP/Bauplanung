import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanies, fetchTasks, flattenTree } from '@/lib/queries';
import { TaskRow, NewTaskRow, nextStatus } from '@/components/task-row';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import type { Task } from '@/lib/types';
import { toast } from 'sonner';

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
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const ordered = useMemo(() => flattenTree(tasks), [tasks]);
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const openTask = ordered.find((t) => t.id === openTaskId) ?? null;

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async ({ title, parent_id, depth, sort_order }: {
      title: string; parent_id: string | null; depth: number; sort_order: number;
    }) => {
      const { error } = await supabase.from('tasks').insert({ title, parent_id, depth, sort_order });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  function handleIndent(task: Task) {
    // find previous sibling (same parent) in ordered list
    const sameParent = tasks.filter((t) => t.parent_id === task.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameParent.findIndex((t) => t.id === task.id);
    if (idx <= 0) { toast.info('Keine vorherige Schwester-Aufgabe zum Einrücken'); return; }
    const newParent = sameParent[idx - 1];
    updateTask.mutate({ id: task.id, patch: { parent_id: newParent.id, depth: newParent.depth + 1 } });
  }

  function handleOutdent(task: Task) {
    if (!task.parent_id) { toast.info('Schon auf oberster Ebene'); return; }
    const parent = tasks.find((t) => t.id === task.parent_id);
    if (!parent) return;
    updateTask.mutate({ id: task.id, patch: { parent_id: parent.parent_id, depth: parent.depth } });
  }

  function handleCreateAtEnd(title: string) {
    const maxOrder = tasks.reduce((m, t) => (t.parent_id === null ? Math.max(m, t.sort_order) : m), 0);
    createTask.mutate({ title, parent_id: null, depth: 0, sort_order: maxOrder + 1000 });
  }

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Bauplanung Leiwen</h1>
          <p className="text-xs text-muted-foreground">{ordered.length} Aufgaben · Swipe ⇆ für Hierarchie</p>
        </div>
      </header>

      <ul className="divide-y">
        {ordered.map((t) => (
          <li key={t.id}>
            <TaskRow
              task={t}
              company={t.company_id ? companyById[t.company_id] ?? null : null}
              onTap={() => setOpenTaskId(t.id)}
              onCycleStatus={() => updateTask.mutate({ id: t.id, patch: { status: nextStatus(t.status) } })}
              onIndent={() => handleIndent(t)}
              onOutdent={() => handleOutdent(t)}
            />
          </li>
        ))}
        <li>
          <NewTaskRow onCreate={handleCreateAtEnd} />
        </li>
      </ul>

      <TaskDetailSheet
        task={openTask}
        open={!!openTaskId}
        onOpenChange={(o) => { if (!o) setOpenTaskId(null); }}
      />
    </div>
  );
}
