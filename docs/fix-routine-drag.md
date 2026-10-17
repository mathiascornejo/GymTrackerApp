# Fix the routine builder's drag and drop

Instructions for fixing the problems found in a hands-on review of building routines by dragging (rated 5/10). Read `CLAUDE.md` and `docs/build-brief.md` section 9a before starting. Work in the phases below: one commit per phase, then stop for review (per `CLAUDE.md`). Phase 5 is a large layout change: ask before starting it.

## Files involved

- `src/app/Routines.tsx`: `DndContext`, the `collide` collision function, `onDragStart`/`onDragEnd`, the day pager (`DayButton`), the drag overlay, the picker sheet and the add button.
- `src/app/BlockCard.tsx`: one card. It has the sortable grip, `ItemGrip` (drag one exercise out of a superset) and the "Drop to superset" strip (`join:` droppable).
- `src/app/RoutinePicker.tsx`: picker rows (`useDraggable` with id `pick:<ref>`) and the one-tap Add button.
- `src/app/Routines.module.css`: all styles above (`.join`, `.overlay`, `.pager`, `.addFab`, `.itemGrip`, ...).
- `src/routines/model.ts`: pure routine operations (`moveBlock`, `link`, `unlink`, `extractItem`, `addBlock`, `locate`). Tested in `model.test.ts`.
- `src/app/ExpandableScreen.tsx`: the `<dialog>` behind every `Sheet`.
- `tests/smoke.spec.ts` (`routine builder` block) and `tests/a11y.spec.ts`.

## Rules that apply throughout

- Edit routines only through `actions.update(id, fn)` with model functions (the existing `edit()` helper). Never mutate a rendered copy.
- Any new math (for example, deciding the drop intent from pointer position) is a small pure function with a Vitest unit test.
- Sentence case and plain verbs. No all-caps labels, no arrow glyphs on buttons. Use `--on-accent` for text on accent fills, never `#fff`.
- Touch targets at least 44 px. Every new menu or sheet gets an axe scan in `tests/a11y.spec.ts` (light and dark).
- Keep keyboard dragging working (the existing e2e test waits ~400 ms after pick-up before Arrow keys).

## How to verify drags by hand

