import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const OUTLOOK_GW = 'https://connector-gateway.lovable.dev/microsoft_outlook';
const ONEDRIVE_GW = 'https://connector-gateway.lovable.dev/microsoft_onedrive';

const KORRESPONDENZ_PATH = 'Privat/Haus/Leiwen/Korrespondenz';
const KORR_BASE = `/me/drive/root:/${KORRESPONDENZ_PATH.split('/').map(encodeURIComponent).join('/')}`;

const OUTLOOK_FOLDER_PATH = ['Privat', 'Haus-Leiwen'] as const;

export interface OutlookMessage {
  id: string;
  subject: string;
  from: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  preview: string | null;
}


function getKeys() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
  const OUTLOOK = process.env.MICROSOFT_OUTLOOK_API_KEY;
  if (!OUTLOOK) throw new Error('MICROSOFT_OUTLOOK_API_KEY is not configured');
  const ONEDRIVE = process.env.MICROSOFT_ONEDRIVE_API_KEY;
  if (!ONEDRIVE) throw new Error('MICROSOFT_ONEDRIVE_API_KEY is not configured');
  return { LOVABLE_API_KEY, OUTLOOK, ONEDRIVE };
}

async function outlookFetch(path: string, init?: RequestInit) {
  const { LOVABLE_API_KEY, OUTLOOK } = getKeys();
  const res = await fetch(`${OUTLOOK_GW}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': OUTLOOK,
      Accept: init?.headers && (init.headers as Record<string, string>)['Accept']
        ? (init.headers as Record<string, string>)['Accept']
        : 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Outlook ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

async function onedriveFetch(path: string, init?: RequestInit) {
  const { LOVABLE_API_KEY, ONEDRIVE } = getKeys();
  const res = await fetch(`${ONEDRIVE_GW}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': ONEDRIVE,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

interface GraphMsg {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
}

function mapMsg(it: GraphMsg): OutlookMessage {
  const ea = it.from?.emailAddress;
  return {
    id: it.id,
    subject: it.subject ?? '(ohne Betreff)',
    from: ea?.name ?? ea?.address ?? null,
    fromAddress: ea?.address ?? null,
    receivedAt: it.receivedDateTime ?? null,
    preview: it.bodyPreview ?? null,
  };
}

const select = '$select=id,subject,from,receivedDateTime,bodyPreview';

let cachedFolderId: string | null = null;

async function resolveFolderId(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  let parentId: string | null = null;
  for (let i = 0; i < OUTLOOK_FOLDER_PATH.length; i++) {
    const name = OUTLOOK_FOLDER_PATH[i];
    const base = parentId
      ? `/me/mailFolders/${parentId}/childFolders`
      : `/me/mailFolders`;
    // Use $filter on displayName. Escape single quotes per OData.
    const filter = `displayName eq '${name.replace(/'/g, "''")}'`;
    const res = await outlookFetch(`${base}?$select=id&$filter=${encodeURIComponent(filter)}&$top=1`);
    const json = await res.json();
    const id = json?.value?.[0]?.id;
    if (!id) {
      throw new Error(`Outlook-Ordner "${OUTLOOK_FOLDER_PATH.slice(0, i + 1).join('/')}" nicht gefunden`);
    }
    parentId = id;
  }
  cachedFolderId = parentId!;
  return cachedFolderId;
}

export const listOutlookMessages = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({
      query: z.string().max(200).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const q = data.query?.trim();
    const folderId = await resolveFolderId();
    const params = q
      ? `?${select}&$top=50&$search="${encodeURIComponent(q)}"`
      : `?${select}&$top=50&$orderby=receivedDateTime desc`;
    const res = await outlookFetch(`/me/mailFolders/${folderId}/messages${params}`);
    const json = await res.json();
    const items: OutlookMessage[] = (json.value ?? []).map((m: GraphMsg) => mapMsg(m));
    return { items };
  });


function safeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'email';
}

async function ensureKorrespondenzFolder() {
  // Try to read; if 404, create.
  const head = await onedriveFetch(`${KORR_BASE}?$select=id`);
  if (head.ok) return;
  if (head.status !== 404) {
    const t = await head.text();
    throw new Error(`OneDrive ${head.status}: ${t.slice(0, 200)}`);
  }
  const parent = '/me/drive/root:/Privat/Haus/Leiwen:/children';
  const res = await onedriveFetch(parent, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Korrespondenz',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OneDrive Ordner anlegen fehlgeschlagen ${res.status}: ${t.slice(0, 200)}`);
  }
}

export const saveOutlookEmailToOnedrive = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({ messageId: z.string().min(1), subject: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    // 1) Hole MIME
    const mimeRes = await outlookFetch(`/me/messages/${encodeURIComponent(data.messageId)}/$value`, {
      headers: { Accept: 'message/rfc822' },
    });
    const mime = await mimeRes.arrayBuffer();

    // 2) Stelle sicher, dass Korrespondenz-Ordner existiert
    await ensureKorrespondenzFolder();

    // 3) Upload als .eml
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${date}_${safeFilename(data.subject ?? 'email')}.eml`;
    const uploadPath = `${KORR_BASE}/${encodeURIComponent(filename)}:/content`;
    const up = await onedriveFetch(uploadPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'message/rfc822' },
      body: mime,
    });
    if (!up.ok) {
      const t = await up.text();
      throw new Error(`OneDrive Upload ${up.status}: ${t.slice(0, 200)}`);
    }
    const item = await up.json();
    return {
      id: item.id as string,
      name: item.name as string,
      webUrl: item.webUrl as string,
      mimeType: 'message/rfc822' as const,
    };
  });
