import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCompanies, fetchTasks } from '@/lib/queries';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { CompanyBadge } from '@/components/company-badge';
import { StatusIcon } from '@/lib/status-icon';
import type { Task, TaskStatus } from '@/lib/types';
import { STATUS_ORDER, STATUS_LABEL } from '@/lib/types';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/timeline')({
  head: () => ({
    meta: [
      { title: 'Zeitplan — Bauplanung Leiwen' },
      { name: 'description', content: 'Aufgaben als Wochen-Timeline.' },
    ],
  }),
  component: TimelinePage,
});

const MS_PER_DAY = 86400000;

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function diffDays(a: Date, b: Date) { return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY); }
function fmtDay(d: Date) { return String(d.getDate()).padStart(2, '0'); }
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
}
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function TimelinePage() {
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies });
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(new Set());
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set());
  const filterActive = statusFilter.size + companyFilter.size > 0 || search.trim().length > 0;

  function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
    const n = new Set(set);
    if (n.has(item)) n.delete(item); else n.add(item);
    return n;
  }
  function clearFilters() { setStatusFilter(new Set()); setCompanyFilter(new Set()); setSearch(''); }

  const matches = (t: Task) => {
    if (statusFilter.size > 0 && !statusFilter.has(t.status)) return false;
    if (companyFilter.size > 0 && (!t.company_id || !companyFilter.has(t.company_id))) return false;
    const q = search.trim().toLowerCase();
    if (q && !(t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))) return false;
    return true;
  };

  // Split: dated (anything with start or end) vs undated
  const dated = useMemo(() => {
    return tasks
      .filter(matches)
      .filter((t) => t.start_date || t.end_date)
      .map((t) => {
        const s = parseDate(t.start_date) ?? parseDate(t.end_date)!;
        const e = parseDate(t.end_date) ?? parseDate(t.start_date)!;
        return { task: t, start: s, end: e };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  }, [tasks, search, statusFilter, companyFilter]);

  // Undated: only open (non-done)
  const undatedOpen = useMemo(
    () => tasks.filter(matches).filter((t) => !t.start_date && !t.end_date && t.status !== 'done'),
    [tasks, search, statusFilter, companyFilter],
  );

  // Date range for grid
  const today = startOfDay(new Date());
  const range = useMemo(() => {
    if (dated.length === 0) {
      const start = startOfWeek(addDays(today, -7));
      const end = addDays(start, 7 * 6); // 6 weeks
      return { start, end };
    }
    const minStart = dated.reduce((m, x) => (x.start < m ? x.start : m), dated[0].start);
    const maxEnd = dated.reduce((m, x) => (x.end > m ? x.end : m), dated[0].end);
    const start = startOfWeek(addDays(minStart < today ? minStart : today, -3));
    const lastBound = maxEnd > today ? maxEnd : today;
    let end = addDays(startOfWeek(lastBound), 7 * 2); // pad 2 weeks
    if (diffDays(end, start) < 7 * 4) end = addDays(start, 7 * 4);
    return { start, end };
  }, [dated, today]);

  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');
  const dayWidth = zoom === 'day' ? 32 : zoom === 'week' ? 12 : 5; // px per day
  const totalDays = diffDays(range.end, range.start) + 1;
  const labelWidth = 200; // sticky left column
  const gridWidth = totalDays * dayWidth;

  // Auto-scroll to today on mount / range change
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scrollerRef.current) return;
    const todayOffset = diffDays(today, range.start) * dayWidth;
    scrollerRef.current.scrollLeft = Math.max(0, todayOffset - 80);
  }, [range.start.getTime(), dayWidth]);

  function scrollBy(days: number) {
    scrollerRef.current?.scrollBy({ left: days * dayWidth, behavior: 'smooth' });
  }

  // Build month header segments
  const monthSegments = useMemo(() => {
    const segs: { label: string; days: number }[] = [];
    let cur = new Date(range.start);
    while (cur <= range.end) {
      const monthStart = new Date(cur);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const segEnd = nextMonth > range.end ? addDays(range.end, 1) : nextMonth;
      const days = diffDays(segEnd, monthStart);
      segs.push({ label: `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`, days });
      cur = nextMonth;
    }
    return segs;
  }, [range.start.getTime(), range.end.getTime()]);

  const todayOffset = diffDays(today, range.start);
  const todayInRange = todayOffset >= 0 && todayOffset < totalDays;

  return (
    <div>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Zeitplan</h1>
            <p className="text-xs text-muted-foreground">
              {dated.length} terminiert · {undatedOpen.length} offen ohne Datum
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="inline-flex rounded border bg-background overflow-hidden mr-1">
              {(['day', 'week', 'month'] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-2 py-1 text-xs ${zoom === z ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {z === 'day' ? 'Tag' : z === 'week' ? 'Woche' : 'Monat'}
                </button>
              ))}
            </div>
            <button onClick={() => scrollBy(-7)} className="p-1.5 rounded border bg-background hover:bg-muted" aria-label="Zurück">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (!scrollerRef.current) return;
                const off = diffDays(today, range.start) * dayWidth;
                scrollerRef.current.scrollTo({ left: Math.max(0, off - 80), behavior: 'smooth' });
              }}
              className="px-2 py-1 text-xs rounded border bg-background hover:bg-muted"
            >
              Heute
            </button>
            <button onClick={() => scrollBy(7)} className="p-1.5 rounded border bg-background hover:bg-muted" aria-label="Vor">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full pl-7 pr-7 py-1.5 text-sm rounded-md border bg-background outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {STATUS_ORDER.map((s) => {
              const active = statusFilter.has(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter((cur) => toggleSetItem(cur, s))}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition ${active ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  <StatusIcon status={s} className="h-3 w-3" /> {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {companies.map((c) => {
              const active = companyFilter.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setCompanyFilter((cur) => toggleSetItem(cur, c.id))}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition ${active ? 'ring-2 ring-offset-1 ring-foreground' : 'opacity-70 hover:opacity-100'}`}
                  title={c.name}
                >
                  <CompanyBadge company={c} />
                </button>
              );
            })}
            {filterActive && (
              <button onClick={clearFilters} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline px-2">
                zurücksetzen
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Timeline scroller */}
      <div ref={scrollerRef} className="overflow-x-auto overflow-y-visible">
        <div style={{ width: labelWidth + gridWidth }} className="relative">
          {/* Header: months + days */}
          <div className="sticky top-0 z-10 bg-background border-b">
            {/* months row */}
            <div className="flex" style={{ paddingLeft: labelWidth }}>
              {monthSegments.map((seg, i) => (
                <div
                  key={i}
                  style={{ width: seg.days * dayWidth }}
                  className="text-[11px] font-medium px-2 py-1 border-r truncate"
                >
                  {seg.label}
                </div>
              ))}
            </div>
            {/* days row */}
            <div className="flex" style={{ paddingLeft: labelWidth }}>
              {Array.from({ length: totalDays }).map((_, i) => {
                const d = addDays(range.start, i);
                const isToday = diffDays(d, today) === 0;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    style={{ width: dayWidth }}
                    className={`text-center text-[10px] leading-tight py-1 border-r ${isWeekend ? 'bg-muted/40' : ''} ${isToday ? 'bg-primary/15 font-semibold' : 'text-muted-foreground'}`}
                  >
                    <div>{WD[(d.getDay() + 6) % 7]}</div>
                    <div className="tabular-nums">{fmtDay(d)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today vertical line */}
          {todayInRange && (
            <div
              className="absolute top-0 bottom-0 w-px bg-primary/60 pointer-events-none z-[5]"
              style={{ left: labelWidth + todayOffset * dayWidth + dayWidth / 2 }}
            />
          )}

          {/* Rows */}
          <ul>
            {dated.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Keine terminierten Aufgaben.</li>
            )}
            {dated.map(({ task, start, end }) => {
              const company = task.company_id ? companyById[task.company_id] : null;
              const offset = diffDays(start, range.start);
              const span = Math.max(1, diffDays(end, start) + 1);
              const left = offset * dayWidth;
              const width = span * dayWidth - 4;
              const color = company?.color ?? 'oklch(0.7 0.05 250)';
              const done = task.status === 'done';
              return (
                <li key={task.id} className="relative flex border-b hover:bg-muted/30">
                  {/* Sticky label */}
                  <div
                    className="sticky left-0 z-[2] bg-background border-r flex items-center gap-1.5 px-2 py-1.5 shrink-0"
                    style={{ width: labelWidth }}
                  >
                    <StatusIcon status={task.status} className="h-3.5 w-3.5 shrink-0" />
                    {company && <CompanyBadge company={company} />}
                    <button
                      onClick={() => setEditTaskId(task.id)}
                      className={`flex-1 min-w-0 text-left text-xs truncate ${done ? 'line-through text-muted-foreground' : ''}`}
                      title={task.title}
                    >
                      {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
                    </button>
                  </div>
                  {/* Track */}
                  <div className="relative flex-1" style={{ height: 36 }}>
                    {/* weekend stripes */}
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const d = addDays(range.start, i);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      if (!isWeekend) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 bg-muted/30"
                          style={{ left: i * dayWidth, width: dayWidth }}
                        />
                      );
                    })}
                    {/* Bar */}
                    <button
                      onClick={() => setEditTaskId(task.id)}
                      className="absolute top-1/2 -translate-y-1/2 rounded-md border text-[11px] text-white px-2 py-1 truncate shadow-sm hover:brightness-110 transition"
                      style={{
                        left: left + 2,
                        width: Math.max(24, width),
                        backgroundColor: color,
                        borderColor: color,
                        opacity: done ? 0.5 : 1,
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                      title={`${task.title} · ${start.toLocaleDateString('de-DE')} – ${end.toLocaleDateString('de-DE')}`}
                    >
                      {task.title}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Undated open tasks */}
      {undatedOpen.length > 0 && (
        <section className="border-t mt-2">
          <h2 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
            Offen, ohne Datum ({undatedOpen.length})
          </h2>
          <ul className="divide-y">
            {undatedOpen.map((t) => {
              const company = t.company_id ? companyById[t.company_id] : null;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setEditTaskId(t.id)}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-muted/40"
                  >
                    <StatusIcon status={t.status} className="h-4 w-4 shrink-0" />
                    {company && <CompanyBadge company={company} />}
                    <span className="flex-1 truncate text-sm">{t.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="h-20" />

      <TaskDetailSheet
        task={tasks.find((t) => t.id === editTaskId) ?? null}
        open={!!editTaskId}
        onOpenChange={(o) => { if (!o) setEditTaskId(null); }}
      />
    </div>
  );
}
