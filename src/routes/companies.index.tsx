import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchCompanies } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Plus, Phone, Mail } from 'lucide-react';

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

  const createCompany = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('companies').insert({ name: 'Neues Unternehmen', kuerzel: 'NEU' }).select().single();
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
            <h1 className="text-lg font-semibold">Unternehmen</h1>
            <p className="text-xs text-muted-foreground">{companies.length} Kontakte</p>
          </div>
          <Button size="sm" onClick={() => createCompany.mutate()}><Plus className="h-4 w-4 mr-1" /> Neu</Button>
        </div>
      </header>

      <ul className="divide-y">
        {companies.map((c) => (
          <li key={c.id}>
            <Link to="/companies/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3">
              <div className="shrink-0 w-12 text-[10px] uppercase font-semibold tracking-wide rounded bg-secondary px-1.5 py-1 text-center text-secondary-foreground">
                {c.kuerzel}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}{c.is_default_cc && <span className="ml-2 text-[10px] text-accent-foreground bg-accent px-1.5 py-0.5 rounded">Default-CC</span>}</div>
                <div className="text-xs text-muted-foreground truncate">{c.kontaktperson ?? ''}</div>
              </div>
              <div className="flex gap-1 text-muted-foreground">
                {c.telefon && <a href={`tel:${c.telefon.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()}><Phone className="h-4 w-4" /></a>}
                {c.email && <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}><Mail className="h-4 w-4" /></a>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
