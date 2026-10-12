# Tempered

A personal gym tracker: plan a weekly routine, log sessions set by set with a rest timer, and watch estimated 1RMs turn into ranks on a body map. One account holder, no social features. Installable as a phone app.

## What it does
- **Dashboard**: a body map colored by estimated-1RM rank (Wood to Olympian), weekly sets, 1RM trends, session frequency, bodyweight, recent bests.
- **Session**: today's exercises pre-filled from your routine and last session, per-set entry, recommendations, a rest timer with a background notification.
- **Routines**: a drag-and-drop weekly board with supersets, circuits and an accessory bank. Import and export as JSON.
- **Exercises**: 876 searchable exercises with demo images and steps, plus your own custom exercises.

## Stack
Vite, React, TypeScript, CSS custom properties and CSS Modules, dnd-kit, TanStack Query, Supabase (Auth, Postgres with row level security, Edge Functions, pg_cron), a service worker for offline and push. Hosted on GitHub Pages.

## Run it locally
You need Node 24 and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start            # local Postgres, Auth and Edge runtime
cp .env.example .env.local    # then fill it from `npx supabase status`
npm run dev
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run typecheck` | App and service worker type checks |
| `npm test` | Unit tests (ranking, routines, sessions, handlers) |
| `npx supabase test db` | Row level security tests against the local database |
| `npm run e2e` | Browser tests on a phone and a desktop viewport, against the local stack |
| `npm run build` | Typecheck and production build |
| `npm run vapid` | Print a new VAPID key pair for push |
| `npm run icons` | Re-render the PWA icons |

## Deploy
1. **Supabase project**: follow [docs/setup-supabase.md](docs/setup-supabase.md). It covers creating the project, pushing migrations, auth URLs, disabling public sign-ups, the keep-alive secrets, and the background alarm (VAPID keys, function deploy, Vault secrets).
2. **GitHub Pages**: Settings, Pages, Source: GitHub Actions. The `github-pages` environment must allow the branch the workflow runs from.
3. **Repository secrets** (Settings, Secrets and variables, Actions): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`. All three are public values by design.
4. Push to the deploy branch. The workflow tests, builds and publishes. A second scheduled workflow pings the database every 3 days so a free project does not pause.

The app is served under `/GymTrackerApp/` (the Vite `base`). Change it in `vite.config.ts` if you rename the repository.

## The background rest alarm, honestly
It is a **notification**, not a ringing alarm clock. It uses the phone's notification sound, cannot loop, and follows Silent and Focus settings. On iPhone it only works after you add the app to the Home Screen and open it from there. Timing is best effort (a 5 second cron plus push delivery). Measure your own phone with [docs/alarm-timing.md](docs/alarm-timing.md) before relying on it.

## Data and privacy
- Weights are stored in kilograms; the display unit is a setting.
- Every table has your `user_id` and row level security; tests prove another account cannot read, change, delete or attach to your rows.
- The browser only ever holds the publishable key. The service-role key and the VAPID private key exist only in Supabase function secrets and Vault.
- Settings can export your sets and sessions (CSV) or everything (JSON), and delete your account with all its data.

## Standards are approximate
The strength standards behind the ranks are placeholders written for this app, not a published table. Each is marked `UNVERIFIED` in `src/ranking/standards.ts` and can be edited in Settings.

## Project map
| Path | Purpose |
|---|---|
| `src/app` | Screens and UI components |
| `src/data` | The only code that talks to Supabase (repository layer, outbox, push) |
| `src/routines`, `src/session`, `src/ranking` | Pure, tested domain logic |
| `src/exercises` | Vendored dataset and search |
| `src/sw.ts` | Service worker: precache, images, push |
| `supabase/migrations` | Schema, row level security, cron |
| `supabase/functions` | `send-rest-push`, `delete-account` |
| `docs` | Build brief, setup, alarm timing, ranking lifts |
| `CLAUDE.md` | Conventions for working on this codebase |

## Credits
Exercise data and images: [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) by hasaneyldrm (MIT for data; animations © [Gym visual](https://gymvisual.com/), see its NOTICE.md), pinned to a commit and served through jsDelivr.
