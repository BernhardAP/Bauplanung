import { useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2 pt-1">{children}</div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
