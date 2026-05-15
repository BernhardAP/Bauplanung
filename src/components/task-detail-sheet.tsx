import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Link2, Trash2, X, ExternalLink, Inbox } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAttachments, fetchCompanies } from '@/lib/queries';
import type { Task, TaskStatus } from '@/lib/types';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/types';
import { StatusIcon } from '@/lib/status-icon';
import { OnedrivePicker } from '@/components/onedrive-picker';
import { OutlookPicker } from '@/components/outlook-picker';
import { toast } from 'sonner';
import { undoStore } from '@/lib/undo-store';

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Task | null>(null);
  const [extraCc, setExtraCc] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);

  useEffect(() => { setDraft(task); setExtraCc([]); }, [task?.id, open]);

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', task?.id],
    queryFn: () => fetchAttachments(task!.id),
    enabled: !!task?.id && open,
  });

  const company = companies.find((c) => c.id === draft?.company_id) ?? null;
  const defaultCcCompanies = companies.filter((c) => c.is_default_cc);

  const save = useMutation({
    mutationFn: async (patch: Partial<Task>) => {
      if (!task) return;
      // capture inverse from the (server-truth) task prop
      const prev: Partial<Task> = {};
      for (const k of Object.keys(patch) as (keyof Task)[]) {
        (prev as Record<string, unknown>)[k] = task[k];
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
      if (error) throw error;
      const taskId = task.id;
      const label = `Bearbeitet: „${task.title || 'Aufgabe'}"`;
      undoStore.push(label, async () => {
        const { error: e } = await supabase.from('tasks').update(prev).eq('id', taskId);
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ['tasks'] });
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const addLink = useMutation({
    mutationFn: async (item: { name: string; webUrl: string; mimeType: string | null }) => {
      if (!task) return;
      const { data, error } = await supabase.from('attachments').insert({
        task_id: task.id,
        filename: item.name,
        url: item.webUrl,
        storage_path: null,
        mime_type: item.mimeType,
        kind: 'link',
      }).select('id').single();
      if (error) throw error;
      const taskId = task.id;
      const newId = data?.id;
      if (newId) {
        undoStore.push(`Verknüpfung „${item.name}" hinzugefügt`, async () => {
          const { error: e } = await supabase.from('attachments').delete().eq('id', newId);
          if (e) throw e;
          qc.invalidateQueries({ queryKey: ['attachments', taskId] });
          qc.invalidateQueries({ queryKey: ['attachments-all'] });
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', task?.id] });
      qc.invalidateQueries({ queryKey: ['attachments-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAttachment = useMutation({
    mutationFn: async (a: { id: string; storage_path: string | null; kind: string; filename: string; url: string | null; mime_type: string | null }) => {
      if (a.kind !== 'link' && a.storage_path) {
        await supabase.storage.from('attachments').remove([a.storage_path]);
      }
      await supabase.from('attachments').delete().eq('id', a.id);
      const taskId = task?.id;
      if (taskId) {
        const snapshot = { ...a, task_id: taskId };
        undoStore.push(`Dokument „${a.filename}" gelöscht`, async () => {
          const { error } = await supabase.from('attachments').insert({
            id: snapshot.id,
            task_id: snapshot.task_id,
            filename: snapshot.filename,
            url: snapshot.url,
            storage_path: snapshot.storage_path,
            mime_type: snapshot.mime_type,
            kind: snapshot.kind as 'document' | 'email' | 'link',
          });
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ['attachments', taskId] });
          qc.invalidateQueries({ queryKey: ['attachments-all'] });
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', task?.id] });
      qc.invalidateQueries({ queryKey: ['attachments-all'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const snapshot = { ...task };
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
      undoStore.push(`Aufgabe „${snapshot.title || 'ohne Titel'}" gelöscht`, async () => {
        const { error: e } = await supabase.from('tasks').insert({
          id: snapshot.id,
          title: snapshot.title,
          parent_id: snapshot.parent_id,
          depth: snapshot.depth,
          sort_order: snapshot.sort_order,
          status: snapshot.status,
          company_id: snapshot.company_id,
          start_date: snapshot.start_date,
          end_date: snapshot.end_date,
          notes: snapshot.notes,
        });
        if (e) throw e;
        qc.invalidateQueries({ queryKey: ['tasks'] });
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onOpenChange(false); },
  });

  if (!draft) return null;

  function patch<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    save.mutate({ [key]: value } as Partial<Task>);
  }

  function buildMailto(): string | null {
    if (!company?.email) return null;
    const ccEmails = [
      ...defaultCcCompanies.filter((c) => c.id !== company.id && c.email).map((c) => c.email!),
      ...extraCc,
    ];
    const params = new URLSearchParams();
    if (ccEmails.length) params.set('cc', Array.from(new Set(ccEmails)).join(','));
    if (draft?.title) params.set('subject', draft.title);
    if (draft?.notes) params.set('body', draft.notes);
    return `mailto:${company.email}?${params.toString()}`;
  }

  const mailHref = buildMailto();
  const telHref = company?.telefon ? `tel:${company.telefon.replace(/\s+/g, '')}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-left text-base">Aufgabe bearbeiten</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-2 px-1">
          <div>
            <Label htmlFor="title" className="text-xs">Titel</Label>
            <Input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onBlur={() => save.mutate({ title: draft.title })} />
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select value={draft.status} onValueChange={(v) => patch('status', v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="inline-flex items-center gap-2"><StatusIcon status={s} className="h-4 w-4" /> {STATUS_LABEL[s]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Unternehmen</Label>
            <Select value={draft.company_id ?? 'none'} onValueChange={(v) => patch('company_id', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Keines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— keines —</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? '#64748b' }} />
                      {c.kuerzel} · {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start" className="text-xs">Start</Label>
              <Input id="start" type="date" value={draft.start_date ?? ''}
                onChange={(e) => patch('start_date', e.target.value || null)} />
            </div>
            <div>
              <Label htmlFor="end" className="text-xs">Ende</Label>
              <Input id="end" type="date" value={draft.end_date ?? ''}
                onChange={(e) => patch('end_date', e.target.value || null)} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-xs">Notizen</Label>
            <Textarea id="notes" rows={4} value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              onBlur={() => save.mutate({ notes: draft.notes })} />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Dokumente (OneDrive)</Label>
            <ul className="mt-1 space-y-1">
              {attachments.map((a) => {
                const href = a.kind === 'link'
                  ? a.url ?? '#'
                  : (a.storage_path ? supabase.storage.from('attachments').getPublicUrl(a.storage_path).data.publicUrl : '#');
                const icon = a.kind === 'link' ? '🔗' : a.kind === 'email' ? '✉️' : '📎';
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <a href={href} target="_blank" rel="noreferrer" className="flex-1 truncate inline-flex items-center gap-1 underline-offset-2 hover:underline">
                      <span>{icon}</span>
                      <span className="truncate">{a.filename}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <button onClick={() => removeAttachment.mutate(a)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
              {attachments.length === 0 && (
                <li className="text-xs text-muted-foreground">Noch keine Dokumente verknüpft.</li>
              )}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPickerOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" /> OneDrive-Datei verknüpfen
            </Button>
          </div>

          <OnedrivePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={(item) => addLink.mutateAsync({ name: item.name, webUrl: item.webUrl, mimeType: item.mimeType })}
          />

          {company && (
            <div className="space-y-2 border-t pt-3">
              <div className="text-xs text-muted-foreground">{company.name}{company.kontaktperson ? ` · ${company.kontaktperson}` : ''}</div>
              {companies.filter((c) => c.id !== company.id && c.email).length > 0 && (
                <div>
                  <div className="text-xs mb-1">Weitere CC (Standard: Hoffmann immer dabei)</div>
                  <div className="flex flex-wrap gap-2">
                    {companies.filter((c) => c.id !== company.id && c.email && !c.is_default_cc).map((c) => (
                      <label key={c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border">
                        <Checkbox checked={extraCc.includes(c.email!)} onCheckedChange={(v) => {
                          setExtraCc((cur) => v ? [...cur, c.email!] : cur.filter((e) => e !== c.email));
                        }} />
                        {c.kuerzel}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button asChild className="flex-1" disabled={!telHref}>
                  <a href={telHref ?? '#'}><Phone className="h-4 w-4 mr-1" /> Anrufen</a>
                </Button>
                <Button asChild variant="secondary" className="flex-1" disabled={!mailHref}>
                  <a href={mailHref ?? '#'}><Mail className="h-4 w-4 mr-1" /> E-Mail</a>
                </Button>
              </div>
            </div>
          )}

          <div className="border-t pt-3 flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Schließen
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive"
              onClick={() => { if (confirm('Aufgabe inkl. Unteraufgaben löschen?')) deleteTask.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Löschen
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
