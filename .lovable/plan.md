## Ziel
Alle Outlook-Abfragen sollen ausschließlich gegen den Mail-Ordner **`Privat/Haus-Leiwen`** laufen (Top-Level-Ordner `Privat` → Unterordner `Haus-Leiwen`), statt gegen `inbox`/`sentitems`.

## Änderungen

### 1. `src/lib/outlook.functions.ts`
- Neue Konstante:
  ```ts
  const OUTLOOK_FOLDER_PATH = ['Privat', 'Haus-Leiwen'];
  ```
- Neue Hilfsfunktion `resolveFolderId()`:
  - Auflösung per Microsoft-Graph-Walk, da Graph keine Pfad-API für mailFolders kennt:
    1. `GET /me/mailFolders?$filter=displayName eq 'Privat'&$select=id` → Root-Ordner-ID
    2. `GET /me/mailFolders/{id}/childFolders?$filter=displayName eq 'Haus-Leiwen'&$select=id` → Ziel-ID
  - Ergebnis im Modul-Scope cachen (einfache `let cachedFolderId`), da der Pfad statisch ist.
  - Bei „nicht gefunden" klaren Fehler werfen (`Outlook-Ordner "Privat/Haus-Leiwen" nicht gefunden`).
- `listOutlookMessages` umbauen:
  - `folder`-Enum aus dem Input-Schema entfernen (nur noch optional `query`).
  - Endpoint: `/me/mailFolders/{resolvedId}/messages?...` (statt `inbox`/`sentitems`).
  - Rückgabe-Mapping: das `folder`-Feld in `OutlookMessage` auf festen Wert `'haus-leiwen'` setzen (Typ entsprechend erweitern) oder ganz aus dem Interface entfernen.
- `saveOutlookEmailToOnedrive` bleibt funktional unverändert (greift per `messageId` zu) — aber zur Sicherheit kein Refactor nötig.

### 2. Aufrufseite (`src/components/outlook-picker.tsx`)
- Sent/Inbox-Tabs / Folder-Toggle entfernen, falls vorhanden.
- Aufruf von `listOutlookMessages` ohne `folder`-Parameter.
- UI-Label anpassen (z. B. „Posteingang Haus-Leiwen").

### 3. Keine DB-/Auth-Änderungen
Reine Code-Beschränkung. Token hätte weiterhin technisch Zugriff aufs ganze Postfach — das ist Selbstdisziplin im Code, keine harte Token-Einschränkung (siehe vorherige Diskussion).

## Hinweise / Caveats
- Sollte der Ordner umbenannt/verschoben werden, schlägt jede Abfrage mit klarer Fehlermeldung fehl — Pfad dann im Code anpassen.
- `displayName`-Filter ist case-sensitive in Graph; exakte Schreibweise `Privat` und `Haus-Leiwen` (mit Bindestrich) wird verwendet.
- Cache lebt pro Worker-Instanz; bei Folder-Rename greift erst ein Re-Deploy.

## Out of Scope
- Shared Mailbox, ApplicationAccessPolicy, eigene Entra-App-Registration.
- Änderungen am OneDrive-Korrespondenz-Pfad (bleibt `Privat/Haus/Leiwen/Korrespondenz`).
