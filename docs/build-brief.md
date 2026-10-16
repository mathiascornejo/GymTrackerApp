# Build brief: gym tracking web app (working title: "Tempered")

Audience: Claude Code. Read the whole brief before writing code.

## 0. How to work

- Reply first with a short plan and any blocking questions. Do not assume. If this brief is silent or contradictory on something that changes the build, ask.
- Build in the phases in section 12. Finish a phase, run its tests, commit, summarize what you did and what is unverified, then wait for review.
- Create `CLAUDE.md` at the repo root with: stack, commands, conventions, the design tokens, the unit rule (kg is canonical), and "never ship the Supabase service-role key to the client".
- Never invent domain data silently (strength standards, exercise facts). Mark anything unverified with `// UNVERIFIED` in code and list it in your phase summary.
- Anything with math is a small pure function with unit tests: estimated 1RM, rank calculation, progression recommendation, unit conversion.

## 1. Product

A personal gym tracker. One account holder, no social features. Four tabs, only one visible at a time, switched from a navbar:

1. **Dashboard**: progress graphs and a body map whose muscle groups are colored by estimated-1RM rank (Wood to Olympian).
2. **Session log**: the day's exercises pre-filled from the chosen routine and the last session, per-set weight/rep entry, a rest timer.
3. **Routine builder**: drag-and-drop weekly routines with sets, rep ranges, rest times, supersets, circuits, and an accessory bank.
4. **Exercise database**: searchable exercises with demo images, a short explanation, and targeted muscles.

Also: light, dark, and system theme, selectable by the user and remembered.

Primary device is a phone in the gym (session log). Everything must also work well on desktop.

Non-goals for v1: social features, AI coaching, nutrition, wearables, native apps, payments, custom exercise animations (planned later; keep the demo component swappable).

## 2. Stack

Decided:
- Vite + React + TypeScript, single-page app, hash routing (`#/dashboard`, `#/log`, `#/routines`, `#/library`) so it works on GitHub Pages without server rewrites.
- Styling: CSS custom properties (the tokens in section 10) + CSS Modules. No component kit (no MUI, shadcn, etc.); the look is custom.
- Drag and drop: `dnd-kit` (touch and keyboard support required).
- Motion: the `motion` package for springs; honor `prefers-reduced-motion`.
- Charts: `visx` or hand-rolled SVG. No chart library with a recognizable default look. Charts sit directly on the page background, not in cards.
- Data access: every read and write goes through a repository layer in `src/data/`; no component talks to Supabase directly. v1 implements it against Supabase only, so a local-first layer can be added later without rewriting the UI. The only local persistence in v1 is the in-progress session draft (section 6).
- Backend: Supabase (Auth, Postgres with RLS, Edge Functions, pg_cron, pg_net, Vault).
- PWA: `vite-plugin-pwa` in `injectManifest` mode (custom service worker for push).
- Tests: Vitest (unit), Playwright (smoke), plus SQL tests for RLS.
- Hosting: GitHub Pages via GitHub Actions. Static only: no custom response headers, so set CSP with a `<meta>` tag. Vite `base` = repo name.

Open to your proposal (justify in your plan): the web-push library for Deno, the server-state and caching approach, the icon set (custom SVG strokes preferred).

## 3. Architecture

- **Online-first (decided).** v1 requires a connection; Supabase is the source of truth. Offline-first is a planned later phase (section 12, phase 9), so keep the door open: all data access goes through the repository layer, every row has a client-generated UUID, and `updated_at` / `deleted_at` stay on every table. Show a clear, non-alarming "You're offline" state that says what is and isn't available. Do not build a sync engine now.
- **Auth:** Supabase Auth, email + password and magic link.
- **Static data:** vendor the exercise dataset (section 8) into the repo; do not store it in Postgres. Only custom exercises are user data.
- **Units:** canonical storage is kilograms, `numeric(8,4)`. The profile has a display unit (lb or kg). Convert at the edges only, round for display to 0.1. Never store pounds.
- **Time:** timestamps are UTC `timestamptz`. "Today's weekday" is computed on the device in local time. Week start is a setting, defaulting from the device locale.
- **Keep-alive:** Supabase free projects are paused after a week of low activity. Add a scheduled GitHub Actions workflow that calls a trivial RPC (`ping()`) every 3 days. The repo needs the Supabase URL and publishable key as Actions secrets; tell me exactly what to add.

## 4. Data model (Postgres, all tables RLS-protected)

