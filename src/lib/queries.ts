import { supabase } from '@/integrations/supabase/client';
import type { Task, Company, Attachment } from './types';

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase.from('companies').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function fetchAttachments(taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at');
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

/** Tree-aware ordering: returns tasks in display order based on parent_id + sort_order. */
export function flattenTree(tasks: Task[]): Task[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const k = t.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(t);
    byParent.set(k, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
  const out: Task[] = [];
  const walk = (parent: string | null) => {
    for (const t of byParent.get(parent) ?? []) {
      out.push(t);
      walk(t.id);
    }
  };
  walk(null);
  return out;
}
