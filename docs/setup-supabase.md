# Supabase setup (hosted project)

1. Create a project at supabase.com. Copy the project URL and the **publishable** key (Settings, API Keys). Never copy the service-role/secret key anywhere in this repo.
2. Link and push the schema: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
3. Authentication, URL configuration: set Site URL to `https://mathiascornejo.github.io/GymTrackerApp/` and add `http://localhost:5173/**` to the redirect allow-list.
4. Authentication, Email: keep "Confirm email" on. The email template should include the 6-digit `{{ .Token }}` so the code sign-in works inside the installed iPhone app.
5. Create your account from the app (desktop browser), confirm the email, sign in.
6. Authentication, Sign In / Providers: turn **off** "Allow new users to sign up". Your existing account keeps working.
7. GitHub repo, Settings, Secrets and variables, Actions: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
8. GitHub repo, Settings, Pages: set Source to "GitHub Actions".
9. Local development: copy `.env.example` to `.env.local` and fill the same two values (or use the local stack values from `npx supabase status`).
