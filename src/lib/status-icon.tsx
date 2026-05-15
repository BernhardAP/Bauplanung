import { Circle, CircleDashed, Clock, CheckCircle2, Ban, HelpCircle, Loader2 } from 'lucide-react';
import type { TaskStatus } from './types';
import { STATUS_LABEL } from './types';

const map = {
  open: { Icon: CircleDashed, color: 'text-status-open', label: STATUS_LABEL.open },
  in_progress: { Icon: Loader2, color: 'text-status-progress', label: STATUS_LABEL.in_progress },
  waiting: { Icon: Clock, color: 'text-status-waiting', label: STATUS_LABEL.waiting },
  question: { Icon: HelpCircle, color: 'text-status-question', label: STATUS_LABEL.question },
  blocked: { Icon: Ban, color: 'text-status-blocked', label: STATUS_LABEL.blocked },
  done: { Icon: CheckCircle2, color: 'text-status-done', label: STATUS_LABEL.done },
} as const;

export function StatusIcon({
  status,
  className = '',
  color,
  label,
}: {
  status: TaskStatus;
  className?: string;
  color?: string;
  label?: string;
}) {
  const m = (map as Record<string, { Icon: typeof Circle; color: string; label: string } | undefined>)[status];
  const Icon = m?.Icon ?? Circle;
  const useCustom = !!color;
  const fallbackColor = m?.color ?? 'text-muted-foreground';
  return (
    <Icon
      className={`${useCustom ? '' : fallbackColor} ${className}`}
      style={useCustom ? { color } : undefined}
      aria-label={label ?? m?.label ?? status}
    />
  );
}

export { Circle };
export const statusMeta = map;
