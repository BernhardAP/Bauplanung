import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const ADMIN_EMAIL = 'bernhard.gruender@outlook.com';

export function useCurrentEmail(): { email: string | null; loading: boolean } {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email?.toLowerCase() ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user?.email?.toLowerCase() ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  return { email, loading };
}

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { email, loading } = useCurrentEmail();
  return { isAdmin: email === ADMIN_EMAIL, loading };
}
