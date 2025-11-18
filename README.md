# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/56d9ef2e-2542-47e2-bd08-0f8ad0483b89

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/56d9ef2e-2542-47e2-bd08-0f8ad0483b89) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Self-hosted email relay

The Supabase Edge Function `send-email-notification` now expects an HTTP relay at `EMAIL_RELAY_URL` that forwards payloads to your own SMTP server. Zwei Varianten stehen bereit:

1. **Serverless (Vercel)**: Datei `api/relay.ts` implementiert eine Vercel Function unter `/api/relay`. Hinterlege dort die SMTP-Werte als Environment Variables im Vercel-Projekt.
2. **Eigenständiger Server**: `relay/server.ts` kann lokal mit `npm run relay` gestartet und beispielsweise hinter einem eigenen Reverse Proxy betrieben werden.

Für beide Varianten werden dieselben Variablen verwendet:

```
RELAY_SMTP_HOST=<smtp.example.com>
RELAY_SMTP_PORT=465         # or 587
RELAY_SMTP_SECURE=true      # false to use STARTTLS
RELAY_SMTP_USERNAME=<user>
RELAY_SMTP_PASSWORD=<pass>
RELAY_AUTH_TOKEN=<shared secret used by Supabase>
RELAY_FROM_FALLBACK=notifications@example.com
RELAY_PORT=8788             # optional HTTP port
```

Expose die jeweilige `/api/relay`- bzw. `/send`-Route (z. B. hinter HTTPS) und setze anschließend die Supabase-Secrets:

```
EMAIL_RELAY_URL=https://your-relay.example.com/send
EMAIL_RELAY_TOKEN=<same shared secret>
NOTIFY_FROM_EMAIL=notifications@example.com
```

After updating the secrets, redeploy the function with

```
supabase functions deploy send-email-notification --project-ref <project>
```

## Versioning & Changelog

- Die aktuelle Produktversion wird in `package.json`, `src/version.ts` und im UI angezeigt. Passe `APP_VERSION` und `APP_RELEASE_DATE` für jedes Release an.
- Ergänze neue Einträge in `src/data/changelog.ts` (und damit automatisch auf `/changelog`). Nutze das gleiche Schema wie für die bestehenden Versionen, um Highlights und Details festzuhalten.
- Dokumentiere zusätzlich im Repository die Änderungen in `CHANGELOG.md`, damit externe Leser:innen denselben Überblick erhalten.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/56d9ef2e-2542-47e2-bd08-0f8ad0483b89) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase Auth Redirects & Custom Domain

- Die App verwendet einen HashRouter, daher müssen Supabase-Weiterleitungen mit `/#/…` beginnen (z. B. `https://deine-domain.de/#/passwort/neu`), damit der Host immer `index.html` liefert und React die Route rendert.
- Setze in Supabase → Authentication → URL configuration die `Site URL` auf Deine Domain und ergänze unter „Redirect URLs“ mindestens `https://deine-domain.de/#/login` sowie `https://deine-domain.de/#/passwort/neu`.
- Beim `signUp`, `signInWithOtp` und `resetPasswordForEmail` werden diese Hash-URLs automatisch verwendet, deshalb greifen die obigen Werte sofort.
- Falls Mail-Links nicht mehr auf `*.supabase.co` zeigen sollen, richte dort zusätzlich eine Custom Domain (z. B. `auth.deine-domain.de`) ein und folge den DNS-Schritten; Supabase kümmert sich um das Zertifikat.

## Standardpasswort für neue Nutzer:innen

- Die Edge Function `admin-set-password` setzt das Passwort per Service Role auf den Standardwert `Adenauerring1`. Das Admin-Menü bietet dafür einen Button („Standardpasswort“), genau wie eine Aktion zum Generieren eines Recovery-Links.
- Nach dem Versand einer Einladung ruft das Frontend automatisch dieselbe Funktion auf, sodass neue Accounts sofort dieses Passwort besitzen. Admins können den Wert direkt kommunizieren oder anschließend über den Reset-Link eine Änderung auslösen.
- Passe den Wert bei Bedarf per Function-Environment `DEFAULT_USER_PASSWORD` an.
- Nach Änderungen an den Funktionen unbedingt deployen: `supabase functions deploy admin-set-password generate-password-link --project-ref <project>`.
