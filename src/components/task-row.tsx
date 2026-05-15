import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, ChevronLeft, Calendar, FileText } from 'lucide-react';
import { StatusIcon } from '@/lib/status-icon';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_ORDER, STATUS_LABEL } from '@/lib/types';

interface Props {
  task: Task;
  company: Company | null;
  onTap: () => void;
  onCycleStatus: () => void;
  onIndent: () => void;
  onOutdent: () => void;
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

export function TaskRow({ task, company, onTap, onCycleStatus, onIndent, onOutdent }: Props) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, -40, 0, 40, 120],
    ['oklch(0.85 0.05 250 / 0.4)', 'transparent', 'transparent', 'transparent', 'oklch(0.82 0.16 85 / 0.4)']);
  const leftHintOpacity = useTransform(x, [-120, -20, 0], [1, 0, 0]);
  const rightHintOpacity = useTransform(x, [0, 20, 120], [0, 0, 1]);

  const dateText = fmtRange(task.start_date, task.end_date);

  return (
    <div className="relative">
      {/* swipe hint icons — only visible while swiping */}
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none text-muted-foreground">
        <motion.span style={{ opacity: leftHintOpacity }}>
          <ChevronLeft className="h-5 w-5" />
        </motion.span>
        <motion.span style={{ opacity: rightHintOpacity }}>
          <ChevronRight className="h-5 w-5" />
        </motion.span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x, backgroundColor: bg }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) onIndent();
          else if (info.offset.x < -80) onOutdent();
        }}
        className="border-b bg-card"
      >
        {/* Mobile: compact single row */}
        <div className="flex md:hidden items-center gap-2 py-2.5 pr-3" style={{ paddingLeft: 12 + task.depth * 16 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
            className="p-1 -m-1 shrink-0"
            aria-label="Status ändern"
          >
            <StatusIcon status={task.status} className="h-5 w-5" />
          </button>
          <button onClick={onTap} className="flex-1 text-left flex items-center gap-2 min-w-0">
            <span className={`flex-1 truncate text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
            </span>
            {company && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                {company.kuerzel}
              </span>
            )}
            {dateText && (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {fmtDate(task.end_date ?? task.start_date)}
              </span>
            )}
          </button>
        </div>

        {/* Desktop: expanded grid with more details */}
        <div
          className="hidden md:grid items-start gap-3 py-3 pr-4 text-sm"
          style={{
            paddingLeft: 16 + task.depth * 20,
            gridTemplateColumns: 'auto minmax(0, 1fr) 160px 160px 80px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
            className="p-1 -m-1 shrink-0 mt-0.5"
            aria-label="Status ändern"
            title={STATUS_LABEL[task.status]}
          >
            <StatusIcon status={task.status} className="h-5 w-5" />
          </button>

          <button onClick={onTap} className="text-left min-w-0">
            <div className={`font-medium truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
            </div>
            {task.notes && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2 flex gap-1">
                <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{task.notes}</span>
              </div>
            )}
          </button>

          <button onClick={onTap} className="text-left text-xs text-muted-foreground truncate">
            {company ? (
              <>
                <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground uppercase tracking-wide mr-1">
                  {company.kuerzel}
                </span>
                <span className="truncate">{company.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </button>

          <button onClick={onTap} className="text-left text-xs text-muted-foreground tabular-nums truncate">
            {dateText ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {dateText}
              </span>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </button>

          <button onClick={onTap} className="text-left text-xs text-muted-foreground">
            {STATUS_LABEL[task.status]}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function NewTaskRow({ depth = 0, onCreate }: { depth?: number; onCreate: (title: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="border-b bg-background">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) { onCreate(val.trim()); setVal(''); }
        }}
        placeholder="+ Neue Aufgabe…"
        className="w-full bg-transparent py-2.5 md:py-3 pr-3 text-sm outline-none placeholder:text-muted-foreground"
        style={{ paddingLeft: 12 + depth * 16 + 28 }}
      />
    </div>
  );
}

export function nextStatus(s: TaskStatus): TaskStatus {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}
