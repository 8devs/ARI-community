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

The Supabase Edge Function `send-email-notification` now expects an HTTP relay at `EMAIL_RELAY_URL` that forwards payloads to your own SMTP server. A minimal relay is provided in `relay/server.ts` and can be started locally with `npm run relay`. Configure it via environment variables before starting:

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

Expose the `/send` endpoint of this relay (e.g. behind HTTPS) and set the corresponding Supabase secrets:

```
EMAIL_RELAY_URL=https://your-relay.example.com/send
EMAIL_RELAY_TOKEN=<same shared secret>
NOTIFY_FROM_EMAIL=notifications@example.com
```

After updating the secrets, redeploy the function with

```
supabase functions deploy send-email-notification --project-ref <project>
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/56d9ef2e-2542-47e2-bd08-0f8ad0483b89) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
