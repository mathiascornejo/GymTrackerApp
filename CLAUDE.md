# Tempered

Personal gym tracker. Spec: `docs/build-brief.md` (read it before changing behavior). Repo: github.com/mathiascornejo/GymTrackerApp, deployed to GitHub Pages.

## Stack
Vite + React + TypeScript SPA, hash routing (`#/dashboard`, `#/log`, `#/routines`, `#/library`, `#/weight`, `#/steps`), CSS custom properties + CSS Modules (no component kit), `dnd-kit`, `motion`, hand-rolled SVG charts, Supabase (Auth, Postgres+RLS, Edge Functions), TanStack Query over a repository layer in `src/data/`, `vite-plugin-pwa` (injectManifest). npm only.

## Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest, `src/**/*.test.ts`), `npm run typecheck`
- `npx supabase start` (needs Docker) then `npx supabase test db` (RLS, pgTAP) and `npm run e2e` (Playwright, phone + desktop, signs in against the local stack)
- Migrations live in `supabase/migrations/`; apply locally with `npx supabase db reset`

## Conventions
- Phases per brief section 12: one commit per phase, stop for review after each. Mark unverified domain data `// UNVERIFIED` and list it in the phase summary.
- Anything with math is a small pure function with a unit test (e1RM, rank, recommend, unit conversion).
- No component talks to Supabase directly; go through `src/data/`.
- Profile writes patch the query cache synchronously and do not refetch on success (a racing refetch undoes newer changes). Controlled inputs in Settings mirror their value locally; see `useMirror` in `src/app/Settings.tsx`.
- New table checklist: `user_id`, composite FKs `(parent_id, user_id)`, add the table name to the RLS loop in a new migration, and seed one row in `supabase/tests/database/rls.test.sql`.
- Sentence case, plain verbs; no streak guilt; no all-caps tracked labels, no monospace data labels, no arrow glyphs on buttons.
- Only one tab's content is mounted at a time. Translucent blur only on the tab bar and sheets.
- App name lives in one constant (rename is a one-line change); currently "Tempered".
- CSP is a build-time `<meta>` (vite.config.ts). Scripts must be external files, no inline `<script>`.

## Routines
- A routine is one nested document (`src/routines/model.ts`: pure, tested operations). The repository (`src/data/routines.ts`) diffs it into rows, upserts only changed rows, soft-deletes removed ones, and serializes saves in a queue.
- Edit through `actions.update(id, fn)`, which reads the latest cache: a component's rendered copy can be a tap behind.
- Weekdays are 0 = Sunday. Bank blocks are blocks with `routine_day_id = null`; bank schedule is `weekdays` (daily = all seven) or `weeklyTarget`.
- Superset strips and keyboard drags: keyboard drags hide the strips because Arrow keys would target them. dnd-kit needs about 400 ms after pick-up before Arrow keys register (tests wait for it).

## Sessions
- Completed sets go through an outbox (`src/data/sessions.ts`): written to localStorage first, then sent in order with backoff. Never write `session_sets` directly from a component. A rejected set (server error code) is dropped and surfaced; a network failure is kept and retried.
- Typed-but-unlogged values, extra rounds, warm-ups, skips and ad hoc exercises live in a per-session draft (`src/session/draft.ts`). A logged set is a `session_sets` row; planned sets exist only in the UI.
- A set row maps to a slot by `(block_id, exercise_ref, round_index, is_warmup)`. Ad hoc exercises have `block_id = null`.
- Tapping done with empty fields logs the grey ghost values from the last session; with no ghost it asks for input.
- Rest timer stores an absolute `endsAt`; never count intervals. Audio needs the start tap to unlock.
- `recommend()`, `findPRs()`, `epley()` are pure and tested; do not inline them in components.

## Ranking
- `src/ranking/standards.ts` is the only place standards live. Every number is `// UNVERIFIED`; users can override per lift in Settings (`profiles.standards_overrides`). Thresholds are bodyweight multiples to REACH Bronze..Olympian; Wood is the floor.
- `computeRanks` is pure: best credited set per lift, best lift per muscle, median overall. Any exercise ranks: ones without a standard get `derivedLift` (muscle reference scaled by equipment, `// UNVERIFIED`); a lift credits its primary muscles in full and secondaries at `SECONDARY_CREDIT`. Callers pass an `info(ref)` lookup. Muscles with no data are absent (drawn neutral), never Wood. Sets over 5x bodyweight are `flagged` and excluded until `session_sets.confirmed`.
- Rank-up ceremony compares current tiers with `localStorage["tempered.ranks.seen"]`; the first visit only records. Dashboard data is paged (PostgREST caps responses at 1000 rows).
- Front and back maps always show together (no list mode). Body map art lives in `src/app/bodyMapArt.ts` (original, 200x380 box). Materials are static SVG defs in `BodyMap.tsx`; the only animation is the one-shot sheen.

