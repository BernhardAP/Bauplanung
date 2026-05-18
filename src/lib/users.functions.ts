import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const ADMIN_EMAIL = 'bernhard.gruender@outlook.com';

function getAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerEmail = String(context.claims.email ?? '').toLowerCase();
    if (callerEmail !== ADMIN_EMAIL) {
      throw new Error('Nicht berechtigt.');
    }
    const email = data.email.trim().toLowerCase();
    const admin = getAdminClient();

    // 1) Allowlist eintragen (idempotent)
    const { error: insErr } = await admin
      .from('allowed_emails')
      .upsert({ email, invited_by: callerEmail }, { onConflict: 'email' });
    if (insErr) throw new Error(insErr.message);

    // 2) Einladung versenden
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email);
    if (invErr) throw new Error(invErr.message);

    return { ok: true };
  });

export const listAllowedEmails = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const callerEmail = String(context.claims.email ?? '').toLowerCase();
    if (callerEmail !== ADMIN_EMAIL) {
      throw new Error('Nicht berechtigt.');
    }
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('allowed_emails')
      .select('email, created_at, invited_by')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    // Last sign-in per user via auth admin (paginated)
    const lastSignInByEmail = new Map<string, string | null>();
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ page, perPage });
      if (usersErr) throw new Error(usersErr.message);
      for (const u of usersPage.users) {
        if (u.email) lastSignInByEmail.set(u.email.toLowerCase(), u.last_sign_in_at ?? null);
      }
      if (usersPage.users.length < perPage) break;
      page++;
      if (page > 25) break;
    }

    const emails = (data ?? []).map((row) => ({
      ...row,
      last_sign_in_at: lastSignInByEmail.get(row.email.toLowerCase()) ?? null,
    }));
    return { emails };
  });

export const removeAllowedEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerEmail = String(context.claims.email ?? '').toLowerCase();
    if (callerEmail !== ADMIN_EMAIL) {
      throw new Error('Nicht berechtigt.');
    }
    const email = data.email.trim().toLowerCase();
    if (email === ADMIN_EMAIL) {
      throw new Error('Admin-Adresse kann nicht entfernt werden.');
    }
    const admin = getAdminClient();
    const { error } = await admin.from('allowed_emails').delete().eq('email', email);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
