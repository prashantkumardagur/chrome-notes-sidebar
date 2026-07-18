# Interactive task lists

> Roadmap item (Deferred): "Interactive task lists: toggle `- [ ]`/`- [x]` checkboxes directly in
> View mode, writing the change back to the note." Its own small PR.
>
> **DEPENDS ON [render-html-as-text.md](./render-html-as-text.md) — do not start this task until that
> one has landed.** That change makes raw HTML render as literal text, which guarantees every checkbox
> in View mode is a genuine Markdown task-list checkbox (no hand-typed `<input>` can desync the
> index mapping this task relies on). If that task is not yet merged, pick a different roadmap item.

## Why?

GFM task lists (`- [ ] todo` / `- [x] done`) already render as checkboxes in View mode, but they're
`disabled` — you can see them but not tick them. To check something off you have to switch to Edit,
find the line, and change `[ ]` to `[x]` by hand. For a notes tool people use as a lightweight todo
list, that's the single most common interaction and it's needlessly manual. Letting the user click the
checkbox in View mode — and having it persist — closes that loop.

## What?

When done, **clicking a task-list checkbox in View mode toggles it** (`[ ]` ↔ `[x]`) and the change is
**written back into the note body** and autosaved, exactly as if the user had edited the source. The
rendered View updates to reflect the new state, and switching to Edit shows the corresponding
`- [x]`/`- [ ]` change.

**In scope:** a pure toggle function that flips the Nth task-list marker in a Markdown string; making
View-mode task checkboxes interactive; wiring a toggle back up to `App.svelte` so it updates `body` and
triggers the existing autosave; unit tests for the toggle function; docs updates.

**Out of scope:** editing task text in View mode; reordering/indenting tasks; adding new tasks from
View; any drag-and-drop; nested-checkbox parent/child auto-completion; a separate "todo" UI. Toggling
is the only interaction.

## Decisions

Locked during specification. Do not relitigate:

- **Nth-checkbox index mapping via a pure `toggleTaskAtIndex(source, n)`.** The clicked checkbox's
  position among rendered task checkboxes (document order) selects which `- [ ]`/`- [x]` marker in the
  source to flip. Rationale: chosen by the user — simplest, no render-pipeline change, fully
  unit-testable. Reliable because the prerequisite (raw-HTML-as-text) guarantees rendered checkbox
  order == source task-marker order.
- **Only genuine task-list checkboxes are made interactive** — scope the handler to
  `li > input[type="checkbox"]` (what `marked` generates for `- [ ]`). Rationale: belt-and-suspenders
  alongside the raw-HTML-as-text prerequisite; keeps the mapping robust even if the render ever changes.
- **The write flows through `body` + existing autosave**, via a callback from `MarkdownView.svelte` up
  to `App.svelte` (like the existing `onDismissHighlight` callback). Rationale: reuse the single
  source of truth and the 3s debounced save; no new persistence path.
- **Toggling never changes note length meaningfully / never hits the char cap.** `[ ]` → `[x]` is a
  1-char swap (`space` → `x`); no budget guard needed. Rationale: keeps the interaction unconditional.
- **Do not remove the `disabled` semantics globally / do not enable arbitrary inputs.** Only task-list
  checkboxes become clickable. Rationale: security posture and mapping integrity.

## How?

### 1. `src/lib/markdown/tasks.ts` (new, pure)

```ts
/** Flip the Nth (0-based, document order) task-list marker in a Markdown source. */
export function toggleTaskAtIndex(source: string, index: number): string;
```

- Match task-list markers with a line-anchored regex that mirrors what `marked` treats as a task item:
  optional indentation, a bullet (`-`, `*`, or `+`) or ordered marker, whitespace, then `[ ]`, `[x]`,
  or `[X]` — e.g. `/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm`.
- Walk matches in order; at `index`, replace `[ ]` → `[x]` and `[x]`/`[X]` → `[ ]`; leave the rest
  untouched. Out-of-range `index` returns the source unchanged (defensive).
- Preserve the exact surrounding text (indentation, bullet char, trailing content) — only the single
  bracket character changes.

### 2. `src/components/MarkdownView.svelte`

- Add an `onToggleTask?: (index: number) => void` prop.
- After render (in an `$effect` that depends on `html`, like the existing highlight effect), select
  `viewEl.querySelectorAll('li > input[type="checkbox"]')`, and for each: remove the `disabled`
  attribute and add a `change` (or `click`) listener that computes its index in that NodeList and calls
  `onToggleTask?.(index)`.
