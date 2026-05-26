import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchStatusSettings, type StatusMetaRow } from '@/lib/use-status-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ICON_NAMES, getIcon } from '@/lib/icon-map';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string | null;
  color: string | null;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const Current = getIcon(value);
  const filtered = ICON_NAMES.filter((n) => n.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" type="button" title="Symbol wählen">
          <Current className="h-5 w-5" style={color ? { color } : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Symbol suchen…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-2 h-8"
        />
        <ScrollArea className="h-64">
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((name) => {
              const I = getIcon(name);
              const selected = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={`flex h-8 w-8 items-center justify-center rounded hover:bg-accent ${selected ? 'bg-accent ring-1 ring-primary' : ''}`}
                  title={name}
                >
                  <I className="h-4 w-4" style={color ? { color } : undefined} />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({
  row,
  onChange,
  onDelete,
}: {
  row: StatusMetaRow;
  onChange: (patch: Partial<StatusMetaRow>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.status });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        title="Zum Verschieben gedrückt halten"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <IconPicker
        value={row.icon}
        color={row.color}
        onChange={(name) => onChange({ icon: name })}
      />
      <Input
        value={row.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Status-Name"
        className="flex-1"
      />
      <input
        type="color"
        value={row.color ?? '#888888'}
        onChange={(e) => onChange({ color: e.target.value })}
        className="h-9 w-10 cursor-pointer rounded border bg-transparent"
        title="Farbe"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="Löschen"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function StatusManagementPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['status-settings'], queryFn: fetchStatusSettings });
  const [rows, setRows] = useState<StatusMetaRow[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StatusMetaRow | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number>(0);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!data) return;
    setRows(Object.values(data).sort((a, b) => a.sort_order - b.sort_order));
    setDirty(false);
  }, [data]);

  const persist = async (next: StatusMetaRow[]) => {
    const payload = next.map((r, i) => ({
      status: r.status,
      label: r.label.trim() || r.status,
      sort_order: i,
      color: r.color?.trim() || null,
      icon: r.icon || null,
    }));
    const { error } = await supabase.from('status_settings').upsert(payload, { onConflict: 'status' });
    if (error) throw error;
  };

  const save = useMutation({
    mutationFn: () => persist(rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setDirty(false);
      toast.success('Gespeichert');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addStatus = useMutation({
    mutationFn: async () => {
      const label = newLabel.trim();
      if (!label) throw new Error('Bitte einen Namen eingeben');
      let key = slugify(label);
      if (!key) key = `status_${Date.now()}`;
      const existing = new Set(rows.map((r) => r.status));
      if (existing.has(key)) {
        let i = 2;
        while (existing.has(`${key}_${i}`)) i++;
        key = `${key}_${i}`;
      }
      const { error } = await supabase.from('status_settings').insert({
        status: key, label, sort_order: rows.length, color: null, icon: 'CircleDashed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewLabel('');
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
      .from('tasks').select('id', { count: 'exact', head: true }).eq('status', row.status);
    if (error) { toast.error(error.message); return; }
    setDeleteUsage(count ?? 0);
    setDeleteTarget(row);
  };

  const confirmDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const remaining = rows.filter((r) => r.status !== deleteTarget.status);
      const fallback = remaining[0]?.status ?? 'open';
      if (deleteUsage > 0) {
        const { error: updErr } = await supabase
          .from('tasks').update({ status: fallback }).eq('status', deleteTarget.status);
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

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.status === active.id);
    const newIndex = rows.findIndex((r) => r.status === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(rows, oldIndex, newIndex);
    setRows(next);
    // Persist reorder immediately
    persist(next).then(() => {
      qc.invalidateQueries({ queryKey: ['status-settings'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    }).catch((err) => toast.error(err.message));
  };

  const updateRow = (status: string, patch: Partial<StatusMetaRow>) => {
    setRows((prev) => prev.map((r) => (r.status === status ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Status anlegen, umbenennen, einfärben und mit Symbol versehen. Zum Sortieren den Griff
        gedrückt halten und ziehen. Beim Löschen werden vorhandene Aufgaben automatisch auf den
        ersten verbleibenden Status umgestellt.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.status)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((r) => (
              <SortableRow
                key={r.status}
                row={r}
                onChange={(patch) => updateRow(r.status, patch)}
                onDelete={() => requestDelete(r)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {dirty && (
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Änderungen speichern
        </Button>
      )}

      <div className="rounded-lg border p-3">
        <Label className="text-xs">Neuen Status hinzufügen</Label>
        <div className="mt-1 flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="z. B. Zur Prüfung"
            onKeyDown={(e) => { if (e.key === 'Enter' && newLabel.trim()) addStatus.mutate(); }}
          />
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
              onClick={(e) => { e.preventDefault(); confirmDelete.mutate(); }}
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
