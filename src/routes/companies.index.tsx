import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanies } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { CompanyBadge } from '@/components/company-badge';
import { Plus, Phone, Mail, MapPin, Search, X } from 'lucide-react';
import { HelpButton } from '@/components/help-button';
import { makeMapHref } from '@/lib/contact-actions';

export const Route = createFileRoute('/companies/')({
  head: () => ({
    meta: [
      { title: 'Unternehmen — Bauplanung Leiwen' },
      { name: 'description', content: 'Beteiligte Unternehmen, Gewerke und Kontakte.' },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const [search, setSearch] = useState('');
  const [onlyDefaultCc, setOnlyDefaultCc] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (onlyDefaultCc && !c.is_default_cc) return false;
      if (!q) return true;
      return [c.name, c.kuerzel, c.kontaktperson, c.email, c.telefon]
        .some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [companies, search, onlyDefaultCc]);

  const createCompany = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('companies').insert({ name: 'Neues Unternehmen', kuerzel: 'NN', color: '#64748b' }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold">Unternehmen</h1>
              <HelpButton title="Unternehmen & Kontakte">
                <p>Hier pflegst Du alle beteiligten Firmen und Gewerke.</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Neu</b>: Unternehmen anlegen</li>
                  <li><b>Suchen</b>: Name, Kürzel oder Kontaktperson</li>
                  <li><b>Standard-CC</b>: Filter für Firmen, die bei Mails immer auf CC stehen</li>
                  <li>Tippen öffnet das Detailprofil (Telefon, Mail, Notizen)</li>
                </ul>
              </HelpButton>
            </div>
            <p className="text-xs text-muted-foreground">{filtered.length}{filtered.length !== companies.length ? ` / ${companies.length}` : ''} Kontakte</p>
          </div>
          <Button size="sm" onClick={() => createCompany.mutate()}><Plus className="h-4 w-4 mr-1" /> Neu</Button>
        </div>
        <div className="px-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen (Name, Kürzel, Kontakt…)"
              className="w-full pl-7 pr-7 py-1.5 text-sm rounded-md border bg-background outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setOnlyDefaultCc((v) => !v)}
            className={`text-xs px-2 py-1 rounded-full border ${onlyDefaultCc ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground'}`}
          >
            Nur Standard-CC
          </button>
        </div>
      </header>

      <ul className="divide-y">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link to="/companies/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3">
              <CompanyBadge company={c} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {c.name}
                  {c.is_default_cc && <span className="ml-2 text-[10px] text-accent-foreground bg-accent px-1.5 py-0.5 rounded">Default-CC</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.kontaktperson ?? ''}</div>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                {c.telefon && <a href={`tel:${c.telefon.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()}><Phone className="h-4 w-4" /></a>}
                {c.email && <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}><Mail className="h-4 w-4" /></a>}
                {c.adresse && <a href={makeMapHref(c.adresse)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><MapPin className="h-4 w-4" /></a>}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Treffer.</li>}
      </ul>
    </div>
  );
}
