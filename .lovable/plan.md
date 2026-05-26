## Ausgangslage

- `BernhardAP/Bauplanung` ist öffentlich und enthält ein vollständiges Projekt mit **demselben Stack**, den Lovable hier verwendet: TanStack Start, Vite 7, React 19, Tailwind v4, Supabase, shadcn/ui.
- Dieses Lovable-Projekt ist leer (nur `.gitignore`), darum lädt der Preview nicht.
- Weil die Stacks identisch sind, kann ich den Code **direkt aus dem öffentlichen Repo in dieses Projekt übernehmen** — kein lokaler Git-Workaround nötig.

## Plan

### 1. Code übertragen
Ich lade alle Dateien aus `BernhardAP/Bauplanung@main` per GitHub API und schreibe sie 1:1 in dieses Lovable-Projekt. Übertragen werden u. a.:

- Konfiguration: `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`, `components.json`, `eslint.config.js`, `bunfig.toml`, `.prettierrc/.prettierignore`
- App-Code: alles unter `src/` (Routes, Components, UI, Hooks, lib, Supabase-Integration, `router.tsx`, `server.ts`, `start.ts`, `styles.css`)
- `supabase/` Ordner (Migrationen, falls vorhanden)
- **NICHT** übertragen: `.env` (enthält geheime Keys — Lovable Cloud setzt die selbst), `.git`, `node_modules`

### 2. Dependencies installieren
`bun install`, damit der Dev-Server starten kann.

### 3. Lovable Cloud prüfen
Das Projekt nutzt Supabase. Ich prüfe, ob Lovable Cloud aktiviert werden muss und ob die DB-Migrationen aus `supabase/migrations/` hier neu ausgeführt werden müssen, damit Tabellen/RLS existieren.

### 4. Preview verifizieren
Dev-Server-Logs checken, ggf. kleine Anpassungen (z. B. fehlende Env-Vars, Lovable-spezifische Vite-Plugins).

## Was du danach noch tun musst

- **Supabase-Daten**: Falls dein altes Projekt echte Daten enthielt, müssen die separat exportiert (CSV) und hier importiert werden.
- **Secrets**: Wenn `.env` API-Keys für OneDrive/Outlook o. ä. enthielt, sage mir welche — ich richte sie als Lovable-Secrets ein.
- **Repo wieder privat**: Sobald der Transfer durch ist, kannst du `Bauplanung` wieder privat schalten.

## Offene Fragen

1. Soll ich Lovable Cloud (Supabase) für dieses Projekt **automatisch aktivieren** und die Migrationen ausführen? (Empfohlen — sonst läuft die App ohne DB ins Leere.)
2. Gab es im alten Supabase **produktive Daten**, die du behalten willst, oder können wir mit leerer DB starten?
