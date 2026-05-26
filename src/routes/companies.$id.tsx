import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanies } from '@/lib/queries';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';
import { makeMapHref } from '@/lib/contact-actions';
import type { Company } from '@/lib/types';
import { toast } from 'sonner';

export const Route = createFileRoute('/companies/$id')({
  head: () => ({ meta: [{ title: 'Unternehmen bearbeiten' }] }),
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const company = companies.find((c) => c.id === id) ?? null;
  const [draft, setDraft] = useState<Company | null>(null);

  useEffect(() => { setDraft(company); }, [company?.id]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Company>) => {
      const { error } = await supabase.from('companies').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); nav({ to: '/companies' }); },
  });

  if (!draft) return <div className="p-4 text-sm text-muted-foreground">Lade…</div>;

  function field<K extends keyof Company>(key: K, value: Company[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function commit<K extends keyof Company>(key: K) {
    if (!draft) return;
    save.mutate({ [key]: draft[key] } as Partial<Company>);
  }

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-2">
        <Link to="/companies" className="p-1 -m-1"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-base font-semibold flex-1 truncate">{draft.name}</h1>
      </header>

      <div className="p-4 space-y-3">
        <div><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => field('name', e.target.value)} onBlur={() => commit('name')} /></div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div><Label className="text-xs">Kürzel (2 Zeichen)</Label><Input value={draft.kuerzel} maxLength={4} onChange={(e) => field('kuerzel', e.target.value.toUpperCase())} onBlur={() => commit('kuerzel')} /></div>
          <div>
            <Label className="text-xs">Farbe</Label>
            <div className="flex items-center gap-2">
              <Input type="color" className="h-9 w-12 p-1" value={draft.color ?? '#64748b'} onChange={(e) => { field('color', e.target.value); save.mutate({ color: e.target.value }); }} />
              <span className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-semibold uppercase" style={{ backgroundColor: draft.color ?? '#64748b', color: '#fff' }}>{draft.kuerzel}</span>
            </div>
          </div>
        </div>
        <div><Label className="text-xs">Kontaktperson</Label><Input value={draft.kontaktperson ?? ''} onChange={(e) => field('kontaktperson', e.target.value || null)} onBlur={() => commit('kontaktperson')} /></div>
        <div><Label className="text-xs">Telefon</Label><Input type="tel" value={draft.telefon ?? ''} onChange={(e) => field('telefon', e.target.value || null)} onBlur={() => commit('telefon')} /></div>
        <div><Label className="text-xs">E-Mail</Label><Input type="email" value={draft.email ?? ''} onChange={(e) => field('email', e.target.value || null)} onBlur={() => commit('email')} /></div>
        <div>
          <Label className="text-xs">Adresse</Label>
          <div className="flex items-center gap-2">
            <Input value={draft.adresse ?? ''} onChange={(e) => field('adresse', e.target.value || null)} onBlur={() => commit('adresse')} />
            <a
              href={makeMapHref(draft.adresse) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="In Karten-App öffnen"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${draft.adresse ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/40 pointer-events-none'}`}
              onClick={(e) => { if (!draft.adresse) e.preventDefault(); }}
            >
              <MapPin className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div><Label className="text-xs">Web</Label><Input value={draft.web ?? ''} onChange={(e) => field('web', e.target.value || null)} onBlur={() => commit('web')} /></div>
        <div><Label className="text-xs">Notizen</Label><Textarea rows={3} value={draft.notes ?? ''} onChange={(e) => field('notes', e.target.value || null)} onBlur={() => commit('notes')} /></div>
        <label className="flex items-center justify-between border rounded-md px-3 py-2">
          <span className="text-sm">Standardmäßig in CC setzen</span>
          <Switch checked={draft.is_default_cc} onCheckedChange={(v) => { field('is_default_cc', v); save.mutate({ is_default_cc: v }); }} />
        </label>
        <Button variant="ghost" className="text-destructive w-full" onClick={() => { if (confirm('Unternehmen löschen?')) remove.mutate(); }}>
          <Trash2 className="h-4 w-4 mr-1" /> Löschen
        </Button>
      </div>
    </div>
  );
}
