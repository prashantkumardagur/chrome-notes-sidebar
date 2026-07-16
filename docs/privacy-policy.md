# Privacy Policy — Notes Sidebar

_Last updated: 16 July 2026_

Notes Sidebar is a Chrome extension for writing Markdown notes in the browser side panel. This
policy explains what data it handles and how. The short version: **your notes stay yours — there is
no account, no backend, and nothing is sent to us or any third party.**

## What the extension stores

- **Your notes** (their text, titles, and last-edited timestamps).
- **Your preferences** (theme and view settings).

That is the only data involved. The extension does not collect your name, email, location, browsing
history, or any analytics.

## Where it is stored

All data is saved using Chrome's built-in [`storage.sync`](https://developer.chrome.com/docs/extensions/reference/api/storage)
API. This means:

- It lives in your browser and, if you are signed into Chrome, syncs across your own Chrome browsers
  through your Google account — the same mechanism Chrome uses for bookmarks and settings.
- The developer of this extension operates **no servers** and has **no backend**. We never receive,
  see, or have access to your notes. Any sync is handled entirely by Google under
  [Google's Privacy Policy](https://policies.google.com/privacy).

## What we do not do

- We do **not** sell or share your data with anyone.
- We do **not** send your data to any third-party server.
- We do **not** use analytics, tracking, or advertising.
- We do **not** run any remote code.

## Permissions

The extension requests only the minimum permissions it needs:

- **`storage`** — to save your notes and preferences (as described above).
- **`sidePanel`** — to show the notepad in Chrome's side panel.

It requests no access to your browsing history, tabs' content, or any website.

## Exporting and importing

The extension lets you export your notes and settings to a JSON file, and import one back. These
files are created and read entirely on your own computer, at your request — they are never uploaded
anywhere.

## Removing your data

Uninstalling the extension removes its locally stored data. Notes previously synced through your
Google account are governed by your Chrome/Google account settings; you can manage or clear synced
data from your Google account.

## Changes to this policy

If this policy changes, the updated version will be published at this same location with a new "last
updated" date.

## Contact

Questions about this policy can be directed to the project maintainer at
prashantkumardagur@gmail.com.