- **Stop the toggle click from bubbling to the container's `dismiss()`** handler (or ensure dismiss is
  harmless here) so ticking a box doesn't also clear search highlights unexpectedly — call
  `e.stopPropagation()` in the checkbox handler.
- Because `html` is re-derived and reassigned to `innerHTML` on every `source` change, listeners are
  naturally recreated for the fresh DOM; ensure the effect re-runs on `html` change (read `html` in it).
- Keep the content sanitized — no change to how `{@html html}` is produced.

### 3. `src/sidepanel/App.svelte`

- Pass `onToggleTask={toggleTask}` to `<MarkdownView>`.
- Implement `toggleTask(index)`: `body = toggleTaskAtIndex(body, index);` then trigger the same path as
  a user edit so autosave fires and status flips to Saving — i.e. call the existing `onEdit()` logic
  (`pendingSelect = null; status = 'saving'; scheduleSave();`). If `current` exists, this persists like
  any edit. The `body` reassignment re-renders View with the new checkbox state.

### Docs

- `docs/overview.md` → note that task-list checkboxes are tickable in View mode.
- `docs/architecture.md` → mention `src/lib/markdown/tasks.ts` in the map and the View→App toggle wiring.
- `docs/roadmap/index.md` → remove this item from Deferred.

## Caveats

- **Hard dependency on raw-HTML-as-text.** Without it, a hand-typed `<input type="checkbox">` renders
  as a real checkbox, is counted, and shifts the Nth-index mapping so clicks toggle the wrong line. Do
  not implement this task standalone — see the banner at the top.
- **Index must be computed against the same NodeList `marked` produced.** Count only
  `li > input[type="checkbox"]` in document order; that order matches the source-marker order the
  toggle function walks. Don't count checkboxes elsewhere.
- **Autosave, not immediate write.** The toggle reuses the 3s debounced save; a rapid series of toggles
  coalesces into saves like typing does. The `visibilitychange`/`pagehide` flush in `App.svelte` still
  covers a panel close mid-debounce.
- **Re-render vs. listener leaks.** Each `source` change reassigns `innerHTML`, discarding old nodes and
  their listeners; attach listeners in the post-render `$effect` so they always match the live DOM. Do
  not attach once in `onMount`.
- **Ordered/indented/nested tasks.** The regex must handle `*`/`+`/`-` bullets, `1.`/`1)` ordered
  items, and leading indentation, because `marked` renders those as task items too — otherwise the
  Nth-source-marker won't line up with the Nth rendered checkbox. Cover these in tests.
- **`[X]` uppercase.** GFM accepts `[x]` and `[X]` as checked; treat both as checked and normalize to
  `[x]` when unchecking→checking, but don't rewrite unrelated markers.
- **Don't double-handle clicks.** Use one of `click`/`change` (not both) and `stopPropagation` so the
  container dismiss handler and the toggle don't fight.

## Relevant tests

Pure toggle logic is unit-tested; the View interactivity + App wiring is verified by manual E2E.

**New `tests/markdown/tasks.spec.ts`** for `toggleTaskAtIndex`:
- Single task: index 0 flips `[ ]`→`[x]` and back.
- Multiple tasks: toggling index 2 flips only the 3rd marker; others unchanged; surrounding text and
  indentation preserved byte-for-byte except the one bracket char.
- Bullet variants (`-`, `*`, `+`) and ordered (`1.`, `1)`) task items are all counted in order.
- Indented / nested task items map to the right index.
- `[X]` (uppercase) counts as checked and toggles to `[ ]`.
- Out-of-range index returns the source unchanged.
- Non-task lines that merely contain `[ ]` mid-text are not matched (line-anchored regex).

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build
```

**Manual E2E (load `dist/` unpacked):**
1. Write a task list, switch to View, tick a box → it checks, the save dot goes Saving → Saved, and
   switching to Edit shows that line changed to `- [x]`.
2. Untick it in View → back to `- [ ]` in Edit.
3. With several tasks, tick the 3rd → only the 3rd source line changes.
4. Type a literal `<input type="checkbox">` into a note (relies on raw-HTML-as-text) → it shows as
   text and is **not** clickable, and does not affect which real task a click toggles.
5. Rapidly toggle a few boxes, close the panel immediately → the last state is saved (flush-on-hide).
