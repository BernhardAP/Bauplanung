## Gefundene Lücke

### `saveOutlookEmailToOnedrive` akzeptiert beliebige `messageId`
In `src/lib/outlook.functions.ts` lädt der Endpoint das MIME einer beliebigen Outlook-Mail per `/me/messages/{id}/$value` und legt es als `.eml` in `Privat/Haus/Leiwen/Korrespondenz` ab. Ein manipulierter Client könnte also **jede** Mail-ID aus dem gesamten Postfach (z. B. aus dem privaten Posteingang) einreichen — der Server prüft nicht, ob sie aus dem erlaubten Ordner `Privat/Haus-Leiwen` stammt.

**Fix:** Vor dem MIME-Download:
1. `GET /me/messages/{id}?$select=parentFolderId` aufrufen.
2. Gegen `resolveFolderId()` (bereits vorhanden) vergleichen.
3. Bei Mismatch klaren Fehler werfen: `"E-Mail liegt nicht im erlaubten Ordner"`.

Das macht die `listOutlookMessages`-Beschränkung end-to-end verbindlich.

## Bereits sicher (zur Bestätigung)
- **`searchOnedrive`** — fest auf `Privat/Haus/Leiwen` per `:/search()` gescoped.
- **`browseOnedrive`** — `folderId` wird seit eben gegen `parentReference.path` validiert.
- **`listOutlookMessages`** — geht nur noch über die aufgelöste Folder-ID.
- **`onedriveFetch`/`outlookFetch`** — interne Helfer, nicht als ServerFn exportiert, daher nicht direkt vom Client aufrufbar.
- **Schreibziel `Korrespondenz`-Ordner** — Pfad ist hartgecodet, kein Input vom Client.

## Bewusst nicht eingeschränkt (kein aktueller Angriffspfad)
- Microsoft-Outlook-OAuth-Scope (`Mail.ReadWrite`, `Files.ReadWrite`) — der Token selbst hat technisch weiter Vollzugriff. Echte Token-Härtung ginge nur über eigene Entra-App + `ApplicationAccessPolicy` (out of scope laut vorheriger Entscheidung).
- Senden, Antworten, Löschen, Verschieben von Mails — wir implementieren keine dieser Operationen, also kein Risiko.
- Datei-Download/Delete/Move auf OneDrive — ebenfalls nicht implementiert.

## Out of Scope
- Supabase-RLS-Audit (separates Thema, falls gewünscht eigener Task).
- Migration auf eigene Entra-App-Registration.
