import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Backup = {
  version: 1;
  exported_at: string;
  companies: any[];
  tasks: any[];
  attachments: any[];
  status_settings?: any[];
};

async function fetchAll(): Promise<Backup> {
  const [companies, tasks, attachments, statusSettings] = await Promise.all([
    supabase.from('companies').select('*').order('kuerzel'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase.from('attachments').select('*').order('created_at'),
    supabase.from('status_settings').select('*').order('sort_order'),
  ]);
  if (companies.error) throw companies.error;
  if (tasks.error) throw tasks.error;
  if (attachments.error) throw attachments.error;
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    companies: companies.data ?? [],
    tasks: tasks.data ?? [],
    attachments: attachments.data ?? [],
    status_settings: statusSettings.data ?? [],
  };
}

export function BackupPanel() {
  const [data, setData] = useState<Backup | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await fetchAll()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const download = async () => {
    const d = data ?? (await fetchAll());
    if (!data) setData(d);
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `bauplanung-backup-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup heruntergeladen');
  };

  const copy = async () => {
    const d = data ?? (await fetchAll());
    if (!data) setData(d);
    await navigator.clipboard.writeText(JSON.stringify(d, null, 2));
    toast.success('In Zwischenablage kopiert');
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Backup;
      if (!parsed.companies || !parsed.tasks) throw new Error('Ungültige Backup-Datei');
      if (!confirm(`Wirklich wiederherstellen? Alle aktuellen Daten werden überschrieben.\n\n${parsed.companies.length} Unternehmen, ${parsed.tasks.length} Aufgaben, ${parsed.attachments?.length ?? 0} Anhänge`)) {
        setImporting(false);
        return;
      }
      await supabase.from('attachments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (parsed.companies.length) {
        const { error } = await supabase.from('companies').insert(parsed.companies);
        if (error) throw error;
      }
      if (parsed.tasks.length) {
        const { error } = await supabase.from('tasks').insert(parsed.tasks);
        if (error) throw error;
      }
      if (parsed.attachments?.length) {
        const { error } = await supabase.from('attachments').insert(parsed.attachments);
        if (error) throw error;
      }
      if (parsed.status_settings?.length) {
        for (const row of parsed.status_settings) {
          await supabase.from('status_settings').update({
            label: row.label, sort_order: row.sort_order, color: row.color,
          }).eq('status', row.status);
        }
      }
      toast.success('Backup wiederhergestellt');
      setData(await fetchAll());
    } catch (e: any) {
      toast.error(`Import fehlgeschlagen: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Alle Daten als JSON. Lade die Datei herunter und speichere sie als Backup.
        </p>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={download}>
          <Download className="h-4 w-4 mr-2" />
          Herunterladen
        </Button>
        <Button variant="outline" onClick={copy}>Kopieren</Button>
      </div>

      <div className="border rounded-lg p-3 space-y-2">
        <h2 className="text-sm font-medium">Wiederherstellen</h2>
        <p className="text-xs text-muted-foreground">Achtung: Ersetzt alle aktuellen Daten.</p>
        <input
          type="file"
          accept="application/json,.json"
          disabled={importing}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
          className="text-xs w-full"
        />
      </div>

      {data && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 text-xs flex justify-between">
            <span>
              {data.companies.length} Unternehmen · {data.tasks.length} Aufgaben · {data.attachments.length} Anhänge
            </span>
            <span className="text-muted-foreground">v{data.version}</span>
          </div>
          <pre className="text-[10px] leading-tight p-3 overflow-auto max-h-[50vh] bg-background">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
