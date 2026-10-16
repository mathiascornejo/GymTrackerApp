# Design fixes

Fix list from the October 2026 design review: every screen at 390 px (phone) and 1024 px (desktop), light and dark, plus a live session. Work through it **one task per session**, in order. Each task is self-contained.

## Rules for whoever picks up a task

1. Read `CLAUDE.md` and the relevant part of `docs/build-brief.md` first. They override anything here.
2. One task, one commit (`fix(design): <task id> <summary>`). Don't fold in other tasks.
3. Run `npm run typecheck` and `npm test` before committing. If the task adds math (averages, targets, load models), add a pure function with a unit test, per CLAUDE.md.
4. Check the change in the browser preview (`dev` in `.claude/launch.json`) at **390×700 and 1024×768, light and dark**. The tab bar and profile button float, so scroll to the bottom and middle of each screen, not just the top.
5. New colors go in `src/styles/tokens.css` for both themes (the guarded dark block plus `:root[data-theme="dark"]`) and must hit WCAG AA. Never hard-code `#fff` on accent or done backgrounds.
6. If a task touches a screen or sheet, `tests/a11y.spec.ts` must still pass. It needs `npx supabase start`, which needs Docker. If Docker isn't running, say so in the summary instead of skipping silently.
7. When done, tick the box here in the same commit.

## Model and effort guide

Use **Opus 5.5** for every task. Three tasks (D2, D4, D11) need real design judgment, which is where Opus beats Sonnet, and using one model keeps the style consistent across the series. Set the effort per task:

| Effort | Tasks | Use |
|---|---|---|
| **low** | D8, D10, D12, D13, D20, D21, D22 | Copy, a CSS value, one-file style fixes; the spec says exactly what to change |
| **medium** | D3, D5, D6, D7, D9, D14–D19, D23, D24 | One component plus its CSS, or a small pure function with a test |
| **high** | D1, D2, D4, D11 | Layout across every screen, a screen restructure, or a palette that must work as a system (contrast, SVG materials, both themes) |

If a task gets stuck or the result looks generic, rerun it one level higher.

---

## Priority 1: mis-taps and the hero visual

### [ ] D1. The floating profile button covers controls
**Effort:** high

**Problem:** `ProfileDock` (`src/app/GradientNav.tsx`, rendered in `src/app/Shell.tsx`) floats top-right and stays put while you scroll.
- Phone: it covers the done ✓ on whichever set row scrolls under it, and the counts in "Weekly sets by muscle".
- About 530 px wide: it sits on top of "Finish session".
- It also crowds every page title.

**Do:** Put the profile button in the page header row (`.header` in `src/app/Shell.module.css`), right-aligned and scrolling with the page, so it can never sit on content. Keep the title centered (the comment at `Shell.module.css:17` explains the current balancing). Keep it ≥44 px, keyboard focusable, with the same accessible name.

**Done when:** at 390 and 530 px, scrolling Dashboard, Routines and a live session never puts the button over a control or text.

### [ ] D2. Tier colors: red Olympian, and Silver, Platinum and Diamond look the same
**Effort:** high

**Problem:**
- Silver `#AEB4BE`, Platinum `#8FC9CF` and Diamond `#BDEBFF` are all pale cool greys, so three of eight tiers can't be told apart on the body map.
- Olympian is red (`#D7263D`). On a body diagram, red reads as pain or injury, so your strongest muscle looks hurt.
- The overall tier name ("Platinum") is plain ink and doesn't use its color.
- There's no legend.

**Where:** `src/styles/tokens.css` (`--rank-*`), the hard-coded material defs in `src/app/BodyMap.tsx` (lines ~8–51, gradient triples plus the diamond and olympian patterns), and the Design tokens section of `CLAUDE.md`.

**Do:**
1. Redesign the eight tier colors so neighboring tiers differ clearly in hue **and** lightness, in both themes. Keep Wood and Bronze warm. Separate Silver (neutral grey), Platinum (deeper teal) and Diamond (bright icy blue).
2. Take Olympian off red: make it the foil gold `#F2C96B` with the existing sheen, and adjust Gold so the two still read as different.
3. Update every material triple in `BodyMap.tsx` to match, and update `CLAUDE.md`.
4. Add a small tier legend under the maps: a dot plus name for each tier, sentence case, no all-caps.
5. Show the overall tier name in its tier color, but only where it passes AA against `--surface` in that theme. Otherwise use ink and a colored dot.

**Done when:** a screenshot of the map with every tier present (temporarily fake the data locally, never commit fake data) has eight clearly different colors in light and dark, and no tier is red.

### [x] D3. Superset rows wrap into five-line labels
**Effort:** medium

