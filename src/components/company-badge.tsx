import type { Company } from '@/lib/types';

function pickTextColor(hex: string | null): string {
  if (!hex) return '#fff';
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // YIQ luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#1a1a1a' : '#ffffff';
}

interface Props {
  company: Pick<Company, 'kuerzel' | 'color' | 'name'>;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

export function CompanyBadge({ company, size = 'sm', showName = false, className = '' }: Props) {
  const bg = company.color ?? '#64748b';
  const fg = pickTextColor(company.color);
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`rounded font-semibold uppercase tracking-wide tabular-nums ${px}`}
        style={{ backgroundColor: bg, color: fg }}
      >
        {company.kuerzel}
      </span>
      {showName && <span className="truncate text-xs text-foreground">{company.name}</span>}
    </span>
  );
}

export function CompanyDot({ color, className = '' }: { color: string | null; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${className}`}
      style={{ backgroundColor: color ?? '#64748b' }}
    />
  );
}