Put `user_id uuid not null references auth.users on delete cascade` on **every** table (denormalized on purpose, to keep RLS policies trivial). Policy on every table: `user_id = (select auth.uid())` for select, insert, update, delete. Every table also has `id uuid pk`, `created_at`, `updated_at`, `deleted_at`. Index `(user_id, updated_at)` on each.

```
profiles            id = user_id, display_name, weight_unit ('lb'|'kg'), theme ('system'|'light'|'dark'),
                    standards_table ('male'|'female'), week_starts_on, default_rest_s, wake_lock_enabled, auto_start_rest
bodyweight_entries  measured_on date, weight_kg
custom_exercises    name, primary_muscles text[], secondary_muscles text[], equipment, force, mechanic,
                    level, instructions text[]
routines            name, is_active bool          -- partial unique index: one active routine per user
routine_days        routine_id, weekday smallint (0-6), label, sort
routine_blocks      routine_id, routine_day_id nullable (null = accessory bank), kind ('single'|'superset'|'circuit'),
                    sort, sets smallint (rounds), rest_s (after each round/set), transition_rest_s default 0,
                    weekdays smallint[] nullable, weekly_target smallint nullable   -- last two: bank blocks only
block_items         block_id, exercise_ref text ('ds:<dataset id>' | 'custom:<uuid>'), sort, rep_min, rep_max
sessions            routine_id nullable, routine_day_id nullable, started_at, ended_at, notes, bodyweight_kg nullable
session_sets        session_id, exercise_ref, block_id nullable, round_index, set_number, weight_kg, reps,
                    rpe nullable, is_warmup bool default false, completed_at
push_subscriptions  endpoint, p256dh, auth, user_agent
rest_timers         fire_at, label, sent_at, cancelled_at
```

Rules:
- A superset or circuit shares `sets` (rounds) across its items. Unequal set counts inside one block are not supported in v1.
- An accessory-bank block is a block with `routine_day_id = null`. If `weekdays` is set it appears automatically on those days ("daily" = all seven). If only `weekly_target` is set it appears as optional with a "1 of 2 this week" counter.
- Ranks are derived from `session_sets`, never stored.
- Write an RLS test that proves user A cannot read, insert, update, or delete user B's rows on every table.

## 5. Ranking system (dashboard body map)

**Tiers, lowest to highest:** Wood, Bronze, Silver, Gold, Platinum, Diamond, Master, Olympian.

**Estimated 1RM**
- Epley: `e1RM = weight * (1 + reps / 30)`; `reps == 1` means `e1RM = weight`.
- Ignore warm-up sets. Ignore sets over 12 reps for ranking (the estimate is unreliable there). Keep the formula behind one config switch.
- Bodyweight movements use a load model: `external` (barbell, dumbbell, machine, cable), `bodyweight_plus` (effective load = bodyweight + added weight), `assisted` (bodyweight - assistance). Dumbbell lifts are logged and ranked per hand.

**Standards**
- Each *ranking lift* has a table of bodyweight multiples for the 8 tiers, per `standards_table` (male/female). Put them all in one file, `src/ranking/standards.ts`, each with a `source` and `confidence` comment.
- I have not supplied verified numbers. Generate clearly flagged placeholders (`// UNVERIFIED`), make them editable in Settings, and show "Standards are approximate" in Settings. Do not scrape any proprietary site. I will review and replace them.
- Curate ranking lifts so every muscle group has at least one, including calves, forearms, neck, and abdominals. Propose the list in your phase 5 summary for my approval. Other exercises are still logged but do not rank.

**Muscle rank**
- Exercise score = tier index + fractional progress to the next tier.
- Muscle score = the best score among ranking lifts whose **primary** muscle is that muscle. Secondary muscles do not contribute in v1.
- Overall rank = median of the muscle scores. Muscles with no data render neutral (not Wood).
- Sanity check: flag implausible entries (for example an e1RM above 5x bodyweight on a lift) and ask the user to confirm instead of silently ranking them.

**Muscle vocabulary:** derive it from the dataset's `primaryMuscles` and `secondaryMuscles` values rather than hard-coding it. I expect about 17 groups (abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps). Confirm against the data. The dataset does not split shoulders into front, side, and rear delts; v1 uses one `shoulders` region.

**Moments:** detect an e1RM PR when a set is completed. Detect a rank-up when a muscle crosses a tier. The rank-up ceremony (section 10) is the single orchestrated animation in the app.

