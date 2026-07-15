# Notes Sidebar

A minimalist **Markdown notes** extension that lives in Chrome's **side panel** — write notes
alongside any page, and they stay with you across your Chrome browsers. No account, no servers.

## Features

- **Side-panel notepad** — stays open as you move between tabs.
- **Markdown, with View / Edit** — write in plain Markdown (GitHub-Flavored), flip to a rendered
  preview. Supports headings, bold/italic, lists, links, code blocks, tables, and task lists.
- **Auto-save** — your note is saved automatically a few seconds after you stop typing.
- **Cross-device sync** — notes sync across the Chrome browsers you're signed into, via Chrome's
  built-in storage sync. Nothing is sent to any third-party server.
- **Multiple notes** — keep several notes and switch between them from a dropdown. *(from PR 2)*
- **Dark mode & keyboard shortcut** — theme that follows your system, plus a hotkey to open the
  panel. *(later PRs)*

> Notes sync uses Chrome's `storage.sync`, which has a limited size budget — so there's a small
> cap on the number of notes and on how long each note can be. The editor shows your usage.

## Getting started (development)

Requirements: Node.js 20+ and npm.

```bash
npm install        # install dependencies
npm run dev        # dev build with hot reload
npm run build      # production build into dist/
```

### Load it in Chrome

1. Run `npm run build`.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the generated **`dist/`** folder.
5. Click the extension's toolbar icon to open the notes side panel.

After code changes, re-run `npm run build` (or keep `npm run dev` running) and hit the reload
icon on the extension card.

## Testing

```bash
npm test           # run the unit-test suite (Vitest) once
npm run test:watch # watch mode
```

Every meaningful function is covered by a unit test in the `tests/` directory. Please keep the
suite green and add tests for new logic in your PR.

## Contributing

- Work in **small, PR-sized changes** — see the roadmap and PR breakdown in
  [`plan.md`](./plan.md).
- Read [`CLAUDE.md`](./CLAUDE.md) for the architecture conventions (the `NotesRepository` storage
  seam, storage caps, the layout contract, and the testing rule).

## License

TBD.