## Local testing
- `supabase/config.toml` raises auth rate limits for the local stack only; the e2e suite signs in once per test. Hosted projects keep their own limits.
- After a profile edit, tests wait for the PATCH response (`profileSaved`) before reloading; reloading mid-save correctly shows the old value.

## Background alarm
- Client: `src/data/push.ts` (permission, subscription, state), `src/data/restTimers.ts` (arm = `arm_rest_timer` RPC: sends the remaining ms, the server sets `fire_at` by its own clock and cancels the old pending row; serialized). Never send a client-computed `fire_at`: phone clocks drift. `useRestTimer(pushState)` arms on start/adjust and cancels on skip and on foreground completion.
- Server: `pg_cron` every 5 s calls `send-rest-push` only when a timer is due within 6 s. The function sleeps until `fire_at`, THEN claims the row with an atomic update, so a Skip pressed during the wait still cancels it. One pending timer per user is enforced by a unique partial index.
- Decision logic is `supabase/functions/send-rest-push/handler.ts` with injected dependencies, tested in Vitest. `index.ts` is only wiring and runs on Deno.
- The service worker (`src/sw.ts`) must show a notification for every push (iOS requires it) and never suppresses one while the app is open.
- Secrets: VAPID private key and service-role key live only in function secrets and Vault. `supabase/functions/.env.local` is git-ignored.

## Quality gates
- `tests/a11y.spec.ts` runs axe (WCAG 2 A/AA) over every screen and the open sheets in light and dark, plus reduced motion and 44 px targets on phone. Body-map regions are exempt from the size check; each is keyboard focusable. New screens or sheets get a scan.
- Filled accent and done backgrounds use `--on-accent` / `--on-done` for text (dark mode flips to black for contrast). Never hard-code `#fff` on them.
- `flushOutbox()` returns the in-flight flush; callers that must know sets are saved (finishing a session) await it.
- Account deletion is the `delete-account` function only. The client sends the typed email; the server re-checks it against the signed-in user and deletes only that user.
- `npm run e2e` also starts `supabase functions serve` (second web server) so the function tests run locally.

## Exercise data
- Dataset (hasaneyldrm/exercises-dataset, converted by `scripts/build-exercise-dataset.mjs`; media © Gym visual, personal use only) is vendored at `src/exercises/dataset.json`, pinned to `DATASET_SHA` in `src/exercises/dataset.ts` (images from jsDelivr at that SHA). It loads as a separate chunk.
- `dataset.json` has hand edits the build script does not reproduce: typo fixes in names (Reverse, Preacher, Knees, Quad), plus four exercises without media (`Cable_Bayesian_Curl`, `Cable_Standing_Overhead_Triceps_Extension`, `Cable_Hammer_Curl`, `Cable_Face_Pull`). Re-apply them if the file is regenerated. A second set of hand edits lives in `scripts/patch-exercise-dataset.mjs` (renames, "Smith Machine" / "Machine" / "EZ-Bar" name prefixes, 21 exercises pulled from upstream that the build filter dropped, 23 hand-written ones without media such as the hip thrust variants and plank); it is idempotent, so re-run it after regenerating: `node scripts/patch-exercise-dataset.mjs <upstream data/exercises.json>`. Added muscles are `// UNVERIFIED`.
- Refs are `ds:<id>` or `custom:<uuid>`. Do not bump the SHA without an old-id to new-id check: history stores refs.
- Muscle vocabulary is derived from the data (17 groups). Dataset labels are lower-case; show them through `cap()`.

## Units and time
- **Kilograms are canonical** (`numeric(8,4)`). Convert at the edges, round for display to 0.1. Never store pounds.
- Timestamps UTC `timestamptz`; "today's weekday" is computed on-device. Default week start Monday.

## Security
- **Never ship the Supabase service-role key to the client.** Client uses only the publishable key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Service role and VAPID private key live only in Edge Function secrets.
- Every table has `user_id` and RLS `user_id = (select auth.uid())`.

## Design tokens
Light / dark (guarded `:root:not([data-theme="light"])` plus `:root[data-theme="dark"]`), defined in `src/styles/tokens.css`:
ground #F5F5F7 / #05090F, surface #FFF / #0E151F, ink #1D1D1F / #E9F4FF, ink-muted #6E6E73 / #8EA2B8, accent #0A5CFF / #19E3FF, done #1F7A35 / #7DFF6B (light changed from #34C759 for AA). Dark is the "Chrome and cyan" theme; light is unchanged.
Ranks (same in both themes, mirrored in `src/ranking/tierColors.ts`, a test keeps them equal): wood #80603F, bronze #CD7A35, silver #BDBFC2, gold #C8920E, platinum #2F8F91, diamond #7FD3FF, master #8B4FD8, olympian #F2C96B (banded foil; never red, red reads as injury). Neighbours differ in hue and lightness. The overall tier name uses its color only where it passes 3:1 (large text) on the surface; otherwise ink plus a colored dot.
Radii: sheets 28, grouped lists 20, controls 12, chips full. UI font: system stack; display: Space Grotesk Variable (self-hosted via @fontsource-variable).
