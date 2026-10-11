# Tempered

Personal gym tracker. Spec: `docs/build-brief.md` (read it before changing behavior). Repo: github.com/mathiascornejo/GymTrackerApp, deployed to GitHub Pages.

## Stack
Vite + React + TypeScript SPA, hash routing (`#/dashboard`, `#/log`, `#/routines`, `#/library`), CSS custom properties + CSS Modules (no component kit), `dnd-kit`, `motion`, hand-rolled SVG charts, Supabase (Auth, Postgres+RLS, Edge Functions), TanStack Query over a repository layer in `src/data/`, `vite-plugin-pwa` (injectManifest). npm only.

## Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest, `src/**/*.test.ts`), `npm run e2e` (Playwright: phone + desktop viewports), `npm run typecheck`

## Conventions
- Phases per brief section 12: one commit per phase, stop for review after each. Mark unverified domain data `// UNVERIFIED` and list it in the phase summary.
- Anything with math is a small pure function with a unit test (e1RM, rank, recommend, unit conversion).
- No component talks to Supabase directly; go through `src/data/`.
- Sentence case, plain verbs; no streak guilt; no all-caps tracked labels, no monospace data labels, no arrow glyphs on buttons.
- Only one tab's content is mounted at a time. Translucent blur only on the tab bar and sheets.
- App name lives in one constant (rename is a one-line change); currently "Tempered".
- CSP is a build-time `<meta>` (vite.config.ts). Scripts must be external files, no inline `<script>`.

## Units and time
- **Kilograms are canonical** (`numeric(8,4)`). Convert at the edges, round for display to 0.1. Never store pounds.
- Timestamps UTC `timestamptz`; "today's weekday" is computed on-device. Default week start Monday.

## Security
- **Never ship the Supabase service-role key to the client.** Client uses only the publishable key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Service role and VAPID private key live only in Edge Function secrets.
- Every table has `user_id` and RLS `user_id = (select auth.uid())`.

## Design tokens
Light / dark (guarded `:root:not([data-theme="light"])` plus `:root[data-theme="dark"]`), defined in `src/styles/tokens.css`:
ground #F5F5F7 / #000, surface #FFF / #1C1C1E, ink #1D1D1F / #F5F5F7, ink-muted #6E6E73 / #98989D, accent #0A5CFF / #4C8DFF, done #1F7A35 / #30D158 (light changed from #34C759 for AA).
Ranks: wood #8A6A47, bronze #B87333, silver #AEB4BE, gold #E2B13C, platinum #8FC9CF, diamond #BDEBFF, master #9B5DE5, olympian #D7263D (foil #F2C96B).
Radii: sheets 28, grouped lists 20, controls 12, chips full. UI font: system stack; display: Bricolage Grotesque Variable (self-hosted via @fontsource-variable).
