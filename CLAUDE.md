# CLAUDE.md — Agent onboarding & conventions

Instructions for any agent (or human) picking up work on this repo. This file holds the **working
rules** (dev cycle, branching, review, commands). Repo **knowledge** lives in the
[`docs/`](./docs/) knowledge base — read it before starting.

## Branching & PR workflow (agent contributing rules)

Follow this on **every** change request — it is not optional:

1. **One branch per change/feature.** When the user asks for a change, first decide whether it
   belongs on the **current** branch or a **new** one. Related work on the same in-flight feature
   stays on that branch; a **different** change/feature gets its **own** branch. Never mix
   unrelated changes in one branch/PR.
2. **Always branch from an up-to-date `main`.** Before starting new work:
   `git checkout main` → `git pull --ff-only origin main` (confirm local `main` == `origin/main`)
   → `git checkout -b <branch>`. Only create the new branch once `main` matches remote.
3. **Commit → open a PR → share the link.** Once you've made a commit on a branch, push it and
   open a PR (base `main`), then give the user the PR URL.
4. **After merge, delete the branch everywhere.** When a PR is merged, delete the branch on
   GitHub **and** locally (`git push origin --delete <branch>` / `git branch -d <branch>`), then
   `git fetch --prune`.
5. **Merges are squash-only.** The repo allows only "Squash and merge" (merge commits + rebase
   merging are disabled). Keep PRs coherent so the squashed commit is meaningful.

> **Note:** `main` isn't server-side protected — PR-only + squash-only enforcement needs a paid
> plan on this private repo — so the branching discipline above is what keeps `main` clean.

## Development cycle (every change)

Every change — however small — runs through this cycle, in order:

1. **Plan.** Think through the best solution and outline the changes *before* writing code.
   Prefer reusing existing utilities/seams over adding new ones.
2. **Implement.** Make the changes.
3. **Test.** Add or extend unit tests for the new/changed logic.
4. **Build / lint / format.** `npm run build`, `npm run lint`, `npm run format`, `npm test` — all green.
5. **Review (thorough).** Self-review the diff against the checklist below before opening the PR.

### Review checklist

Do the review **with full context of what changed and why** (the goal of the change), then check:

- **Correctness & goal:** it actually achieves the intended outcome, including edge / error / empty
  states (empty note, quota exceeded, first run, only-one-note, offline, rapid edits).
- **Optimization:** no unnecessary work, re-renders, or storage writes; the 3s autosave debounce and
  sync write-rate limits are respected.
- **Security:** untrusted note content stays sanitized (DOMPurify); no `{@html}` of unsanitized data;
  no injection/XSS; least-privilege permissions; no remote code (MV3-safe).
- **Modular / maintainable / clean:** honors the seams & conventions — persistence only via
  `NotesRepository`, caps/limits only via `limits.ts`, the layout contract; no dead code, stray
  `console.log`s, commented-out blocks, or leftover TODOs.
- **Test coverage:** every meaningful function is covered; new logic has tests; the suite is green.
- **Data compatibility:** any change to the stored note shape has a migration / back-compat story
  (notes live in `chrome.storage.sync` on real users' machines).
- **Accessibility & themes:** keyboard/focus/ARIA are sane; the UI looks right in both light and dark.
- **Scope:** no unrelated changes slipped in.
- **Docs:** do the docs need updating? Update the [`docs/`](./docs/) knowledge base / `CLAUDE.md` /
  `README.md` when scope or behavior changed — and check for redundancy across docs to trim (keep
  them lean; code is the source of truth).
- **Gates pass:** build, lint, format, and tests are all green.
- **Improvements & feedback:** surface any follow-up improvements, risks, or concerns to the user.
- **Manual check:** for UI changes, load-unpacked and click through the affected flow — unit tests
  don't cover the panel UI.

Then follow the Branching & PR workflow above (commit → PR → share link).

## Repo knowledge

What the repo is, how it's structured, the roadmap, and why decisions were made live in
[`docs/`](./docs/): [overview](./docs/overview.md) · [architecture](./docs/architecture.md)
(structure, seams, the UI layout contract) · [roadmap](./docs/roadmap.md) ·
[decisions](./docs/decisions.md). Keep those updated when scope or structure changes.

## Golden rules

1. **Small, PR-sized changes.** Each change is its own small PR — don't bundle unrelated work. Pick
   the next item from [`docs/roadmap.md`](./docs/roadmap.md) (the first item is the default) unless
   the user's request points elsewhere.
2. **Every meaningful function is unit-tested.** Tests live in `tests/` (mirroring `src/`), run
   with Vitest. A PR is not done until `npm test` is green and new logic is covered. Pure logic is
   unit-tested; Svelte components are checked via manual E2E.
3. **All persistence goes through `NotesRepository`.** `src/lib/storage/SyncNotesRepository.ts` is
   the *only* file allowed to touch `chrome.storage.*`. Keep UI/stores backend-agnostic.
4. **Respect the storage caps.** All cap/byte/char logic lives in `src/lib/storage/limits.ts`:
   **max 10 notes**, a **per-note char + byte budget**, and **3-second debounced** saves (the
   reasoning is in [decisions](./docs/decisions.md)).
5. **Render Markdown safely.** `src/lib/markdown/render.ts` renders **GFM** and MUST sanitize
   output (DOMPurify) — note content is untrusted. Never inject unsanitized HTML.
6. **Keep it store-publishable.** Avoid broad permissions, remote code, or anything that fails MV3
   review.
7. **Explain non-obvious code.** When a change does something unusual, deviating, or extra, add a
   short comment directly above it saying **why** (the decision/reason) — not what.

## Commands

- `npm run dev` — Vite dev build with HMR.
- `npm run build` — production build into `dist/` (this is what you Load unpacked).
- `npm test` — run Vitest once. `npm run test:watch` for watch mode.
- `npm run lint` — Biome check. `npm run format` — Biome write (format + safe fixes).
- `npm run check` — svelte-check (type/Svelte diagnostics).

## Load the extension

`npm run build` → open `chrome://extensions` → enable Developer mode → **Load unpacked** →
select the `dist/` folder → click the toolbar icon to open the side panel.
