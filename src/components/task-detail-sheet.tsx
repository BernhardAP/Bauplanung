import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAttachments, fetchCompanies } from '@/lib/queries';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/types';
import { StatusIcon } from '@/lib/status-icon';
import { toast } from 'sonner';

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailSheet({ task, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Task | null>(null);
  const [extraCc, setExtraCc] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

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
      const { error } = await supabase.from('tasks').update(patch).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!task) return;
      const path = `${task.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) throw error;
      const ext = file.name.toLowerCase();
      const kind = ext.endsWith('.msg') || ext.endsWith('.eml') ? 'email' : 'document';
      const { error: e2 } = await supabase.from('attachments').insert({
        task_id: task.id, filename: file.name, storage_path: path, mime_type: file.type || null, kind,
      });
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', task?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAttachment = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      await supabase.storage.from('attachments').remove([a.storage_path]);
      await supabase.from('attachments').delete().eq('id', a.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', task?.id] }),
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
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
                  <SelectItem key={c.id} value={c.id}>{c.kuerzel} · {c.name}</SelectItem>
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
            <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" /> Anhänge</Label>
            <ul className="mt-1 space-y-1">
              {attachments.map((a) => {
                const url = supabase.storage.from('attachments').getPublicUrl(a.storage_path).data.publicUrl;
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate underline-offset-2 hover:underline">
                      {a.kind === 'email' ? '✉️' : '📎'} {a.filename}
                    </a>
                    <button onClick={() => removeAttachment.mutate(a)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <input ref={fileInput} type="file" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '';
            }} />
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Datei hinzufügen
            </Button>
          </div>

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
