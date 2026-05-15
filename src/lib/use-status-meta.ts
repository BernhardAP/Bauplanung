import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TaskStatus } from './types';
import { STATUS_LABEL, STATUS_ORDER } from './types';

export type StatusMetaRow = {
  status: TaskStatus;
  label: string;
  sort_order: number;
  color: string | null;
};

const DEFAULTS: Record<TaskStatus, StatusMetaRow> = Object.fromEntries(
  STATUS_ORDER.map((s, i) => [s, { status: s, label: STATUS_LABEL[s], sort_order: i, color: null }]),
) as Record<TaskStatus, StatusMetaRow>;

export async function fetchStatusSettings(): Promise<Record<TaskStatus, StatusMetaRow>> {
  const { data, error } = await supabase.from('status_settings').select('*');
  if (error) throw error;
  const merged = { ...DEFAULTS };
  for (const r of data ?? []) {
    if ((r as any).status in merged) {
      merged[(r as any).status as TaskStatus] = r as StatusMetaRow;
    }
  }
  return merged;
}

export function useStatusMeta() {
  const { data } = useQuery({
    queryKey: ['status-settings'],
    queryFn: fetchStatusSettings,
    staleTime: 30_000,
  });
  const meta = data ?? DEFAULTS;
  const order = (Object.values(meta) as StatusMetaRow[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.status);
  return { meta, order };
}
