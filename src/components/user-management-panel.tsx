import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { inviteUser, listAllowedEmails, removeAllowedEmail } from '@/lib/users.functions';
import { ADMIN_EMAIL } from '@/lib/use-current-user';

export function UserManagementPanel() {
  const invite = useServerFn(inviteUser);
  const list = useServerFn(listAllowedEmails);
  const remove = useServerFn(removeAllowedEmail);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['allowed-emails'],
    queryFn: () => list(),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: { email: email.trim().toLowerCase() } });
      toast.success('Einladung verschickt');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['allowed-emails'] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(addr: string) {
    if (!confirm(`${addr} entfernen?`)) return;
    try {
      await remove({ data: { email: addr } });
      toast.success('Entfernt');
      qc.invalidateQueries({ queryKey: ['allowed-emails'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
        <Label htmlFor="invite-email" className="text-xs">Neuen Nutzer einladen</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            placeholder="name@domain.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Einladen
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Die Adresse wird freigeschaltet und erhält eine Einladungs-E-Mail.
        </p>
      </form>

      <div className="space-y-1">
        <h3 className="text-sm font-medium">Freigeschaltete Adressen</h3>
        {isLoading && <p className="text-xs text-muted-foreground">Lade…</p>}
        <ul className="divide-y rounded-lg border">
          {data?.emails.map((row) => (
            <li key={row.email} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{row.email}</span>
              {row.email !== ADMIN_EMAIL && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(row.email)}
                  aria-label="Entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
