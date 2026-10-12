# Supabase setup (hosted project)

1. Create a project at supabase.com. Copy the project URL and the **publishable** key (Settings, API Keys). Never copy the service-role/secret key anywhere in this repo.
2. Link and push the schema: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
3. Authentication, URL configuration: set Site URL to `https://mathiascornejo.github.io/GymTrackerApp/` and add `http://localhost:5173/**` to the redirect allow-list.
4. Authentication, Email: keep "Confirm email" on. Password sign-in needs nothing else. The optional email-code sign-in (useful inside the installed iPhone app) needs the "Magic link" template to contain `{{ .Token }}`, and Supabase only lets you edit templates once you connect your own SMTP provider. When you have done both, build with `VITE_EMAIL_CODE_SIGNIN=true` to show it.
5. Create your account from the app (desktop browser), confirm the email, sign in.
6. Authentication, Sign In / Providers: turn **off** "Allow new users to sign up". Your existing account keeps working.
7. GitHub repo, Settings, Secrets and variables, Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
8. GitHub repo, Settings, Pages: set Source to "GitHub Actions".
9. Local development: copy `.env.example` to `.env.local` and fill the same two values (or use the local stack values from `npx supabase status`).

## Background rest alarm

The alarm is a Web Push notification sent by a Supabase Edge Function, triggered every 5 seconds by `pg_cron` only while a timer is due.

10. Generate a VAPID key pair on your machine: `npm run vapid`. It prints a public and a private key. Keep the private one out of the repo and out of chat.
11. Public key: add it as the GitHub Actions secret `VITE_VAPID_PUBLIC_KEY` and as `VITE_VAPID_PUBLIC_KEY` in `.env.local`.
12. Private key and public key for the function (this stores them in Supabase, not in the client):
    ```bash
    npx supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@example.com
    ```
13. Deploy the function. The cron job authenticates with the service-role key itself, so platform JWT checking is off for this one function:
    ```bash
    npx supabase functions deploy send-rest-push --no-verify-jwt
    ```
14. Give the database the two Vault secrets the cron job reads. Run this in the Supabase SQL editor (not in a file in this repo):
    ```sql
    select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
    select vault.create_secret('<your service role / secret key>', 'service_role_key');
    ```
15. `npx supabase db push` already created the `send-rest-push` cron job (migration `…000400_rest_alarm.sql`). Check it in the SQL editor: `select jobname, schedule, active from cron.job;`
16. On your iPhone: open the site in Safari, Share, Add to Home Screen, open it from the Home Screen, then Settings, "Turn on notifications".
17. Measure real delays with `docs/alarm-timing.md` before trusting the alarm.

Limits to remember: it is a notification, not a ringing alarm. It uses the OS notification sound, cannot loop, and follows Silent and Focus modes. On iPhone it only works from the installed Home Screen app.