## 6. Session log

**Starting a session:** default to today's weekday in the active routine; allow another day or a quick (empty) session. The session persists if the app closes, and can be resumed. While a session is open, keep a draft of the sets entered so far in IndexedDB or localStorage, and write each completed set to Supabase immediately, retrying with backoff if the request fails. A dropped connection or a reload mid-workout must never lose entered sets. Show a small saving / saved / will-retry indicator. This is a safeguard, not offline support: starting a session and everything outside the Session tab still need a connection.

**Layout (phone first):** blocks in routine order. Each block is a group:
- `single`: exercise name, set rows.
- `superset` / `circuit`: one grouped card with rounds; items are listed in order inside it.
- Accessory-bank blocks scheduled for today appear in a collapsible "Accessories" group at the end. Flexible-frequency bank blocks appear as optional with their weekly counter.

**Set row:** `[weight] [reps] [done]`.
- Numeric inputs use `inputmode="decimal"` / `"numeric"`, with large touch targets (min 44 px).
- Each row shows the last session's value as a ghost placeholder.
- Completing a set records `completed_at`. Completing the last set marks the exercise done (derived state). Allow skipping an exercise, adding or removing sets, and adding a warm-up set (excluded from volume and ranks).
- In a superset or circuit, completing an item moves focus to the next item; the round ends after the last item.

**Recommendation (not an instruction):** under each exercise, a tappable chip such as "Try 185 x 8" that fills the inputs, with a one-line reason ("Hit 10, 10, 9 last time"). Rules (pure, unit-tested function `recommend(history, repRange, increment)`):
- All working sets hit `rep_max` at the last weight: suggest the next increment, aiming for `rep_min`.
- Otherwise keep the weight and aim for one more rep on the weakest set.
- Any set below `rep_min`: suggest the same weight and flag it (no automatic deload in v1).
- Increment defaults come from equipment (barbell, dumbbell, machine/cable) and are user-editable per exercise. No history: show no recommendation.

**Finishing:** summary of duration, total volume, PRs, rank changes. Past sessions are listed and editable.

## 7. Rest timer and background alarm

**Rest button:** a sticky button at the bottom of the Session Log labeled with the current block's rest time ("Rest 1:30"). Tapping it starts the countdown. The user taps it after a set; it is not automatic by default (setting `auto_start_rest` is optional). Rest comes from the current block (after the last item of a round for supersets and circuits, plus the optional `transition_rest_s` between items). Allow +15 s, -15 s, and skip.

**Accurate timing:** store `endsAt` as an absolute timestamp; never count intervals. Recompute on `visibilitychange` and on resume.

**Foreground alarm:** audio via Web Audio (unlocked by the first user tap), vibration where supported (Android; iOS has none), and a clear visual state. Keep the screen awake during an open session with the Screen Wake Lock API (user setting, on by default, handled gracefully where unsupported).

**Background alarm (phone locked or app closed): server-scheduled Web Push.**
1. The client creates a `push_subscription` once (after a user gesture and explicit permission prompt).
2. When a timer starts, insert a `rest_timers` row (`fire_at`). Only one active timer per user: starting a new one cancels the old one. If the insert fails (no connection), the timer still runs in the foreground and the alarm state reads "Background alarm off". Cancelling, skipping, or foreground completion sets `cancelled_at` immediately.
3. A `pg_cron` job runs every 5 seconds but only calls the Edge Function when work exists:
   `select net.http_post(...) where exists (select 1 from rest_timers where sent_at is null and cancelled_at is null and fire_at <= now() + interval '6 seconds')`. This keeps invocations proportional to usage. Store the project URL and key in Vault.
4. The Edge Function `send-rest-push` validates and sends due timers via Web Push (VAPID; private key only in Edge Function secrets), sets `sent_at`, uses a short TTL (about 60 s) and high urgency, and tags the notification with the timer id to dedupe. Verify your chosen push library actually runs on the Supabase Edge runtime before committing to it.
5. The service worker's `push` handler always shows a notification (iOS expects every push to display one, so do not suppress it when the app is visible; cancel server-side instead). Tapping the notification focuses or opens the app on the session.

**Honest limits to surface in the UI and README:**
- This is a notification, not a ringing alarm clock. It uses the OS notification sound, cannot loop, and follows Silent and Focus settings.
- On iPhone, push only works after the app is added to the Home Screen and opened from there; do not hide this. Build an install guide shown only on iOS Safari when not installed. Notification permission can only be requested from the installed app.
- Timing is best effort (cron granularity plus push delivery). Measure on a real iPhone and Android phone in phase 6 and report actual delays; do not claim a precision you did not measure.
- Show the alarm state on the timer: "Background alarm on" or "Background alarm off. Turn on notifications."

