## Ziel

Eine mobile-first Web-App zur Verwaltung der Bauplanung „Leiwen". Aufgaben werden als verschachtelte Liste geführt (analog zum Word-Dokument 1 → 1.1 → 1.1.1), mit Status, Unternehmen, optionalen Daten und Anhängen. Unternehmen werden separat verwaltet und sind direkt aus der App per Telefon und E-Mail (mit CC, Default Hoffmann) erreichbar.

## Stack & Daten

- Lovable Cloud (Datenbank + Storage) aktivieren — kein Login, RLS public lesen/schreiben (private Nutzung).
- Tabellen:
  - `companies` (id, name, kuerzel, kontaktperson, telefon, email, adresse, web, notes, is_default_cc)
  - `tasks` (id, title, parent_id self-FK, sort_order, depth, status enum [`open`,`in_progress`,`waiting`,`done`,`blocked`,`question`], company_id FK nullable, start_date, end_date, notes, created_at)
  - `attachments` (id, task_id FK, filename, storage_path, mime_type, kind enum [`document`,`email`])
- Storage-Bucket `attachments` (public read).
- Initial-Seed via Migration: Unternehmen (Kappes, Oster, Biedlingmaier, Hoffmann, Zöllner, Freis, Reis & Neumann, Hofer, Sielaff, Kretzschmar) + Aufgaben-Baum aus dem Dokument (Rohbau, Balkon, Innenausbau, Heizung, Umzug, Planung, Angebote). Hoffmann mit `is_default_cc = true`.

## Routen (TanStack Start, mobile-first)

- `/` Aufgabenliste (Hauptansicht)
- `/companies` Liste der Unternehmen
- `/companies/$id` Detail/Edit eines Unternehmens
- Bottom-Navigation (Aufgaben | Unternehmen)

## Aufgabenliste (`/`)

- Eine Zeile pro Aufgabe, kompakt:
  - Status-Icon links (Lucide: Circle/Loader/Clock/Check/Ban/HelpCircle, Tap zyklisch wechseln)
  - Titel (einzeilig, truncate)
  - Unternehmens-Kürzel als kleines Badge
  - Datum kurz (`dd.MM.` oder leer)
  - Einrückung pro Hierarchie-Ebene (`pl-{depth*4}`)
- Inline-Add: leere Zeile am Ende der Liste (oder pro Knoten via „+"), Enter speichert; neue Aufgabe erbt parent der vorherigen.
- Reihenfolge ändern: Drag-Handle (lange Berührung) zum Verschieben innerhalb derselben Ebene.
- Swipe-Gesten (mit `framer-motion` drag x):
  - Swipe rechts → Einrücken (depth +1, neuer Parent = vorherige Aufgabe gleicher Ebene)
  - Swipe links → Ausrücken (depth −1)
- Tap auf Zeile (außerhalb Status-Icon) → Detail-Dialog.

## Detail-Dialog (Sheet von unten, mobile)

Felder: Titel, Status, Unternehmen (Combobox), Startdatum (optional), Enddatum (optional), Notizen, Anhänge (Liste mit Upload-Button, Löschen). Beim Anhang-Typ wird automatisch erkannt: `.msg`/`.eml` → email, sonst document. Buttons unten: „Anrufen" und „E-Mail" (nur wenn Unternehmen gesetzt).

## Unternehmens-Aktionen

- Anrufen: `tel:` mit Telefonnummer.
- E-Mail: `mailto:` mit `to=email`, `cc=Hoffmann-Email` (default; im Dialog können weitere CCs aus der Unternehmensliste angehakt werden), `subject=<Aufgaben-Titel>`, `body=<Notizen>`.

## Unternehmens-Verwaltung (`/companies`)

- Liste (Kürzel + Name + Kontaktperson). Tap → Detail/Edit.
- Felder: Name, Kürzel (max ~6 Zeichen), Kontaktperson, Telefon, E-Mail, Adresse, Web, Notizen, Default-CC-Toggle.
- Plus-Button für neues Unternehmen.

## UI / Design

- Mobile-first, Tailwind, Shadcn (Sheet, Dialog, Input, Button, Badge, Select). Klare semantische Tokens in `src/styles.css` (sachliche Bauplaner-Optik: warmes Off-White, dunkles Anthrazit, dezenter Akzent in Bau-Gelb für Status).
- Bottom-Tab-Bar fix für Navigation. Header oben mit Titel.

## Technische Details

- Drag/Reorder: `@dnd-kit/core` + `@dnd-kit/sortable`.
- Swipe: eigener Handler mit `framer-motion` `drag="x"` + Threshold ~80px.
- Datenzugriff: Browser-Supabase-Client direkt aus Komponenten (keine Auth nötig); React Query für Caching.
- Dateiupload via `supabase.storage.from('attachments').upload()`.
- `sort_order` als float (zwischen Nachbarn der Mittelwert) für günstige Inserts ohne Mass-Update.
- Hierarchie: `parent_id` + `depth` redundant gespeichert für einfache Renderung.

## Out of Scope (für jetzt)

- Kein Login, kein Multi-User-Sync, kein Server-Side-Mailversand, keine Push-Benachrichtigungen, keine Offline-Sync-Logik (nur Online-Nutzung).
