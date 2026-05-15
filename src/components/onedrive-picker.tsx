import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Folder, FileText, ExternalLink, ChevronLeft } from 'lucide-react';
import { searchOnedrive, browseOnedrive, type OneDriveItem } from '@/lib/onedrive.functions';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: OneDriveItem) => void | Promise<void>;
}

interface Crumb { id?: string; name: string }

export function OnedrivePicker({ open, onOpenChange, onPick }: Props) {
  const search = useServerFn(searchOnedrive);
  const browse = useServerFn(browseOnedrive);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [stack, setStack] = useState<Crumb[]>([{ name: 'Leiwen' }]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) { setQ(''); setDebounced(''); setStack([{ name: 'Leiwen' }]); }
  }, [open]);

  const current = stack[stack.length - 1];
  const isSearching = debounced.trim().length > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: isSearching ? ['onedrive-search', debounced] : ['onedrive-browse', current.id ?? 'root'],
    queryFn: () => isSearching
      ? search({ data: { query: debounced } })
      : browse({ data: { folderId: current.id } }),
    enabled: open,
    staleTime: 30_000,
  });

  const pick = useMutation({
    mutationFn: async (item: OneDriveItem) => onPick(item),
    onSuccess: () => onOpenChange(false),
    onError: (e: Error) => toast.error(e.message),
  });

  const breadcrumb = stack.map((c) => c.name).join(' / ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>OneDrive-Datei verknüpfen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="In Privat/Haus/Leiwen suchen…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-h-6">
          {!isSearching && stack.length > 1 && (
            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setStack((s) => s.slice(0, -1))}>
              <ChevronLeft className="h-3 w-3" /> Zurück
            </Button>
          )}
          <span className="truncate">{isSearching ? 'Suche im gesamten Leiwen-Ordner' : breadcrumb}</span>
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
            <div className="py-8 text-center text-sm text-muted-foreground">Keine Treffer.</div>
          )}
          <ul className="divide-y">
            {data?.items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => {
                    if (it.isFolder) {
                      if (!isSearching) setStack((s) => [...s, { id: it.id, name: it.name }]);
                    } else {
                      pick.mutate(it);
                    }
                  }}
                  disabled={pick.isPending || (it.isFolder && isSearching)}
                  className="w-full text-left flex items-center gap-2 py-2 px-1 hover:bg-muted disabled:opacity-50"
                >
                  {it.isFolder ? (
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{it.name}</div>
                    {isSearching && it.parentPath && (
                      <div className="text-[11px] text-muted-foreground truncate">{it.parentPath}</div>
                    )}
                  </div>
                  {!it.isFolder && (
                    <a
                      href={it.webUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
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