Start Docker, `npx supabase start`, then run the dev server pointed at the local stack (Vite lets process env override `.env.local`):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from `npx supabase status`> npm run dev -- --port 5174
```

Sign up a throwaway account through `/auth/v1/signup` on the local stack, as `newUser()` in `tests/smoke.spec.ts` does. To inspect a drag mid-flight, dispatch `mousedown` on a grip, then several `mousemove` events on `document` (MouseSensor needs 6 px of movement), take a screenshot, then `mouseup`. Check at 390x844 and 1280x800, in light and dark.

---

## Phase 1: Drags do what the user meant

### 1.1 Reordering must not create supersets by accident

**Problem:** once a drag starts, every card shows a 44 px "Drop to superset" strip over its lower half (`.join` in the CSS, rendered at the bottom of `BlockCard`). `collide` prefers `join:` over cards, so only the top ~30 px of a card means "reorder". Dragging Air Bike to put it between two cards made it a superset with the card below. The strips also hide exercise names, and on an open card they cover Unlink and Remove.

**Fix:** remove the always-visible strip. Reordering is the default; making a superset needs a deliberate hold.

- Delete the `join:` droppable and the `.join` / `.joinOver` styles from `BlockCard`. Remove the `dragging` prop if nothing else uses it.
- In `collide`, with a pointer: a hit on a card returns the card (sortable reorder). Pager chips still win over cards.
- Add a pure function, for example `dropIntent(pointerY, rect): "before" | "after" | "center"`. The center is the middle 40% of the card's height. Unit-test it.
- Track the drag in `onDragOver` / `onDragMove`. The pointer is `activatorEvent` coordinates plus `delta`. While the pointer stays in the center band of the same card (not the dragged one) for 600 ms, set state `joinArmed = blockId`. Leaving the band or the card clears it.
- While armed, that card shows an accent ring and an in-card label "Release to make a superset". Do not use a strip that covers content.
- In `onDragEnd`: if `joinArmed` equals the card under the pointer, call `link` (block drag) or `addItem` (picker drag). Otherwise reorder or insert as today.
- Keyboard drags only reorder (as now). Keyboard users make supersets with the menu from 3.2.
- Pulling one exercise out of a superset (`type: "item"`) never arms a join.

**Done when:** dropping anywhere on a card without holding still reorders. A deliberate hold over the middle of a card makes a superset. No exercise name or button is hidden during a drag. Add e2e tests for both.

### 1.2 Dropping on a day chip must hit the chip you aimed at

**Problem:** the day pager scrolls with the page. Dragging a card up toward it triggers dnd-kit auto-scroll, the chips move under the pointer, and the card lands on the wrong day. In testing, aimed at Monday and landed on Wednesday.

**Fix:**
- Make `.pager` `position: sticky` so it stays put while the page scrolls. Give it a surface background so cards don't show through. On phone, stick it at the top under the safe area. On desktop, it must clear the floating nav. Check the offset `.sidePicker` uses (`top: calc(16px + var(--nav-h) + 16px)`) and confirm visually that no chip sits under the nav. Today Mon–Thu hide under it when scrolled.
- Hovering a chip for 500 ms during a drag switches `pageDay` to that day, so the user sees the target and can drop at a precise position. Dropping on the chip itself still appends to that day.
- Once the card is moved to another day, show the undo toast from 1.5 with "Moved to Monday".

**Done when:** an e2e test scrolls the page, drags a card onto the Monday chip, and the card is on Monday.

### 1.3 Releasing outside any target cancels

**Problem:** `collide` falls back to `closestCenter` when the pointer hits nothing. Releasing over the "Weekly sets" panel still moved things; in testing it pulled an exercise out of its superset.

**Fix:** with a pointer and no hits, return `[]`. Keep the `closestCenter` path only for keyboard drags (no `pointerCoordinates`). `onDragEnd` already returns when `over` is null.

**Done when:** releasing over empty space or the stats panel leaves the routine unchanged (e2e test).

### 1.4 No blind drags from the phone picker sheet

**Problem:** on phone the picker is a modal sheet. Its rows can still be dragged, but the drag label is hidden behind the dialog's top layer and the target day is blurred. The drop happens without the user seeing it.

**Fix:** pass `draggable={desktop}` to `RoutinePicker`, use `useDraggable({ disabled: !draggable })` in `PickRow`, and use the grab cursor only when draggable. On phone, adding happens through Add and "Add to…" (3.1).

### 1.5 Undo for routine changes made by dragging

There is no undo today. Add a small toast pinned above the tab bar, using translucent blur only if it is styled as a sheet, plus `role="status"`. It reads "Made a superset", "Moved to Monday" or "Added to Saturday", with an Undo button. It lasts about 6 seconds.

Implementation: before the edit, capture the routine from the query cache. Undo calls `actions.update(id, () => snapshot)`, but only if no other edit happened since; otherwise hide Undo. Keep it to one level and one toast at a time.

---

## Phase 2: Drag feedback and visuals

### 2.1 Fix the overlay for an exercise pulled out of a superset

**Problem:** `DragOverlay` sizes its wrapper to the active node. For `ItemGrip` that is 32x32, so the label wraps one word per line and spills out of the pill.

**Fix:** `.overlay { width: max-content; max-width: min(320px, 80vw); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`.

### 2.2 Make the overlay look like the card being moved

Today the dragged item is a small accent pill at the card's top-left corner. Render a compact card instead:
- Grip, name(s), and the "3 sets · rest 1:30" line.
- Surface background, a lift shadow and `scale(1.02)`.
- Card width for block drags; `max-content` up to 320 px for picker and item drags.
- Respect reduced motion: no scale.

### 2.3 Show where a picker drag will land

Picker drags are not part of the `SortableContext`, so cards don't move apart and there is no insertion cue. Using `dropIntent` from 1.1, draw a 2 px accent insertion line before or after the hovered card. The insert index must match what `onDragEnd` uses: `after` means index + 1. Over an empty column, highlight the column (`.columnOver` exists) and show "Drop to add to Saturday" inside the empty-state box.

### 2.4 Show the block kind on supersets and circuits

The brief says each card shows its kind. Supersets and circuits currently look like two stacked names with two grips.
- Add a quiet label in the card's meta line, for example "Superset · 3 rounds · rest 1:30" and "Circuit of 3 · 3 rounds · rest 1:30" (from `block.kind`).
- Add a 3 px accent rail on the left that joins the items.

### 2.5 Use the same grip for exercises inside a superset

`ItemGrip` uses a braille character (⠿) at 32 px. Use the same SVG as the card grip, drawn smaller. Keep a 44 px hit area through padding and negative margins. Keep `touch-action: none`.

### 2.6 One meaning for the pencil

The pencil currently means both "edit day label" and "edit card". Make the card's toggle a text button, "Edit", which becomes "Done" when open. That matches the existing "Done" and the plain-verbs rule. Keep the pencil for renaming the routine and editing day labels.

---

## Phase 3: Ways to do it without dragging (brief section 9a)

### 3.1 "Add to…" on picker rows and "Move to…" on cards

The brief requires both, and neither exists. There is also a stale comment at `Routines.tsx:43` that refers to a Move to menu.
- **Picker rows:** keep the one-tap Add for the day being viewed. Next to it, add a `MoreMenu` labelled `Add <name> to another day`, listing every weekday (in `week_starts_on` order) plus "Accessory bank". Use `add(ref, target)`.
- **Cards:** add "Move to…" with the same list minus the current container. Put it in the editor footer, or as a `MoreMenu` on the card. Use `moveBlock` and show the undo toast.
- Update the stale comment.

### 3.2 "Link as superset" by selection

- Add a "Select" text button in the column header. In selection mode, each card shows a 44 px checkbox and its grip is hidden.
- A sticky bar shows "Link as superset" once two or more are selected; with three or more it reads "Link as circuit". Linking uses `link` and leaves selection mode. "Cancel" leaves selection mode.
- Selection stays within one day, since it lives in that column.

### Tests

Add e2e tests for Move to (phone and desktop) and Link as superset. Add axe scans for the open menus and selection mode.

---

## Phase 4: Layout polish

### 4.1 More room to work on phone

On an 844 px phone, the toolbar, routine overview and stats take about 60% of the screen before the first exercise.
- Below 1024 px, show the stats as one line ("1 training day · 5 exercises · 15 sets a week") instead of three tiles.
- Move "Most work" into the "Weekly sets per muscle" section.

### 4.2 Day chips that fit

At 390 px, Sun and Bank are off-screen, the selected chip (Sat) is cut off, its count is clipped, and a scrollbar line shows.
- On mount and on `pageDay` change, scroll the selected chip into view (`scrollIntoView({ inline: "nearest", block: "nearest" })`).
- Hide the scrollbar (`scrollbar-width: none` and the WebKit equivalent).
- Add an edge fade mask on whichever side has more chips.

### 4.3 The add button must not cover cards

The fixed "Add exercise" button (`.addFab`) sits over card rep ranges and edit buttons.
- On phone, replace it with a full-width "Add exercise" button at the end of the day column, below the last card or inside the empty state.
- On desktop, put the button in the column header when the picker is closed.
- Remove `.root:has(.addFab)` padding if it is no longer needed. Update tests that click "Add exercise".

### 4.4 Picker list order and search field

- With no search text, the list is plain alphabetical ("3/4 Sit-Up", "45° Side Bend", "Air Bike"...). Sort the unfiltered or filtered list by `commonness` and then name, as `search()` does for queries in `src/exercises/query.ts`.
- The placeholder "Search exercises" is clipped by the muscle select. Give the select `flex: none; max-width: 40%` and the search label `min-width: 0`, or shorten the placeholder to "Search". Check at 360 px.

### 4.5 Focus lands on Cancel in the name sheet

When "New routine" opens, focus goes to Cancel, not the name field. Typing goes nowhere and Return cancels. React's `autoFocus` does not survive `showModal()`.

Fix it once in `ExpandableScreen.tsx`: after `showModal()`, once the content has mounted (next animation frame), focus `[data-autofocus]` inside the dialog if present. Mark the name input with `data-autofocus`. Check the other sheets (picker search, ConfirmSheet) still get sensible focus.

### 4.6 "All changes saved" before anything exists

Render the save status only when a routine exists.

---

## Phase 5: Desktop seven-column board (ask before starting)

Brief 9a calls for a seven-column weekly board plus an accessory bank lane on desktop. Today desktop shows one day at a time. Moving a card between days then depends on the chips, which the floating nav covers when scrolled.

Proposed approach, to confirm with the user first:
- At ≥1024 px, render all seven day columns side by side in a horizontally scrollable board (minimum column width about 220 px). The accessory bank is a lane under it.
- The picker stays docked on the right. The day pager is hidden on desktop.
- Cards in columns use the compact form; editing expands the card in place.
- Drag between columns directly. dnd-kit auto-scrolls the board horizontally.
- The "Add" button in each column header adds to that column.
- Update the desktop e2e tests: "drags an exercise from the picker onto a day" should target a column region.

---

## Final check after each phase

- Run `npm run typecheck`, `npm test`, `npx supabase test db`, and `npm run e2e` (both phone and desktop projects).
- Do the manual mid-drag check from the top of this file at 390x844 and 1280x800, in light and dark.
- In the phase summary, list anything unverified, especially real touch long-press on a phone. The browser tools send mouse events, so touch needs a real device or the iOS simulator.
