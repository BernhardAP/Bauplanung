## Ziel
Im Settings → Nutzer-Tab kannst Du für jede freigeschaltete E-Mail-Adresse direkt ein Passwort vergeben (statt nur Einladung per Mail). Funktioniert sowohl, wenn der User noch nie eingeloggt war, als auch bei bestehenden Konten (Passwort-Reset durch Admin).

## Änderungen

### 1. `src/lib/users.functions.ts` — neue Server-Funktion `setUserPassword`
- Eingabe: `{ email, password }` (Zod: Email gültig, Passwort 8–128 Zeichen)
- Nur Admin (`bernhard.gruender@outlook.com`) darf aufrufen
- Sucht User per `admin.auth.admin.listUsers` (paginiert wie in `listAllowedEmails`)
- **Existiert User:** `admin.auth.admin.updateUserById(id, { password })`
- **Existiert noch nicht:** Email in `allowed_emails` upserten, dann `admin.auth.admin.createUser({ email, password, email_confirm: true })` → User kann sich sofort einloggen

### 2. `src/components/user-management-panel.tsx` — neuer Dialog „Passwort setzen"
- Pro Listenzeile ein zusätzliches Icon (z. B. `KeyRound`) neben Mail-/Trash-Buttons
- Klick öffnet kleinen Dialog mit:
  - E-Mail (readonly)
  - Neues Passwort (min. 8 Zeichen)
  - Passwort bestätigen
  - Speichern-Button
- Bei Erfolg: Toast „Passwort gesetzt für …"
- Auch für die Admin-Adresse selbst nutzbar (kein Filter)

## Technische Details
- Wiederverwendung des bestehenden `getAdminClient()` mit Service-Role-Key — bleibt server-only
- Keine Schema-Änderung, keine RLS-Änderung nötig
- Keine Mail wird versendet (bewusst, da Du Passwörter persönlich übergibst)

## Was sich für Dich ändert
Statt „Einladen → User vergibt sein Passwort beim ersten Login" kannst Du nun:
1. Adresse einladen (wie bisher) **oder**
2. Direkt ein Passwort setzen und dem Nutzer Zugangsdaten mitteilen — er ist sofort eingeloggt-fähig.