## 8. Exercise database

**Data:** vendor `dist/exercises.json` from the open dataset at `github.com/yuhonas/free-exercise-db` (Unlicense; about 870 exercises; per-exercise fields include name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images). Pin to a commit SHA. Serve images from jsDelivr pinned to that SHA (or vendor them if repo size stays reasonable) and cache them with the service worker. Credit the dataset in an About screen even though attribution is not required.

**Check before building:** verify that these exist and report any that don't: wrist curls and reverse wrist curls, neck flexion/extension, cable lateral raise, standing and seated calf raises, cable and weighted crunches, and anything I list in my seed routine. If an exercise is missing, the user adds it as a custom exercise.

**List:** search; filters for muscle, equipment, level, force, mechanic, category; results grouped sensibly; virtualized.

**Detail sheet:**
- Demo: the dataset has two still images per exercise (start and end position). Crossfade between them on a slow loop; with reduced motion, show them side by side. Build this as a `<ExerciseDemo exerciseRef />` component so it can be swapped for custom animations later.
- Explanation: the dataset supplies step-by-step instructions, not a prose summary. Show them as a numbered list (the order is real). Do not generate new instructional text.
- Targeted muscles: primary and secondary chips, plus a small body map with those regions highlighted.
- Actions: add to a routine, view history (best e1RM, PR list, small trend), edit if custom.
- Custom exercises: create, edit, delete (soft). No image upload in v1.

## 9. Dashboard

Order of content, top to bottom:
1. **Body map (the hero).** Front/back toggle. Each muscle region filled with its rank material (section 10). Tap a region: bottom sheet with muscle, rank, progress to next tier, best lift and e1RM, and a link to that lift's history. Overall rank shown beside it.
2. **This week:** sessions completed vs planned (a ring).
3. **Estimated 1RM trend:** per lift (picker), ranges 4 weeks / 12 weeks / 1 year / all.
4. **Weekly volume by muscle group:** sets per week, horizontal bars.
5. **Session frequency:** a 12-week grid.
6. **Bodyweight over time:** with quick add.
7. **Recent PRs.**

Empty states say what to do next ("Log your first session to start ranking"), never guilt or streak-shame.

The body map is **original artwork**: a stylized, simplified figure with one SVG path group per muscle region from the dataset vocabulary. Do not copy any other app's art. Hit targets must be generous on a phone; provide a list view alternative for accessibility.

## 9a. Routine builder (tab 3)

**Routines:** create, rename, duplicate, archive, delete (soft). Many routines can exist; exactly one is active (enforced in the database). Switching the active routine never changes history.

**Layout:**
- Desktop: a seven-column weekly board plus an "Accessory bank" lane, with the exercise picker docked below or beside it.
- Phone: a day pager (Mon to Sun, plus "Bank") with the picker as a bottom sheet.

**Building:**
- Drag an exercise from the picker onto a day or the bank; reorder within a day; move between days. Use dnd-kit with touch long-press and keyboard sensors.
- Drag-and-drop is never the only way: every exercise card and picker row also has an "Add to..." menu and "Move to..." menu.
- Each block card shows kind, exercise names, sets, rep range (min to max), and rest (mm:ss). All are editable inline with steppers.
- **Superset creator:** drag one exercise card onto another, or select two blocks and choose "Link as superset". Adding a third makes it a circuit. "Unlink" reverts to singles. Inside a block, sets and round rest are shared; each item has its own rep range; `transition_rest_s` defaults to 0.
- When both items of a superset have `force` of push and pull in the dataset, show a quiet "push/pull pair" label. If both target the same primary muscle, show a neutral note, not a block.
- **Accessory bank:** blocks here pick a schedule: daily, N times per week, or specific days. They show up in the Session Log per section 6.
- Live side panel: weekly sets per muscle for the routine being edited.
- Import and export a routine as JSON. Provide a seed importer so I can load my current split from a JSON file.

## 10. Design system

### Concept
Apple-quiet chrome, game-like rewards. The interface itself is calm, neutral, and spacious (clarity, deference, depth). Reward and identity live in exactly one place: **the rank materials**. Each tier is a physical material (wood, bronze, silver, gold, platinum, diamond, violet glass, crimson-and-gold foil) rendered on the body map and the rank badges. Everything else stays quiet so the ranks are what people remember.

