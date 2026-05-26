import { useState, type ReactNode } from 'react';
import { HelpCircle, Lightbulb } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

export function HelpButton({ title, children, size = 'md' }: Props) {
  const [open, setOpen] = useState(false);
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted h-6 w-6 shrink-0"
        aria-label="Hilfe"
        title="Was kann man hier machen?"
      >
        <HelpCircle className={iconCls} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
          <DialogHeader className="space-y-0 text-left p-5 pb-3 border-b bg-muted/40">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
              >
                <Lightbulb className="h-4 w-4" />
              </span>
              <DialogTitle className="text-base font-semibold leading-tight">{title}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="help-body p-5 pt-4 text-sm leading-relaxed text-foreground/90 space-y-2.5">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
