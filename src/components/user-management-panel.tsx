import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Loader2, Mail, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { inviteUser, listAllowedEmails, removeAllowedEmail, setUserPassword } from '@/lib/users.functions';
import { ADMIN_EMAIL } from '@/lib/use-current-user';

export function UserManagementPanel() {
  const invite = useServerFn(inviteUser);
  const list = useServerFn(listAllowedEmails);
  const remove = useServerFn(removeAllowedEmail);
  const setPw = useServerFn(setUserPassword);
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
          {data?.emails.map((row) => {
            const subject = 'Einladung zur Bauplanung Leiwen';
            const body = `Hallo,

ich lade Dich zur gemeinsamen Bauplanung Leiwen ein. Über die App können wir Aufgaben, Termine, Kosten und Unternehmen rund um das Bauprojekt zentral verwalten.

So kommst Du rein:
1. Öffne die App unter folgendem Link:
https://idea-nest-mate.lovable.app
2. Melde Dich mit dieser E-Mail-Adresse an: ${row.email}
3. Beim ersten Login vergibst Du Dein eigenes Passwort.

Falls Du Fragen hast, melde Dich einfach bei mir.

Viele Grüße
Bernhard`;
            const mailto = `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            const last = (row as { last_sign_in_at?: string | null }).last_sign_in_at;
            const lastLabel = last
              ? `Letzter Login: ${new Date(last).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
              : 'Noch nie angemeldet';
            return (
              <li key={row.email} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{row.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{lastLabel}</div>
                </div>
                {row.email !== ADMIN_EMAIL && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      aria-label="Einladungs-E-Mail im E-Mail-Programm öffnen"
                      title="Einladungs-E-Mail im E-Mail-Programm öffnen"
                    >
                      <a href={mailto}>
                        <Send className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(row.email)}
                      aria-label="Entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
