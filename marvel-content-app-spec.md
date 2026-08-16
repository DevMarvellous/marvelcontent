# Marvel Content — Build Specification

## Purpose
A personal content-production tool for Marvellous Adepoju (real estate + business tech niche). Reduces friction between having an idea/script and actually posting it. Not a scheduler, not a publisher — it prepares and organizes content; posting itself still happens manually on each platform.

## Core principles (do not violate these)
- **Offline-first.** Must work with zero network connection. No feature should require internet to function, except the optional AI rewrite (which fails gracefully offline).
- **Local storage only.** No backend, no cloud database. All data lives in the browser via IndexedDB. Export/Import (JSON file) is the manual backup method — no auto-sync.
- **PWA, installable on Android.** Full offline caching via service worker (app shell + assets precached).
- **No auto-cross-posting.** This tool prepares content per platform; it never posts on the user's behalf.

## Tech stack
- Vanilla HTML/CSS/JS, single-page app. No build step, no framework — keeps it simple to maintain and fully offline-reliable.
- IndexedDB for storage (a small wrapper library like `idb` is fine, or hand-rolled — keep it simple).
- Canvas API for card image rendering (reuse the wrapping/markup engine below).
- `navigator.share` for the share sheet (with fallback to download if unsupported).
- Gemini API (client-side fetch, user's own API key) for the optional AI rewrite feature.

## Data model

### `content_items` (the weekly batch — same three types as before)
```
{
  id, day (MON-SUN), type (CARD | CARDTEXT | TEXT),
  card (string, supports **bold** and ++big++ markup),
  caption (string),
  postedStatus: { linkedin: bool, instagram: bool, facebook: bool, youtube: bool, x: bool },
  createdAt
}
```

### `video_scripts` (new — doesn't exist in the old app)
```
{
  id, day (optional), title, script (string), status (Idea | Ready | Filmed | Posted),
  postedStatus: { linkedin: bool, instagram: bool, facebook: bool, youtube: bool, x: bool },
  createdAt
}
```

### `idea_bank` (new — unscheduled, lightweight)
```
{ id, text, source (Me | AI), tags (optional string), createdAt }
```

## Import format (unchanged from the existing app — keep this contract)
Paste-based batch import, blocks separated by `---`:
```
DAY: MON
TYPE: CARD
CARD: text with **bold** and ++big++ markup
---
DAY: MON
TYPE: CARDTEXT
CARD: ...
CAPTION: ...
---
DAY: MON
TYPE: TEXT
CAPTION: ...
```
Parser rules: unknown DAY defaults to MON, unknown TYPE defaults to CARD if `card` field present else TEXT. Importing replaces the current `content_items` set after a confirm dialog (does not touch `video_scripts` or `idea_bank`).

## Screens

### 1. Today
- Shows only today's content_items and any video_scripts due today.
- Per item: quick actions (Download, Share, Copy caption, Mark posted per platform via checkboxes).
- This is the daily-use screen — should require zero scrolling/searching for "what do I post today."

### 2. Calendar (weekly view)
- Same as the existing app: Mon–Sun sections, entry cards, download/copy/edit/delete.
- Add: per-platform posted checkboxes on each card (LinkedIn/IG/FB/YT/X) so posting status is visible at a glance, not remembered.
- Weekly progress indicator: X of 30 posted vs planned, computed from postedStatus across all platforms/items.

### 3. Idea Bank
- Flat list, not scheduled. Add idea (text + optional tag), copy button, delete button.
- No type/day required — this is deliberately lower-friction than the full batch format, for quick capture.
- "Turn into content item" button: promotes an idea into a real content_item (opens the day/type assignment).

### 4. Video Scripts
- List of scripts with status (Idea/Ready/Filmed/Posted), same posted-per-platform checkboxes as content items.
- Add/edit/delete scripts, copy full script text.

### 5. Settings
- Header/avatar/name, card style settings (bg color, text color, font, size, alignment — default left), canvas preset — same as existing Card Maker.
- Gemini API key field (stored in IndexedDB/localStorage only, never hardcoded, never sent anywhere except directly to Google's API from the browser).
- Export/Import JSON backup buttons.
- Wipe data (with confirm).

## Card rendering engine
Reuse the existing engine as-is: `**bold**`, `++big++` markup, word-by-word wrapping with per-word font measurement, centered/left alignment, header (avatar + name) drawn above the wrapped text block, paragraph breaks on `\n`.

## Share button (replaces plain download as primary action)
- Try `navigator.share({ files: [canvas-to-file], text: caption })` first.
- If `navigator.canShare` with files isn't supported, fall back to a plain download link.
- **Known limitation to surface in the UI as a small note, not hide it:** Instagram does not accept pre-filled caption text via share intent — only the image shares cleanly there; caption still needs manual paste. WhatsApp, X, and Facebook accept both image and text.

## AI rewrite feature (optional, Gemini-powered)
- A "Improve for socials" button available on any card/caption/script/idea text box.
- Sends the current text plus a fixed system instruction ("rewrite this for social media, punchier, platform-appropriate, keep the core message") to the Gemini API using the user's stored key.
- Shows the result alongside the original — user chooses Accept (replaces) or Discard.
- If no API key is set, the button opens Settings instead of failing silently.
- If offline, disable the button with a visible tooltip ("needs internet") rather than letting it fail unclearly.
- Confirm the exact current Gemini endpoint/model name at build time — API specifics change; don't hardcode a guessed model name without checking Google's current docs first.

## Explicit non-goals (do not build these — keeps scope honest)
- No cloud sync / multi-device sync.
- No actual auto-posting to any platform.
- No content planning/AI-generated weekly batches inside the app — that stays a manual chat-based process with Claude, then pasted in.
- No user accounts/login — single local user.

## Acceptance checklist before considering this done
- [ ] Works with airplane mode on, including opening a previously-loaded card.
- [ ] Import parses a real 30-item batch correctly into the right days/types.
- [ ] Share sheet actually opens on Android Chrome for an image.
- [ ] Export → clear data → Import restores everything identically.
- [ ] AI rewrite button visibly fails gracefully with no key set and no internet.
