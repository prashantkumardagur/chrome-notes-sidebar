# Code block syntax highlighting

> Roadmap item (Deferred): "Code block syntax highlighting: highlight fenced code in View, sanitized
> and bundled (no remote code, MV3-safe)." Its own small PR. Independent of the other roadmap items
> (does not depend on, and is not depended on by, render-html-as-text — code fences are Markdown
> `code` tokens, not raw HTML).

## Why?

Fenced code blocks in View mode render as plain, single-color monospace (`MarkdownView.svelte` →
`<pre><code>`). For anyone keeping code snippets, config, or commands in notes, syntax coloring makes
them far more readable. Because this is a Chrome extension (bundle loads on every panel open) and must
stay MV3-publishable (no remote code, no CDN), the highlighter must be **bundled** and **lean**.

## What?

When done, a fenced code block with an **explicit, supported language** (e.g. ` ```js `) renders with
**syntax highlighting** in View mode, themed to match light and dark. A fence with **no language** or
an **unsupported language** renders exactly as today — plain monospace, no error, no network. Editing
is unaffected (Edit mode stays a raw textarea).

**In scope:** bundling a lightweight highlighter with a **curated language set**; wiring it into the
Markdown render pipeline; a single token-based CSS theme mapped to the app's `--` theme variables
(covers all supported languages in both themes); keeping output sanitized (DOMPurify allows token
classes); unit tests for the render output; docs.

**Out of scope:** language auto-detection (explicitly rejected — see Decisions); highlighting in Edit
mode; line numbers; copy-code buttons; a user-configurable language list; per-language themes.

## Decisions

Locked during specification. Do not relitigate:

- **Explicit language only; no auto-detect.** A fence must declare its language to be highlighted;
  unlabeled/unsupported fences stay plain. Rationale: user's choice — deterministic, far smaller
  bundle, less per-render CPU, and avoids auto-detect's frequent wrong guesses on the short snippets
  typical in notes.
- **Library: `highlight.js` with explicitly registered languages, via `marked-highlight`.** Rationale:
  `highlight.js` has clean ESM per-language imports so only the curated set is bundled (real
  tree-shaking of a subset), and `marked-highlight` is the supported way to hook highlighting into
  `marked` v18 (the old `highlight` option was removed). Prism is an acceptable alternative but its
  grammar imports rely on global side-effects/an autoloader that fits Vite/CRXJS bundling less cleanly;
  if the implementer hits a bundling wall with `highlight.js`, Prism with explicit `import`s is the
  fallback — but default to `highlight.js`.
- **Curated default language set:** `javascript`, `typescript`, `python`, `bash`/`shell`, `json`,
  `xml`/`html`, `css`, `markdown`, `sql`, `yaml`. Rationale: the common languages for developer notes;
  ~10 grammars keeps the bundle small. Extendable later by registering more.
- **One token-based CSS theme driven by `--` vars, not a prebuilt hljs theme.** Rationale: hljs's
  shipped themes hardcode colors and don't adapt to light/dark; a thin map of the ~8–10 `.hljs-*` token
  classes to new `--hl-*` variables (defined in each theme block in `app.css`) themes every language at
  once and flips correctly with the existing theme system.
- **Unsupported/untagged fences degrade to plain, never error.** Rationale: matches today's behavior; a
  missing grammar must not throw or leave the note unrendered.

## How?

### 1. Dependencies

- Add `highlight.js` and `marked-highlight` to `dependencies`. No CDN, no remote — both are bundled by
  Vite/CRXJS into `dist/` (MV3-safe).

### 2. `src/lib/markdown/render.ts` — hook highlighting into `marked`

- Import `highlight.js/lib/core` and register only the curated languages
  (`import hljs from "highlight.js/lib/core"; import javascript from "highlight.js/lib/languages/javascript"; hljs.registerLanguage("javascript", javascript); …`). Keep the registration list in one place (a small array) so it's easy to extend.
- Register `marked-highlight`:
  ```ts
  marked.use(markedHighlight({
    // Highlight only registered languages; anything else returns the code unchanged
    // (marked will still escape it), so unsupported/untagged fences render plain.
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "";
      return language ? hljs.highlight(code, { language }).value : code;
    },
  }));
  ```
- Keep the existing `marked.setOptions({ gfm, breaks })` and the `render-html-as-text` renderer
  override (if landed) — they compose; highlighting only touches `code` tokens.
- `renderMarkdown` still runs DOMPurify. **Ensure DOMPurify keeps token markup:** highlighted output is
  `<span class="hljs-…">…</span>` inside `<pre><code class="hljs language-…">`; `span`/`class` are
  allowed by the default profile, but verify a highlighted sample survives sanitize (add a test). The
  existing `ADD_ATTR` stays.

### 3. Theme CSS — `src/sidepanel/app.css` + `MarkdownView.svelte`

- Add `--hl-*` tokens to each theme block in `app.css` — the `:root` (light) defaults, the
  `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` block, and the
  `:root[data-theme="dark"]` block (and the forced-light block, mirroring the existing pattern for
  `--bg`, `--text`, `--code-bg`, …). Suggested tokens: `--hl-keyword`, `--hl-string`, `--hl-comment`,
  `--hl-number`, `--hl-function`, `--hl-title`, `--hl-attr`, `--hl-built-in`, `--hl-literal`. Pick
  accessible colors that read on `--code-bg` in both themes.
- In `MarkdownView.svelte`'s `<style>` (which already scopes `.markdown-body :global(pre code)`), add
  `:global(.hljs-keyword){ color: var(--hl-keyword) }` etc., mapping each hljs class to a token. This
  one block styles all supported languages. Keep the existing `pre`/`code` background rules.

### 4. Docs

- `docs/overview.md`: mention syntax-highlighted code blocks (explicit language) in View.
- `docs/architecture.md`: note the highlighter in the render pipeline + the curated language list
  location.
- `docs/decisions.md`: a row — bundled `highlight.js` subset, explicit-language only, custom `--hl-*`
  theme (MV3-safe, no remote).
- `docs/roadmap/index.md`: remove this item from Deferred.

## Caveats

- **Bundle size is the main review concern.** Import from `highlight.js/lib/core` and per-language
  modules — **never** `highlight.js` (the default entry pulls in *all* grammars). Verify the production
  bundle didn't balloon (`npm run build` and check `dist/` asset sizes before/after).
- **MV3 / no remote code.** Do not use the CDN build, the Prism autoloader, or any wasm/dynamic-eval
  highlighter (rules out Shiki). Everything must be statically bundled.
- **Sanitization must not strip the coloring.** DOMPurify runs after highlighting; confirm token
  `class`es survive (test). If a future DOMPurify config tightens `class`, this breaks silently.
- **Unknown language must be a no-op, not a throw.** `hljs.highlight` throws on an unregistered
  language — the `getLanguage(lang) ? … : ""` guard is required; don't call `highlightAuto` (that's the
  rejected auto-detect path and pulls weight).
- **Language aliases.** `hljs.getLanguage` resolves aliases (`js`→javascript, `sh`→bash, `yml`→yaml)
  only for registered languages; make sure the common aliases users type map to a registered grammar.
- **Theme contrast.** The `--hl-*` colors must stay legible on `--code-bg` in both light and dark; a
  prebuilt hljs theme won't adapt, which is why we map to `--` vars. Check both themes manually.
- **Empty/whitespace code and non-string edge cases** must render without error (existing render tests
  cover empty input; keep them green).

## Relevant tests

Pure render logic is unit-tested (`tests/markdown/render.spec.ts`); the visual theme is verified by
manual E2E.

**Extend `tests/markdown/render.spec.ts`:**
- A fence with a supported language (e.g. ` ```js\nconst x = 1;\n``` `) produces output containing
  `hljs` token markup (e.g. a `class="hljs-…"` span) and the code text, and **survives DOMPurify** (the
  token spans/classes are present in the final sanitized string).
- A fence with **no language** renders a plain `<pre><code>` block with the code text and **no**
  `hljs-` token spans.
- A fence with an **unsupported language** (e.g. ` ```rust `) renders plain (no throw, no token spans).
- Existing tests stay green: fenced code still shows its text; sanitization tests (script/handlers/
  `javascript:`) unaffected.

**Commands (all must be green):**
```
npm test
npm run check
npm run lint
npm run build     # also eyeball dist/ bundle size — the highlighter subset must stay small
```

**Manual E2E (load `dist/` unpacked):**
1. Write ` ```js ` / ` ```python ` / ` ```json ` blocks → View shows colored tokens; toggle
   System/Light/Dark → colors stay legible and adapt in each theme.
2. Write a ` ```rust ` block (unsupported) and a fence with no language → both render as plain
   monospace, no console error.
3. Confirm the panel still loads quickly (bundle not bloated) and nothing is fetched over the network
   (DevTools → Network is empty on open).
