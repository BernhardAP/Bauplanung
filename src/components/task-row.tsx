import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, ChevronLeft, Calendar, FileText, Pencil, ChevronDown, Paperclip, ExternalLink, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StatusIcon } from '@/lib/status-icon';
import { CompanyBadge } from '@/components/company-badge';
import { fetchAttachments } from '@/lib/queries';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_ORDER, STATUS_LABEL } from '@/lib/types';
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
  onLongPressStart?: (clientX: number, clientY: number) => void;
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
  onLongPressStart,
}: Props) {
  const { meta: statusMeta } = useStatusMeta();
  const sm = statusMeta[task.status] ?? { status: task.status, label: task.status, sort_order: 999, color: null, icon: null };
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, -40, 0, 40, 120],
    ['oklch(0.85 0.05 250 / 0.4)', 'transparent', 'transparent', 'transparent', 'oklch(0.82 0.16 85 / 0.4)']);
  const leftHintOpacity = useTransform(x, [-120, -20, 0], [1, 0, 0]);
  const rightHintOpacity = useTransform(x, [0, 20, 120], [0, 0, 1]);
  const dateText = fmtRange(task.start_date, task.end_date);
  const accentColor = company?.color ?? null;
  // For parents: clicking the row toggles children visibility.
  // For leaves: clicking toggles inline detail view.
  const onRowClick = hasChildren ? (onToggleChildren ?? onToggleExpand) : onToggleExpand;

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', task.id],
    queryFn: () => fetchAttachments(task.id),
    enabled: expanded && attachmentCount > 0,
    staleTime: 30_000,
  });

  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressFired = useRef(false);

  const clearPress = (reason?: string) => {
    if (pressTimer.current !== null) {
      console.log('[longpress] cancel', task.id.slice(0, 6), reason);
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressFired.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    console.log('[longpress] down', task.id.slice(0, 6), e.pointerType);
    pressTimer.current = window.setTimeout(() => {
      pressFired.current = true;
      console.log('[longpress] FIRE', task.id.slice(0, 6));
      if (navigator.vibrate) navigator.vibrate(30);
      onLongPressStart?.(pressStart.current?.x ?? 0, pressStart.current?.y ?? 0);
    }, 350);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pressStart.current || pressFired.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > 12) clearPress(`move ${Math.round(Math.hypot(dx, dy))}`);
  };

  return (
    <div
      className="relative select-none"
      data-task-id={task.id}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none text-muted-foreground">
        <motion.span style={{ opacity: leftHintOpacity }}><ChevronLeft className="h-5 w-5" /></motion.span>
        <motion.span style={{ opacity: rightHintOpacity }}><ChevronRight className="h-5 w-5" /></motion.span>
      </div>

      <motion.div
        drag={dragLocked ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x, backgroundColor: bg }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => clearPress('up')}
        onPointerCancel={() => clearPress('cancel')}
        onDragStart={() => clearPress('framer-drag')}
        onDragEnd={(_, info) => {
          clearPress('drag-end');
          if (info.offset.x > 80) onIndent();
          else if (info.offset.x < -80) onOutdent();
        }}
        className={`border-b bg-card transition-shadow ${isDropTarget ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}`}
      >
        {/* color accent stripe (depth-aware padding handled inside) */}
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
            <button onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0" aria-label="Status">
              <StatusIcon status={task.status} className="h-5 w-5" />
            </button>
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
            <button onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0 mt-0.5" title={sm.label}>
              <StatusIcon status={task.status} className="h-5 w-5" color={sm.color ?? undefined} label={sm.label} />
            </button>
            <button onClick={onRowClick} className="text-left min-w-0 flex items-start gap-1.5">
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
            <button onClick={onEdit} className="p-1 -m-1 text-muted-foreground hover:text-foreground" aria-label="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          {/* Inline expansion (mobile + desktop) */}
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
                  onClick={onEdit}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddSubtask(); }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Unteraufgabe
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
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
