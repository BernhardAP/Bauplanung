import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/microsoft_onedrive';

export interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  isFolder: boolean;
  mimeType: string | null;
  lastModified: string | null;
  parentPath: string | null;
}

async function gatewayFetch(path: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
  const ONEDRIVE_KEY = process.env.MICROSOFT_ONEDRIVE_API_KEY;
  if (!ONEDRIVE_KEY) throw new Error('MICROSOFT_ONEDRIVE_API_KEY is not configured');

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': ONEDRIVE_KEY,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OneDrive API ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

interface GraphItem {
  id: string;
  name: string;
  webUrl: string;
  file?: { mimeType?: string };
  folder?: unknown;
  lastModifiedDateTime?: string;
  parentReference?: { path?: string };
}

function mapItem(it: GraphItem): OneDriveItem {
  return {
    id: it.id,
    name: it.name,
    webUrl: it.webUrl,
    isFolder: !!it.folder,
    mimeType: it.file?.mimeType ?? null,
    lastModified: it.lastModifiedDateTime ?? null,
    parentPath: it.parentReference?.path?.replace(/^\/drive\/root:/, '') ?? null,
  };
}

const select = '$select=id,name,webUrl,file,folder,lastModifiedDateTime,parentReference';

// Beschränkt OneDrive-Zugriff auf diesen Ordner
const SCOPE_FOLDER = 'Privat/Haus/Leiwen';
const SCOPE_BASE = `/me/drive/root:/${SCOPE_FOLDER.split('/').map(encodeURIComponent).join('/')}`;

export const searchOnedrive = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const q = data.query?.trim();
    const path = q
      ? `${SCOPE_BASE}:/search(q='${encodeURIComponent(q)}')?${select}&$top=50`
      : `${SCOPE_BASE}:/children?${select}&$top=100&$orderby=name`;
    const json = await gatewayFetch(path);
    const items: OneDriveItem[] = (json.value ?? []).map(mapItem);
    return { items };
  });

const SCOPE_PATH_PREFIX = `/drive/root:/${SCOPE_FOLDER}`;

function isInScope(parentPath: string | undefined, name: string | undefined): boolean {
  if (!parentPath) return false;
  // parentPath sieht aus wie "/drive/root:/Privat/Haus/Leiwen" oder "/drive/root:/Privat/Haus/Leiwen/Unterordner"
  if (parentPath === SCOPE_PATH_PREFIX) return true;
  if (parentPath.startsWith(`${SCOPE_PATH_PREFIX}/`)) return true;
  // Sonderfall: Item IST der Scope-Ordner selbst -> parent ist "/drive/root:/Privat/Haus" mit name "Leiwen"
  if (parentPath === '/drive/root:/Privat/Haus' && name === 'Leiwen') return true;
  return false;
}

export const browseOnedrive = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z.object({ folderId: z.string().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    if (data.folderId) {
      // Vor dem Listen: Item holen und Scope prüfen
      const item: GraphItem = await gatewayFetch(
        `/me/drive/items/${encodeURIComponent(data.folderId)}?${select}`,
      );
      if (!isInScope(item.parentReference?.path, item.name)) {
        throw new Error('Zugriff außerhalb von Privat/Haus/Leiwen nicht erlaubt');
      }
      const json = await gatewayFetch(
        `/me/drive/items/${encodeURIComponent(data.folderId)}/children?${select}&$top=100&$orderby=name`,
      );
      const items: OneDriveItem[] = (json.value ?? []).map(mapItem);
      return { items };
    }
    const json = await gatewayFetch(`${SCOPE_BASE}:/children?${select}&$top=100&$orderby=name`);
    const items: OneDriveItem[] = (json.value ?? []).map(mapItem);
    return { items };
  });

