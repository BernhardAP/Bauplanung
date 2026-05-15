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

const DEFAULTS: Record<string, StatusMetaRow> = Object.fromEntries(
  STATUS_ORDER.map((s, i) => [s, { status: s, label: STATUS_LABEL[s], sort_order: i, color: null }]),
);

export async function fetchStatusSettings(): Promise<Record<string, StatusMetaRow>> {
  const { data, error } = await supabase.from('status_settings').select('*');
  if (error) throw error;
  if (!data || data.length === 0) return { ...DEFAULTS };
  const merged: Record<string, StatusMetaRow> = {};
  for (const r of data) {
    merged[(r as any).status] = r as StatusMetaRow;
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

export function getStatusLabel(meta: Record<string, StatusMetaRow>, status: string): string {
  return meta[status]?.label ?? status;
}
