import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchStatusSettings, type StatusMetaRow } from '@/lib/use-status-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusIcon } from '@/lib/status-icon';
import { ArrowDown, ArrowUp, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskStatus } from '@/lib/types';

export function StatusManagementPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['status-settings'], queryFn: fetchStatusSettings });
  const [rows, setRows] = useState<StatusMetaRow[]>([]);

  useEffect(() => {
    if (!data) return;
    setRows(Object.values(data).sort((a, b) => a.sort_order - b.sort_order));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const updates = rows.map((r, i) =>
        supabase.from('status_settings').update({
          label: r.label.trim() || r.status,
          sort_order: i,
          color: r.color?.trim() || null,
        }).eq('status', r.status),
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      toast.success('Status gespeichert');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const update = (i: number, patch: Partial<StatusMetaRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Anzeigename, Reihenfolge und Farbe der Aufgaben-Status anpassen. Die Status selbst (Schlüssel)
        sind im System fest verankert.
      </p>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.status} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <StatusIcon status={r.status as TaskStatus} className="h-5 w-5" color={r.color ?? undefined} />
              <code className="text-xs text-muted-foreground">{r.status}</code>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} title="Nach oben">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Nach unten">
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label className="text-xs">Anzeigename</Label>
                <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Farbe</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={r.color ?? '#888888'}
                    onChange={(e) => update(i, { color: e.target.value })}
                    className="h-9 w-12 rounded border bg-transparent"
                  />
                  {r.color && (
                    <Button size="sm" variant="ghost" onClick={() => update(i, { color: null })}>
                      Standard
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
        {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Speichern
      </Button>
    </div>
  );
}