**Problem:** In `src/app/SessionLog.tsx:378`, superset rows are labeled `${nameOf(it.ref)} round ${r + 1}` in a column about 120 px wide. "Cable Standing Overhead Triceps Extension round 1" wraps to five lines, under an `<h4>` that already says "Round 1".

**Do:**
- Visible label: just the exercise name, on its own line above that row's inputs (full row width), or truncated to one line with ellipsis.
- Accessible label: keep the full "<name> round N" in the visually hidden spans and on the done button, so screen readers lose nothing.
- Single-exercise blocks keep the current "Set 1" layout.

**Done when:** at 390 px, every superset row in the Friday Push day is no more than two lines tall.

### [ ] D4. Make the live session a focused mode
**Effort:** high

**Problem:** At 390×700 the live session loses about 190 px (27%) to stacked floating layers: the alarm notice, the idle "Rest 3:00" button and the tab bar. "Finish session" is a filled accent button top-right from the first second, so it's the loudest thing on screen for an hour. The page also has two titles ("Session" above "Push").

**Where:** `src/app/SessionLog.tsx` (header ~410–418, footer ~440), `src/app/RestBar.tsx`, `src/app/Shell.tsx` (page title, tab bar), `src/app/Session.module.css`.

**Do:**
1. While a session is open, hide the shell's page title; "Push · 0:22 · Saved" is the title.
2. While a session is open, collapse the tab bar on phone. Keep a way back to the other tabs (e.g. a small "Exit" or chevron in the session header). The session stays open as it does now.
3. "Finish session" starts as a quiet button. It becomes the filled primary only when every planned, non-skipped set is done, or put it as a full-width button at the end of the list.
4. Idle rest bar: a slim pill ("Rest 3:00", quiet style), not a filled 52 px button. Keep the running state as it is (ring, countdown, −15 / +15 / Skip); that part is good.
5. The "Background alarm off…" notice: show it once per session with a dismiss control, or move it into the running rest bar as a small icon with a tooltip-free text alternative.
6. Keep the rest-timer rules in CLAUDE.md (absolute `endsAt`, audio unlock on the start tap).

**Done when:** at 390×700 with the timer idle, at least 560 px of the viewport shows set rows, and the e2e session tests still pass.

---

## Priority 2: wrong numbers and structure

### [ ] D5. The e1RM chart and the muscle sheet disagree for bodyweight lifts
**Effort:** medium

**Problem:** For a Chest Dip, the Dashboard chart says 1333.3 kg and the Chest sheet says 1421.3 kg. Cause: `src/app/Dashboard.tsx:104` takes the load model only from `RANKING_LIFTS` and falls back to `"external"`, while `computeRanks` uses `derivedLift` for exercises without a standard, which here is `bodyweight_plus`. So the chart leaves out bodyweight and the rank includes it.

**Do:** Add one pure function, e.g. `loadModelFor(ref, info)` in `src/ranking/`, that both `computeRanks` and the Dashboard use. Unit-test it: a ranking lift, a derived bodyweight exercise, and an external exercise. Label the chart "Estimated 1RM (incl. bodyweight)" when the load model isn't external.

**Done when:** the chart value and the muscle sheet value match for a bodyweight exercise.

### [ ] D6. Routines puts admin controls before the plan
**Effort:** medium

**Problem:** The top of Routines is routine select, "New routine", then Duplicate / Delete routine / Export JSON / Import JSON, all in the same quiet-link style. "Delete routine" looks identical to "Export JSON". The actual plan starts below the fold on phone.

**Where:** `src/app/Routines.tsx` ~300–330, `src/app/Routines.module.css`.

**Do:** Keep the routine select and "New routine" on one row. Move Duplicate, Export JSON, Import JSON and Delete routine into a "More" menu button next to the routine name in the overview card. Put Delete last, with the destructive style from D10. The menu must be keyboard operable with correct ARIA (`aria-haspopup`, `aria-expanded`, focus return).

**Done when:** at 390 px, the day chips are visible without scrolling.

### [ ] D7. The desktop routine picker is always open
**Effort:** medium

**Problem:** On desktop (`desktop` branch at `Routines.tsx:406`), `RoutinePicker` renders inline under the day, permanently, with up to 40 filled accent "Add" buttons. Its copy says "Close this and pick another day", but there's no close control. The phone branch already uses a `Sheet` behind an "Add exercise" button.

**Do:** Use the phone pattern on desktop too: an "Add exercise" button opens the picker (a sheet, or a side panel at ≥1024 px). Inside the picker, change the per-row "Add" to a quiet style so the accent stays rare. Fix or remove the "Close this…" copy.

