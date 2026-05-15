import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchStatusSettings, type StatusMetaRow } from '@/lib/use-status-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusIcon } from '@/lib/status-icon';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskStatus } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function StatusManagementPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['status-settings'], queryFn: fetchStatusSettings });
  const [rows, setRows] = useState<StatusMetaRow[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#888888');
  const [deleteTarget, setDeleteTarget] = useState<StatusMetaRow | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number>(0);

  useEffect(() => {
    if (!data) return;
    setRows(Object.values(data).sort((a, b) => a.sort_order - b.sort_order));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      // Upsert all current rows with their new sort_order
      const payload = rows.map((r, i) => ({
        status: r.status,
        label: r.label.trim() || r.status,
        sort_order: i,
        color: r.color?.trim() || null,
      }));
      const { error } = await supabase.from('status_settings').upsert(payload, { onConflict: 'status' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Status gespeichert');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addStatus = useMutation({
    mutationFn: async () => {
      const label = newLabel.trim();
      if (!label) throw new Error('Bitte einen Namen eingeben');
      let key = slugify(label);
      if (!key) throw new Error('Ungültiger Name');
      // Ensure unique key
      const existing = new Set(rows.map((r) => r.status));
      if (existing.has(key)) {
        let i = 2;
        while (existing.has(`${key}_${i}`)) i++;
        key = `${key}_${i}`;
      }
      const sort_order = rows.length;
      const { error } = await supabase.from('status_settings').insert({
        status: key,
        label,
        sort_order,
        color: newColor || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewLabel('');
      setNewColor('#888888');
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      toast.success('Status hinzugefügt');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requestDelete = async (row: StatusMetaRow) => {
    if (rows.length <= 1) {
      toast.error('Mindestens ein Status muss vorhanden bleiben');
      return;
    }
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', row.status);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteUsage(count ?? 0);
    setDeleteTarget(row);
  };

  const confirmDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      // Reassign tasks to first remaining status
      const remaining = rows.filter((r) => r.status !== deleteTarget.status);
      const fallback = remaining[0]?.status ?? 'open';
      if (deleteUsage > 0) {
        const { error: updErr } = await supabase
          .from('tasks')
          .update({ status: fallback })
          .eq('status', deleteTarget.status);
        if (updErr) throw updErr;
      }
      const { error } = await supabase.from('status_settings').delete().eq('status', deleteTarget.status);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Status gelöscht');
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Status anlegen, umbenennen, einfärben, neu ordnen oder löschen. Beim Löschen werden vorhandene
        Aufgaben automatisch auf den ersten verbleibenden Status umgestellt.
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
                <Button size="icon" variant="ghost" onClick={() => requestDelete(r)} title="Löschen" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
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
        Änderungen speichern
      </Button>

      <div className="border rounded-lg p-3 space-y-2">
        <div className="text-sm font-medium">Neuen Status hinzufügen</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Anzeigename</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="z. B. Zur Prüfung"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) addStatus.mutate();
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Farbe</Label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-12 rounded border bg-transparent"
            />
          </div>
          <Button onClick={() => addStatus.mutate()} disabled={addStatus.isPending || !newLabel.trim()}>
            {addStatus.isPending ? <Loader2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Status „{deleteTarget?.label}" löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUsage > 0
                ? `${deleteUsage} Aufgabe(n) verwenden diesen Status und werden auf „${
                    rows.find((r) => r.status !== deleteTarget?.status)?.label ?? 'Offen'
                  }" umgestellt.`
                : 'Dieser Status wird aktuell von keiner Aufgabe verwendet.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
