import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Mail } from 'lucide-react';
import { listOutlookMessages, saveOutlookEmailToOnedrive, type OutlookMessage } from '@/lib/outlook.functions';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: { name: string; webUrl: string; mimeType: string | null }) => void | Promise<void>;
}

export function OutlookPicker({ open, onOpenChange, onSaved }: Props) {
  const list = useServerFn(listOutlookMessages);
  const save = useServerFn(saveOutlookEmailToOnedrive);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) { setQ(''); setDebounced(''); }
  }, [open]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['outlook', debounced],
    queryFn: () => list({ data: { query: debounced || undefined } }),
    enabled: open,
    staleTime: 30_000,
  });

  const saving = useMutation({
    mutationFn: async (m: OutlookMessage) => {
      const res = await save({ data: { messageId: m.id, subject: m.subject } });
      return res;
    },
    onSuccess: async (res) => {
      await onSaved({ name: res.name, webUrl: res.webUrl, mimeType: res.mimeType });
      toast.success('E-Mail in Korrespondenz gespeichert');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>E-Mail aus Outlook anhängen</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-1">Ordner: Privat / Haus-Leiwen</div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mails durchsuchen…"
            className="pl-8"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 mt-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Lade…
            </div>
          )}
          {error && (
            <div className="py-4 text-sm text-destructive">{(error as Error).message}</div>
          )}
          {!isLoading && !error && (data?.items.length ?? 0) === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Keine Mails gefunden.</div>
          )}
          <ul className="divide-y">
            {data?.items.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => saving.mutate(m)}
                  disabled={saving.isPending}
                  className="w-full text-left flex items-start gap-2 py-2 px-1 hover:bg-muted disabled:opacity-50"
                >
                  <Mail className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate font-medium">{m.subject}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {m.from ?? 'unbekannt'}{m.receivedAt ? ` · ${new Date(m.receivedAt).toLocaleString('de-DE')}` : ''}
                    </div>
                    {m.preview && <div className="text-[11px] text-muted-foreground truncate">{m.preview}</div>}
                  </div>
                  {saving.isPending && saving.variables?.id === m.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
