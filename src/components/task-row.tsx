import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Calendar, FileText, Pencil, ChevronDown, Paperclip, ExternalLink, Plus, CornerDownRight, IndentIncrease, IndentDecrease, Move, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StatusIcon } from '@/lib/status-icon';
import { CompanyBadge } from '@/components/company-badge';
import { fetchAttachments } from '@/lib/queries';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_ORDER } from '@/lib/types';
import { useStatusMeta } from '@/lib/use-status-meta';

interface Props {
  task: Task;
  company: Company | null;
  expanded: boolean;
  hasChildren?: boolean;
  childrenCollapsed?: boolean;
  attachmentCount?: number;
  isDropTarget?: boolean;
  dragLocked?: boolean;
  onToggleExpand: () => void;
  onToggleChildren?: () => void;
  onEdit: () => void;
  onCycleStatus: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onAddSubtask: () => void;
  onStartMove?: (clientX: number, clientY: number) => void;
}

function fmtDate(s: string | null) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
function fmtRange(start: string | null, end: string | null) {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(end ?? start);
}

export function TaskRow({
  task, company, expanded, hasChildren = false, childrenCollapsed = false, attachmentCount = 0,
  isDropTarget = false, dragLocked = false,
  onToggleExpand, onToggleChildren, onEdit, onCycleStatus, onIndent, onOutdent, onAddSubtask,
  onStartMove,
}: Props) {
  const { meta: statusMeta } = useStatusMeta();
  const sm = statusMeta[task.status] ?? { status: task.status, label: task.status, sort_order: 999, color: null, icon: null };
  const dateText = fmtRange(task.start_date, task.end_date);
  const accentColor = company?.color ?? null;
  const onRowClick = hasChildren ? (onToggleChildren ?? onToggleExpand) : onToggleExpand;

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', task.id],
    queryFn: () => fetchAttachments(task.id),
    enabled: expanded && attachmentCount > 0,
    staleTime: 30_000,
  });

  // ----- Long-press → action menu ("rumhängen") -----
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressFired = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (dragLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Don't trigger long-press from small controls, but allow it on the row title button.
    const tgt = e.target as HTMLElement;
    if (tgt.closest('[data-long-press-ignore], a, input, textarea, select')) return;
    pressFired.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setMenuOpen(true);
    }, 400);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current || pressFired.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 10) clearPress();
  };
  const swallowClickIfFired = (e: React.MouseEvent) => {
    if (pressFired.current) {
      e.preventDefault();
      e.stopPropagation();
      pressFired.current = false;
    }
  };

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div
      ref={rootRef}
      className="relative select-none"
      data-task-id={task.id}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onClickCapture={swallowClickIfFired}
    >
      <div
        className={`border-b bg-card transition-shadow ${isDropTarget ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''} ${menuOpen ? 'bg-accent/40' : ''}`}
      >
        <div className="relative">
          {accentColor && (
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />
          )}

          {/* Mobile compact row */}
          <div className="flex md:hidden items-center gap-2 py-2.5 pr-2" style={{ paddingLeft: 12 + task.depth * 16 }}>
            <button data-long-press-ignore onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0" aria-label="Status">
              <StatusIcon status={task.status} className="h-5 w-5" />
            </button>
            {task.depth > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
            <button onClick={onRowClick} className="flex-1 text-left flex items-center gap-2 min-w-0">
              <span className={`flex-1 truncate text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
              </span>
              {company && <CompanyBadge company={company} />}
              {dateText && <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{fmtDate(task.end_date ?? task.start_date)}</span>}
              {hasChildren && (
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${childrenCollapsed ? '' : 'rotate-90'}`} />
              )}
            </button>
            <button
              data-long-press-ignore
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="p-1.5 -m-1 shrink-0 text-muted-foreground"
              aria-label="Details"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Desktop expanded grid */}
          <div
            className="hidden md:grid items-start gap-3 py-3 pr-4 text-sm"
            style={{
              paddingLeft: 16 + task.depth * 20,
              gridTemplateColumns: 'auto minmax(0, 1fr) 180px 160px 90px auto',
            }}
          >
            <button data-long-press-ignore onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0 mt-0.5" title={sm.label}>
              <StatusIcon status={task.status} className="h-5 w-5" color={sm.color ?? undefined} label={sm.label} />
            </button>
            <button onClick={onRowClick} className="text-left min-w-0 flex items-start gap-1.5">
              {task.depth > 0 && (
                <CornerDownRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              {hasChildren && (
                <ChevronRight className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${childrenCollapsed ? '' : 'rotate-90'}`} />
              )}
              <div className="min-w-0 flex-1">
                <div className={`font-medium truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
                </div>
                {task.notes && !expanded && (
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1 flex gap-1">
                    <FileText className="h-3 w-3 shrink-0 mt-0.5" /><span>{task.notes}</span>
                  </div>
                )}
              </div>
            </button>
            <div className="text-xs text-muted-foreground truncate">
              {company ? <CompanyBadge company={company} showName /> : <span className="text-muted-foreground/60">—</span>}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums truncate">
              {dateText ? <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {dateText}</span> : <span className="text-muted-foreground/60">—</span>}
            </div>
            <div className="text-xs text-muted-foreground">{sm.label}</div>
            <button data-long-press-ignore onClick={onEdit} className="p-1 -m-1 text-muted-foreground hover:text-foreground" aria-label="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          {/* Action menu ("rumhängen") — appears after long press */}
          {menuOpen && (
            <div className="border-t bg-accent/30 px-2 py-1.5 flex flex-wrap items-center gap-1.5">
              <ActionChip icon={<IndentDecrease className="h-3.5 w-3.5" />} label="Ausrücken" onClick={() => { onOutdent(); closeMenu(); }} />
              <ActionChip icon={<IndentIncrease className="h-3.5 w-3.5" />} label="Einrücken" onClick={() => { onIndent(); closeMenu(); }} />
              <ActionChip
                icon={<Move className="h-3.5 w-3.5" />}
                label="Verschieben"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  closeMenu();
                  onStartMove?.(e.clientX, e.clientY);
                }}
              />
              <ActionChip icon={<Plus className="h-3.5 w-3.5" />} label="Unteraufgabe" onClick={() => { onAddSubtask(); closeMenu(); }} />
              <ActionChip icon={<Pencil className="h-3.5 w-3.5" />} label="Bearbeiten" onClick={() => { onEdit(); closeMenu(); }} />
              <button
                data-long-press-ignore
                onClick={closeMenu}
                className="ml-auto p-1 text-muted-foreground hover:text-foreground"
                aria-label="Menü schließen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Inline expansion */}
          {expanded && (
            <div
              className="bg-muted/40 border-t pb-3 pt-2 pr-3 text-sm space-y-1.5"
              style={{ paddingLeft: 16 + task.depth * 16 + 28 }}
            >
              {company && (
                <div className="text-xs">
                  <CompanyBadge company={company} showName />
                  {company.kontaktperson && <span className="text-muted-foreground"> · {company.kontaktperson}</span>}
                </div>
              )}
              {dateText && (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {dateText}
                </div>
              )}
              <div className="text-xs text-muted-foreground">Status: {sm.label}</div>
              {task.notes && (
                <div className="text-xs whitespace-pre-wrap text-foreground/80 flex gap-1">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{task.notes}</span>
                </div>
              )}
              {attachmentCount > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> {attachmentCount} Dokument{attachmentCount === 1 ? '' : 'e'}
                  </div>
                  <ul className="space-y-0.5">
                    {attachments.map((a) => {
                      const href = a.kind === 'link'
                        ? a.url ?? '#'
                        : (a.storage_path ? supabase.storage.from('attachments').getPublicUrl(a.storage_path).data.publicUrl : '#');
                      const icon = a.kind === 'link' ? '🔗' : a.kind === 'email' ? '✉️' : '📎';
                      return (
                        <li key={a.id}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs inline-flex items-center gap-1 max-w-full hover:underline underline-offset-2"
                          >
                            <span aria-hidden>{icon}</span>
                            <span className="truncate">{a.filename}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <button
                  data-long-press-ignore
                  onClick={onEdit}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </button>
                <button
                  data-long-press-ignore
                  onClick={(e) => { e.stopPropagation(); onAddSubtask(); }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Unteraufgabe
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionChip({
  icon, label, onClick, onPointerDown,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      data-long-press-ignore
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      onPointerDown={onPointerDown}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent active:scale-95 transition"
    >
      {icon} {label}
    </button>
  );
}

export function NewTaskRow({ depth = 0, onCreate }: { depth?: number; onCreate: (title: string) => void }) {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    const t = val.trim();
    if (!t) {
      inputRef.current?.focus();
      return;
    }
    onCreate(t);
    setVal('');
    inputRef.current?.focus();
  };
  return (
    <div className="border-b bg-background flex items-center gap-2 pr-2">
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" style={{ marginLeft: 12 + depth * 16 }} />
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Neue Aufgabe…"
        className="flex-1 bg-transparent py-2.5 md:py-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
        className="shrink-0 text-xs px-2 py-1 rounded border bg-background hover:bg-accent"
      >
        Hinzufügen
      </button>
    </div>
  );
}

export function nextStatus(s: TaskStatus, order?: TaskStatus[]): TaskStatus {
  const list: TaskStatus[] = order && order.length > 0 ? order : (STATUS_ORDER as TaskStatus[]);
  const i = list.indexOf(s);
  return list[(i + 1) % list.length];
}
