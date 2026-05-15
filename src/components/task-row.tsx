import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { StatusIcon } from '@/lib/status-icon';
import type { Task, TaskStatus, Company } from '@/lib/types';
import { STATUS_ORDER } from '@/lib/types';

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
  const [, m, d] = s.split('-');
  return `${d}.${m}.`;
}

export function TaskRow({ task, company, onTap, onCycleStatus, onIndent, onOutdent }: Props) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-120, -40, 0, 40, 120],
    ['oklch(0.85 0.05 250 / 0.4)', 'transparent', 'transparent', 'transparent', 'oklch(0.82 0.16 85 / 0.4)']);

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-between px-4 text-xs text-muted-foreground pointer-events-none">
        <span className="inline-flex items-center gap-1"><ChevronLeft className="h-3 w-3" /> tiefer</span>
        <span className="inline-flex items-center gap-1">höher <ChevronRight className="h-3 w-3" /></span>
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
        <div className="flex items-center gap-2 py-2.5 pr-3" style={{ paddingLeft: 12 + task.depth * 16 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
            className="p-1 -m-1 shrink-0"
            aria-label="Status ändern"
          >
            <StatusIcon status={task.status} className="h-5 w-5" />
          </button>
          <button
            onClick={onTap}
            className="flex-1 text-left flex items-center gap-2 min-w-0"
          >
            <span className={`flex-1 truncate text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title || <span className="italic text-muted-foreground">(ohne Titel)</span>}
            </span>
            {company && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                {company.kuerzel}
              </span>
            )}
            {(task.start_date || task.end_date) && (
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {fmtDate(task.end_date ?? task.start_date)}
              </span>
            )}
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
        className="w-full bg-transparent py-2.5 pr-3 text-sm outline-none placeholder:text-muted-foreground"
        style={{ paddingLeft: 12 + depth * 16 + 28 }}
      />
    </div>
  );
}

export function nextStatus(s: TaskStatus): TaskStatus {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}
