import { Circle } from 'lucide-react';
import type { TaskStatus } from './types';
import { getIcon } from './icon-map';
import { useStatusMeta } from './use-status-meta';

export function StatusIcon({
  status,
  className = '',
  color,
  label,
  iconName,
}: {
  status: TaskStatus;
  className?: string;
  color?: string;
  label?: string;
  iconName?: string;
}) {
  const { meta } = useStatusMeta();
  const row = meta[status];
  const resolvedIcon = iconName ?? row?.icon ?? null;
  const resolvedColor = color ?? row?.color ?? undefined;
  const resolvedLabel = label ?? row?.label ?? status;
  const Icon = getIcon(resolvedIcon);
  return (
    <Icon
      className={className}
      style={resolvedColor ? { color: resolvedColor } : undefined}
      aria-label={resolvedLabel}
    />
  );
}

export { Circle };
