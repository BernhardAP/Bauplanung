import { useRef, useState } from 'react';
import { ChevronRight, Calendar, FileText, Pencil, Paperclip, Plus, CornerDownRight, GripVertical } from 'lucide-react';
import { StatusIcon } from '@/lib/status-icon';
import { CompanyBadge } from '@/components/company-badge';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_ORDER } from '@/lib/types';
import { useStatusMeta } from '@/lib/use-status-meta';

export type DropPosition = 'before' | 'after' | 'child';

interface Props {
  task: Task;
  company: Company | null;
  hasChildren?: boolean;
  childrenCollapsed?: boolean;
  attachmentCount?: number;
  onToggleChildren?: () => void;
  onEdit: () => void;
  onCycleStatus: () => void;
  onDragStartTask?: (id: string) => void;
  onDragEndTask?: () => void;
  onDropOnTask?: (draggedId: string, targetId: string, position: DropPosition) => void;
  draggingId?: string | null;
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
  task, company, hasChildren = false, childrenCollapsed = false, attachmentCount = 0,
  onToggleChildren, onEdit, onCycleStatus,
  onDragStartTask, onDragEndTask, onDropOnTask, draggingId,
}: Props) {
  const { meta: statusMeta } = useStatusMeta();
  const sm = statusMeta[task.status] ?? { status: task.status, label: task.status, sort_order: 999, color: null, icon: null };
  const dateText = fmtRange(task.start_date, task.end_date);
  const accentColor = company?.color ?? null;
  const [dropPos, setDropPos] = useState<DropPosition | null>(null);
  const isDraggingThis = draggingId === task.id;
  const dragActive = !!draggingId;

  function computePos(e: React.DragEvent<HTMLDivElement>): DropPosition {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.28) return 'before';
    if (y > h * 0.72) return 'after';
    return 'child';
  }

  return (
    <div
      className="relative"
      data-task-id={task.id}
      draggable={!!onDragStartTask}
      onDragStart={(e) => {
        if (!onDragStartTask) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStartTask(task.id);
      }}
      onDragEnd={() => { setDropPos(null); onDragEndTask?.(); }}
      onDragOver={(e) => {
        if (!onDropOnTask || !dragActive || isDraggingThis) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const pos = computePos(e);
        setDropPos((p) => (p === pos ? p : pos));
      }}
      onDragLeave={(e) => {
        // only clear if leaving the row entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPos(null);
      }}
      onDrop={(e) => {
        if (!onDropOnTask || isDraggingThis) return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const pos = dropPos ?? computePos(e);
        setDropPos(null);
        if (draggedId && draggedId !== task.id) onDropOnTask(draggedId, task.id, pos);
      }}
      style={{ opacity: isDraggingThis ? 0.4 : 1 }}
    >
      {dropPos === 'before' && <div className="absolute left-0 right-0 -top-px h-0.5 bg-primary z-10 pointer-events-none" />}
      {dropPos === 'after' && <div className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary z-10 pointer-events-none" />}
      <div className={`border-b bg-card ${dropPos === 'child' ? 'ring-2 ring-inset ring-primary/60' : ''}`}>
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
            <span className="shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing touch-none" aria-label="Ziehen" title="Ziehen zum Verschieben">
              <GripVertical className="h-4 w-4" />
            </span>
            <button onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0" aria-label="Status">
              <StatusIcon status={task.status} className="h-5 w-5" />
            </button>
            {task.depth > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
            <button onClick={onEdit} className="flex-1 text-left flex items-center gap-2 min-w-0">
              <span className={`flex-1 truncate text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
              </span>
              {company && <CompanyBadge company={company} />}
              {attachmentCount > 0 && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Paperclip className="h-3 w-3" />{attachmentCount}
                </span>
              )}
              {dateText && <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{fmtDate(task.end_date ?? task.start_date)}</span>}
            </button>
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleChildren?.(); }}
                className="p-1.5 -m-1 shrink-0 text-muted-foreground"
                aria-label={childrenCollapsed ? 'Unteraufgaben einblenden' : 'Unteraufgaben ausblenden'}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${childrenCollapsed ? '' : 'rotate-90'}`} />
              </button>
            )}
          </div>

          {/* Desktop grid */}
          <div
            className="hidden md:grid items-start gap-3 py-3 pr-4 text-sm"
            style={{
              paddingLeft: 16 + task.depth * 20,
              gridTemplateColumns: 'auto auto minmax(0, 1fr) 180px 160px 90px auto',
            }}
          >
            <span className="shrink-0 mt-1 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing" title="Ziehen zum Verschieben" aria-label="Ziehen">
              <GripVertical className="h-4 w-4" />
            </span>
            <button onClick={(e) => { e.stopPropagation(); onCycleStatus(); }} className="p-1 -m-1 shrink-0 mt-0.5" title={sm.label}>
              <StatusIcon status={task.status} className="h-5 w-5" color={sm.color ?? undefined} label={sm.label} />
            </button>
            <div className="min-w-0 flex items-start gap-1.5">
              {task.depth > 0 && (
                <CornerDownRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleChildren?.(); }}
                  className="p-0.5 -m-0.5 mt-0 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={childrenCollapsed ? 'Unteraufgaben einblenden' : 'Unteraufgaben ausblenden'}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${childrenCollapsed ? '' : 'rotate-90'}`} />
                </button>
              )}
              <button onClick={onEdit} className="text-left min-w-0 flex-1">
                <div className={`font-medium truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
                </div>
                {task.notes && (
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1 flex gap-1">
                    <FileText className="h-3 w-3 shrink-0 mt-0.5" /><span>{task.notes}</span>
                  </div>
                )}
              </button>
            </div>
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
        </div>
      </div>
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