### Color tokens
Define as CSS custom properties on `:root`, redefine under `prefers-color-scheme: dark` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Give `body` an explicit background.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ground` | `#F5F5F7` | `#000000` | page background |
| `--surface` | `#FFFFFF` | `#1C1C1E` | grouped lists, sheets |
| `--ink` | `#1D1D1F` | `#F5F5F7` | primary text |
| `--ink-muted` | `#6E6E73` | `#98989D` | secondary text |
| `--accent` | `#0A5CFF` | `#4C8DFF` | primary action, focus ring, timer |
| `--done` | `#34C759` | `#30D158` | completed sets only |

Rank materials (`--rank-wood` through `--rank-olympian`): Wood `#80603F`, Bronze `#CD7A35`, Silver `#BDBFC2`, Gold `#C8920E`, Platinum `#2F8F91`, Diamond `#7FD3FF`, Master `#8B4FD8`, Olympian `#F2C96B` as banded foil (changed in design fix D2: the old red Olympian read as injury, and Silver, Platinum and Diamond looked alike).
- Wood: faint vertical grain (static SVG turbulence). Bronze, Silver, Gold, Platinum: linear metallic gradient with one specular band (static). Diamond: faceted conic gradient. Master: violet with a soft inner glow. Olympian: crimson with a gold foil edge.
- Every filled region gets a 1.5 px edge stroke so pale tiers (Diamond, Silver) stay visible on both grounds.
- Rank is never conveyed by color alone: tapping shows the tier name, and a "Rank patterns" setting overlays a distinct subtle hatch per tier.
- Verify AA contrast for text and for the `--accent` and `--done` on both grounds. All hex values above are proposals; adjust if contrast fails and tell me what you changed.

### Typography
- UI text: the system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif`). On Apple devices that is San Francisco.
- Display (large titles, rank names, big numerals): **Bricolage Grotesque** variable, weights 600 to 800, self-hosted (no Google Fonts request; CSP allows self only).
- Scale follows Apple's text styles: Large Title 34/41, Title 1 28/34, Title 2 22/28, Title 3 20/25, Headline 17/22 semibold, Body 17/22, Callout 16/21, Subhead 15/20, Footnote 13/18, Caption 12/16.
- Numbers in set rows, timers, and charts use tabular figures (`font-variant-numeric: tabular-nums`) in the system face.
- Sentence case everywhere. No tracked all-caps labels, no monospace "data label" styling, no spaced-em-dash labels, no arrow glyphs on buttons.

### Shape, depth, material
- Radii by role, not one value: sheets 28, grouped lists 20, controls 12, chips fully round.
- Lists use grouped inset rows (iOS Settings style), not grids of identical cards.
- Depth comes from tone in dark mode and a hairline in light. Shadows only on sheets.
- Translucent blur material only on the tab bar and bottom sheets. Nowhere else.

### Layout
- Phone: bottom tab bar (translucent), four tabs: **Dashboard**, **Session**, **Routines**, **Exercises**. Large title at the top of each tab, theme toggle and profile in the header. Theme control: System / Light / Dark.
- Desktop (>= 1024 px): left rail with the same four tabs; content max-width about 1100 px, left-aligned.
- Only one tab's content is mounted and visible at a time.
- Left-align text. Line length under 80 characters.

```
DASHBOARD (phone)                 SESSION (phone)
+------------------------+        +------------------------+
| Dashboard      (T) (P) |        | Upper 1         0:42:10|
|  [ Front | Back ]      |        | Superset  3 rounds     |
|        .--.            |        |  Incline DB Press      |
|       /    \  body map |        |   last 70 x 10,10,9    |
|      |      | (ranks)  |        |   [ Try 70 x 10 ]      |
|       \    /           |        |   1 [ 70 ][ 10 ][ ok ] |
|  Overall  Gold  62%    |        |   2 [ 70 ][  8 ][    ] |
|  This week  3 of 5     |        |  Chest-Supported Row   |
|  e1RM trend  [Bench v] |        |   ...                  |
|  Weekly volume ......  |        |  Accessories (v)       |
|  Sessions, 12 weeks    |        |                        |
|  Bodyweight            |        |      [ Rest 1:30 ]     |
+------------------------+        +------------------------+
| Dash | Session | Rout | Ex |    | Dash | Session | Rout | Ex |
+------------------------+        +------------------------+

