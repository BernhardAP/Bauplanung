import { Link, useRouterState } from '@tanstack/react-router';
import { ListChecks, Building2, Database, CalendarRange } from 'lucide-react';

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: '/', label: 'Aufgaben', icon: ListChecks, match: (p: string) => p === '/' },
    { to: '/timeline', label: 'Zeitplan', icon: CalendarRange, match: (p: string) => p.startsWith('/timeline') },
    { to: '/companies', label: 'Unternehmen', icon: Building2, match: (p: string) => p.startsWith('/companies') },
    { to: '/backup', label: 'Backup', icon: Database, match: (p: string) => p.startsWith('/backup') },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-xs ${
                  active ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
