import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPw1(''); setPw2(''); setError(null); setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) return setError('Passwort muss mindestens 8 Zeichen lang sein.');
    if (pw1 !== pw2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success('Passwort geändert');
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Passwort ändern">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Passwort ändern</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="new-pw" className="text-xs">Neues Passwort</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" required minLength={8}
              value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-pw2" className="text-xs">Passwort bestätigen</Label>
            <Input id="new-pw2" type="password" autoComplete="new-password" required minLength={8}
              value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