**Done when:** at 1024 px there's no picker on Routines until "Add exercise" is pressed, and the picker has a visible close.

### [x] D8. The phone "Add exercise" button covers content
**Effort:** low

**Problem:** `.addFab` (`Routines.module.css:513`) overlaps the "Most work: …" line and the last rows of "Weekly sets per muscle".

**Do:** Add bottom padding to the Routines page equal to the FAB's height plus gap plus tab bar, so nothing can scroll permanently under it.

**Done when:** at 390 px, every line on Routines can be scrolled fully clear of the FAB.

### [ ] D9. The theme toggle looks like a sixth tab
**Effort:** medium

**Problem:** `GradientNav` includes a theme cycle button (monitor icon) in the tab bar. It reads as a "Desktop" tab.

**Do:** Remove it from `GradientNav` and add a "Theme" row (System / Light / Dark select) to the Training group in `src/app/Settings.tsx`. Follow the Settings rules in CLAUDE.md: patch the cache synchronously, don't refetch, mirror the value with `useMirror`. Keep `useTheme` as is.

**Done when:** the tab bar has exactly five items and theme changes from Settings persist across a reload.

### [x] D10. Destructive actions look like everything else
**Effort:** low

**Problem:** There's no danger color.
- `ConfirmSheet` (`src/app/ConfirmSheet.tsx:21`) always uses the accent button, even for "Discard session" and "Delete routine".
- "Discard session" sits next to "Add exercise" with the same quiet styling (`SessionLog.tsx:440–442`).

