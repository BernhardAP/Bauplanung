import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';



export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const mail = email.trim().toLowerCase();
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Auto-Confirm ist aktiv: ggf. direkt einloggen
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (e2) {
          setInfo('Konto angelegt. Bitte jetzt anmelden.');
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null); setInfo(null);
    const mail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setInfo('Falls ein Konto existiert, wurde eine E-Mail verschickt.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <h1 className="text-lg font-semibold">Anmeldung</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Bitte mit Zugangsdaten anmelden.
        </p>

        <div className="flex gap-1 text-sm">
          <Button type="button" variant={mode === 'signin' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('signin')}>
            Anmelden
          </Button>
          <Button type="button" variant={mode === 'signup' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('signup')}>
            Konto anlegen
          </Button>
        </div>

        <div>
          <Label htmlFor="email" className="text-xs">E-Mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password" className="text-xs">Passwort</Label>
          <Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {info && <p className="text-xs text-muted-foreground">{info}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {mode === 'signup' ? 'Konto anlegen' : 'Anmelden'}
        </Button>

        {mode === 'signin' && (
          <button type="button" onClick={forgot} className="text-xs text-muted-foreground underline">
            Passwort vergessen?
          </button>
        )}
      </form>
    </div>
  );
}