ROUTINES (desktop)
+------------------------------------------------------------------+
| Routine [Upper/Lower v] Active   [New] [Duplicate] [Import/Export]|
| Mon     | Tue  | Wed | Thu | Fri | Sat | Sun | Accessory bank      |
| [SS A ] | rest |     |     |     |     |     | [Calves  daily  ]   |
| [Single]|      |     |     |     |     |     | [Wrists  daily  ]   |
|------------------------------------------------------------------|
| Picker: search | muscle | equipment            (drag, or Add to...) |
+------------------------------------------------------------------+

EXERCISES
+------------------------+
| Search ______  Filters |
| Row: name, muscle, eq. |
| Detail sheet: demo     |
|  (2-image crossfade),  |
|  muscles + mini map,   |
|  numbered steps,       |
|  [Add to routine]      |
+------------------------+
```

### Motion
- No decorative or entrance animation. Motion answers actions: sheets spring open, a completed set settles, the timer ring drains.
- **The one orchestrated moment:** the rank-up ceremony. When a muscle crosses a tier, its region on the body map transitions to the new material and a single sheen passes once. Olympian gets a longer sheen and the foil edge. Skippable, never repeated, and static under reduced motion.
- PR: a small, quiet badge on the set row. No confetti.

### Voice
- Plain verbs, sentence case, active voice. Buttons say what happens: "Start session", "Save routine". The same action keeps the same name everywhere (the button says "Save routine"; the confirmation says "Routine saved").
- Errors explain what went wrong and how to fix it, with no apology. Empty states point to the next action.
- No streak guilt, no "you missed a day" messaging.

## 11. Quality floor and security

- Responsive from 360 px wide up. Visible keyboard focus. Reduced motion respected. Touch targets at least 44 px. Inputs have real labels. Drag-and-drop has keyboard and menu alternatives. No layout shift when data loads.
- RLS on every table, enabled and tested. The client uses only the publishable key. The service-role key exists only inside the Edge Function runtime. VAPID private key lives in Edge Function secrets.
- The Edge Function verifies ownership of the timers it sends. Cap active `rest_timers` per user. Push payloads contain no sensitive data.
- CSP via `<meta>`: self, the Supabase project origin, and the image CDN only.
- Account deletion that cascades all user rows and unregisters push subscriptions. Data export as JSON and CSV (sessions and sets).
- Tests: unit tests for e1RM, rank scoring, recommendation, unit conversion; Playwright smoke for each tab on a phone viewport and a desktop viewport; the RLS test from section 4.

## 12. Phases (stop and report after each)

1. **Scaffold and shell.** Vite/React/TS, tokens, light/dark/system theme, the four-tab shell (bottom bar and desktop rail), hash routing, GitHub Pages deploy workflow, `CLAUDE.md`.
2. **Data and auth.** Supabase schema, migrations, RLS plus RLS tests, Auth, the repository layer, keep-alive workflow, profile and settings.
3. **Exercise database.** Dataset vendoring, list, filters, detail sheet, staple-exercise check, custom exercises.
4. **Routine builder.** Boards, drag and drop with fallbacks, supersets, circuits, accessory bank, multiple routines with one active, JSON import and export.
5. **Session log.** Pre-fill, set entry, recommendation engine, resume, finish summary, past sessions, foreground rest timer and wake lock.
6. **Ranking and dashboard.** e1RM, standards (flagged), body map artwork, rank materials, charts, rank-up and PR moments.
7. **Background alarm and PWA.** Service worker, subscription flow, `rest_timers`, pg_cron, Edge Function, iOS install guide, real-device timing measurements.
8. **Polish.** Accessibility pass, performance pass, empty and error states, README with setup (Supabase project, secrets, VAPID keys, Pages), About and dataset credit.
9. **Offline-first (later, not part of v1).** Dexie, a sync engine with per-row last-write-wins, merge on first sign-in, offline session start. Plan it once phases 1 to 8 are stable.

Each phase ends with: what was built, what was tested, what is unverified, and decisions you need from me.

## 13. Decisions

Decided: the background alarm is a push notification (accepted for v1); the app is online-first with offline support later; ranking standards start as flagged placeholders that I will refine.

Still owed by me (ask me, do not assume):

- Final app name (the title here is a placeholder).
- Approved list of ranking lifts and the source for the standards tables.
- Default weight unit and week start.
- Seed routine JSON for the importer.