**Do:**
- Add a `--danger` token (both themes, AA on `--surface`, plus `--on-danger` for text).
- Add a `destructive` prop to `ConfirmSheet` and pass it from discard session, delete routine, delete account, and any other delete confirm.
- In the session footer, separate Discard from Add exercise (opposite ends, or Discard in the header's More menu) and give it danger text.

**Done when:** every delete or discard confirmation has a danger-colored confirm button, and axe passes.

### [ ] D11. Desktop wastes space
**Effort:** high

**Problem:**
- At 1024 px, the Session start panel is a small form floating in an empty page.
- A live session is a single 560 px column.
- On the Dashboard grid, "Weekly sets by muscle" is short and leaves a hole beside the taller heatmap.

**Do:**
- Session start: show today's plan preview beside the start controls (see D16).
- Live session at ≥1024 px: two columns, with set logging on the left and a side panel on the right (rest timer, recommendations, last session for the current exercise).
- Dashboard: lay out the cards so no column ends more than about 80 px short of its neighbor (reorder, span, or stack the two short cards together).
- The phone layout must not change.

**Done when:** screenshots at 1024 and 1280 px show no large empty regions, and 390 px looks the same as before.

### [x] D12. Content columns don't line up
**Effort:** low

**Problem:** The Library list (`src/app/Library.module.css`) and the Routines day board (`.board` in `Routines.module.css`) are inset about 46 px from the search bar and cards above them, so each screen has two left edges.

**Do:** Give each screen one content width and one left edge.

**Done when:** at 1024 px the search field, group headers and list rows share a left edge, and so do the Routines overview card and day board.

---

## Priority 3: polish

### [x] D13. Chart text is too small
**Effort:** low

Axis and value labels in `src/app/charts.tsx` render around 9–10 px ("1333.3 kg", "Oct 12"), and the map's "Front" and "Back" captions are similar. Set a 12 px minimum for chart and map text and check the labels don't collide at 390 px. With a single data point, center it and show its value next to the dot, rather than an empty axis with a lone label.

### [ ] D14. Weekly sets bars have no target
**Effort:** medium

The Dashboard's "Weekly sets by muscle" scales bars to the week's maximum, so with two muscles both bars are full. Draw each bar against a fixed target band instead (e.g. 10–20 sets per muscle per week, a constant marked `// UNVERIFIED`), with the band shaded on the track. Put the scaling in a pure function with a test.

### [ ] D15. The session heatmap has no axes
**Effort:** medium

"Sessions, last 12 weeks" is 84 unlabeled squares. Add weekday initials for alternating rows (honoring `week_starts_on`) and month labels above the columns where a month starts. Give the grid an accessible summary (e.g. "3 sessions in the last 12 weeks").

### [ ] D16. Session start doesn't show the plan
**Effort:** medium

`StartPanel` (`src/app/Session.tsx`) only offers a Day select. Under it, list the chosen day's exercises (name plus "3 × 8–12"), read from the routine already loaded. Changing the day updates the list.

Also fix a copy bug: a day labeled "Rest Day" renders as "Sunday · Rest Day · rest day" (`Session.tsx:46`). Skip the " · rest day" suffix when the label already says rest, case-insensitive.

### [ ] D17. Past sessions are hard to read and edit
**Effort:** medium

`src/app/PastSessions.tsx`: expanded sessions show unlabeled inputs (1000 / 10) next to a text "Delete" on every row. Add a column header row ("kg" / "reps", in the user's unit), and replace the per-row Delete link with an icon button (accessible name "Delete set N") that confirms through `ConfirmSheet` with the D10 destructive style. Format the volume summary with the unit and grouping that `fromKg` already gives.

### [ ] D18. Weight screen
**Effort:** medium

`src/app/Weight.tsx:46`: the input's placeholder is the last logged value ("66 kg"), so it looks pre-filled. Change it to "Today's weight". When there are 3 or more entries, draw a 7-day moving average line on the trend chart; make the average a pure function with a test in `src/ranking/stats.ts` or a new `src/weight/` module. Replace the per-row "Delete" link with the same icon-button pattern as D17.

### [ ] D19. Library rows have no thumbnails
**Effort:** medium

`src/app/Library.tsx` is already virtualized; keep it that way. Add a 40 px rounded thumbnail (first image, `loading="lazy"`, empty `alt` because the name is next to it) to each row, and update the virtualizer's row-size estimate. Exercises without media get a neutral placeholder tile. Use the same row in `RoutinePicker` if it shares the component.

### [x] D20. Exercise sheet details
**Effort:** low

`src/app/ExerciseSheet.tsx` / `ExerciseDemo.tsx`:
1. The dataset images have white backgrounds and sit in a dark frame. Wrap them in a deliberate light plate (`#F5F5F7`, radius 20, 12 px padding) in both themes.
2. The selected primary-muscle chip is white; selected chips elsewhere use the accent. Match them.
3. The sheet opens with a circular reveal, but the brief says the only animation is the rank-up sheen. Replace it with the standard sheet transition used by `Sheet.tsx`, and make sure reduced motion gets no animation.

### [x] D21. Copy and typography sweep
**Effort:** low

Fix these across `src/app/`:
- Rep ranges use an en dash: `8–12`, not `8-12` (Routines block cards, session block meta).
- Multipliers use ×: `21.5× bodyweight`, not `21.54x` (`Dashboard.tsx:200` and `:304`). Round to one decimal.
- The "Chest Dip" link in the muscle detail sheet uses the browser's default purple. Style links with `--accent` everywhere (add a base `a` rule in the global CSS if none exists).
- "It is right" (`Dashboard.tsx:203`) becomes "Yes, it's right".
- Routines mixes a pencil icon (rename, day label) with the text "Edit" (block cards). Use one: the pencil icon button with an accessible name "Edit <exercise>".
- "Optional this week (1)" and "More" are `<details>` with no visible chevron. Add one that rotates when open.

### [x] D22. Settings toggles
**Effort:** low

`src/app/Settings.tsx:29` renders square checkboxes. Restyle them as switches: keep the native `<input type="checkbox">`, add `role="switch"`, and give a ≥44 px hit area, with accent when on and `--on-accent` for the knob.

### [ ] D23. Sign-in screen
**Effort:** medium

`src/app/SignIn.tsx`:
1. Add a show/hide password toggle inside the password field (icon button with an accessible name that reflects its state).
2. Add "Forgot password?" using Supabase `resetPasswordForEmail`, through a new function in `src/data/auth.ts`, never from the component. It also needs a handler for the recovery redirect that lets the user set a new password. With hash routing, check that the redirect URL works on GitHub Pages and in the local stack.
3. The "Create account" / "Use password" links under the card are indented relative to the card's edge. Align them with it.

### [ ] D24. Optional: last-time hint in set rows
**Effort:** medium

Ghost placeholders disappear as soon as you type. Under each set label in `SessionLog.tsx`, show a small muted "Last: 60 × 10" from the same ghost data. Hide it once the set is done. Check the row still fits on one line at 390 px.

---

## Checked and left alone
- **Forearms 36 sets per week on Routines** is correct: the bank has two wrist-curl exercises at 3 sets × 6 days a week. The volume count uses primary muscles only.
- **The Library renders 722 rows**: it's already virtualized (`useVirtualizer`); the long page height is the virtual total.
- **Implausible sets**: the 1000 kg × 10 Pull-Up and Chest Dip sets were confirmed with "It is right", so the over-5× guard worked. Delete that test session (Oct 12) from Past sessions to get realistic ranks back.

## Not reviewed
- The post-workout summary (`SessionSummary.tsx`). It needs a finished session with logged sets.
- The running states of the background alarm. Notifications were blocked in the review browser.
