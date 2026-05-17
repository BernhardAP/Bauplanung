import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchTasks, fetchCompanies } from '@/lib/queries';
import { CompanyBadge } from '@/components/company-badge';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpButton } from '@/components/help-button';

export const Route = createFileRoute('/costs')({
  head: () => ({
    meta: [
      { title: 'Kostenstatus — Bauplanung Leiwen' },
      { name: 'description', content: 'Übersicht aller Aufgaben mit Kosten und Summen.' },
    ],
  }),
  component: CostsPage,
});

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v));

function CostsPage() {
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const rows = useMemo(
    () =>
      tasks
        .filter((t) => t.planned_cost != null || t.offered_price != null || t.final_price != null)
        .sort((a, b) => a.title.localeCompare(b.title, 'de')),
    [tasks],
  );

  const currentOf = (t: typeof rows[number]) =>
    t.final_price != null ? Number(t.final_price)
      : t.offered_price != null ? Number(t.offered_price)
      : t.planned_cost != null ? Number(t.planned_cost)
      : null;

  const sum = (key: 'planned_cost' | 'offered_price' | 'final_price') =>
    rows.reduce((s, t) => s + (t[key] != null ? Number(t[key]) : 0), 0);

  const totals = {
    current: rows.reduce((s, t) => s + (currentOf(t) ?? 0), 0),
    planned: sum('planned_cost'),
    offered: sum('offered_price'),
    final: sum('final_price'),
  };

  const [showDetails, setShowDetails] = useState(true);

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg md:text-xl font-semibold">Kostenstatus</h1>
          <HelpButton title="Kostenstatus">
            <p>Übersicht aller Aufgaben mit Kosten.</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><b>Geplant</b>: erste Schätzung</li>
              <li><b>Angebot</b>: erhaltenes Angebot</li>
              <li><b>Final</b>: tatsächlicher Endbetrag</li>
              <li><b>Aktuell</b>: bester verfügbarer Wert (Final → Angebot → Geplant)</li>
              <li>Pfeil neben „Aktuell“ blendet die Detailspalten ein/aus</li>
              <li>Aufgabe antippen zum Bearbeiten</li>
            </ul>
          </HelpButton>
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} Aufgaben mit Kosten</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
              <th className="text-left font-normal px-4 py-2">Aufgabe</th>
              <th className="text-left font-normal px-2 py-2">Unternehmen</th>
              <th className="text-right font-normal px-2 py-2">
                <div className="inline-flex items-center gap-1">
                  <span>Aktuell</span>
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                    aria-label={showDetails ? 'Detailspalten ausblenden' : 'Detailspalten einblenden'}
                    title={showDetails ? 'Detailspalten ausblenden' : 'Detailspalten einblenden'}
                  >
                    {showDetails ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </th>
              {showDetails && (
                <>
                  <th className="text-right font-normal px-2 py-2">Geplant</th>
                  <th className="text-right font-normal px-2 py-2">Angebot</th>
                  <th className="text-right font-normal px-4 py-2">Final</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((t) => {
              const c = t.company_id ? companyById[t.company_id] : null;
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2">
                    <Link to="/" className="hover:underline">{t.title || '(ohne Titel)'}</Link>
                  </td>
                  <td className="px-2 py-2">{c ? <CompanyBadge company={c} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{fmt(currentOf(t))}</td>
                  {showDetails && (
                    <>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(t.planned_cost)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(t.offered_price)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(t.final_price)}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={showDetails ? 6 : 3} className="px-4 py-8 text-center text-muted-foreground">Keine Aufgaben mit Kosten.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-semibold bg-muted/40">
                <td className="px-4 py-2" colSpan={2}>Summe</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.current)}</td>
                {showDetails && (
                  <>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.planned)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.offered)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.final)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
