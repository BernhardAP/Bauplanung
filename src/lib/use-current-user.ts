import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useCurrentEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email?.toLowerCase() ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user?.email?.toLowerCase() ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return email;
}

export const ADMIN_EMAIL = 'bernhard.gruender@outlook.com';

export function useIsAdmin(): boolean {
  const email = useCurrentEmail();
  return email === ADMIN_EMAIL;
}
