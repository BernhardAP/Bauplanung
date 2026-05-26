import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUndoEntries, undoStore } from '@/lib/undo-store';
import { toast } from 'sonner';

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m}m`;
  const h = Math.round(m / 60);
  return `vor ${h}h`;
}

export function UndoButton() {
  const entries = useUndoEntries();
  const [open, setOpen] = useState(false);

  async function runEntry(id: string, label: string) {
    setOpen(false);
    try {
      await undoStore.run(id);
      toast.success(`Rückgängig: ${label}`);
    } catch (e) {
      toast.error(`Fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  const last = entries[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center rounded-md border bg-background overflow-hidden">
        <button
          onClick={() => last && runEntry(last.id, last.label)}
          disabled={!last}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs disabled:opacity-40 hover:bg-muted"
          title={last ? `Rückgängig: ${last.label}` : 'Nichts rückgängig zu machen'}
        >
          <Undo2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Rückgängig</span>
        </button>
        <PopoverTrigger asChild>
          <button
            disabled={entries.length === 0}
            className="px-1.5 py-1 text-xs border-l disabled:opacity-40 hover:bg-muted"
            aria-label="Verlauf"
          >
            ▾
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-72 p-0 max-h-80 overflow-y-auto">
        <div className="px-3 py-2 text-xs text-muted-foreground border-b">Letzte Änderungen</div>
        {entries.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground">Keine Einträge</div>
        )}
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => runEntry(e.id, e.label)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
              >
                <span className="truncate">{e.label}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(e.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
