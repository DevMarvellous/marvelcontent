# Marvel Content — Creator Studio

**Marvel Content** is a personal, offline-first content-production Progressive Web App (PWA) built for **Marvellous Adepoju** (Real Estate + Business Tech / PropTech niche).

It bridges the gap between drafting content and posting it manually across social media platforms (LinkedIn, Instagram, Facebook, YouTube, X).

---

## 🌟 Core Principles

- **Offline-First**: Operates seamlessly with zero internet connection via Service Worker caching and local assets.
- **Local Storage Only**: All data (content batches, video scripts, ideas, branding settings) is stored securely on your device via **IndexedDB**.
- **No Cloud Dependency / Zero Backend**: Pure client-side application. No external database, tracking, or cloud account required.
- **Manual Control**: Prepares, renders, and organizes content. You retain complete manual control over actual platform publishing.
- **Installable PWA**: Install directly onto Android or desktop home screens as a standalone native-feeling application.

---

## 🚀 Key Features

### 1. 📅 Today Dashboard
- Automatically detects today's day of the week (e.g. *Monday, Wednesday*).
- Displays all scheduled content items and video scripts due today.
- **One-Tap Share**: Direct mobile sharing sheet (`navigator.share`) with auto-generated card PNG and social caption.
- **Multi-Platform Checkboxes**: Mark items as posted on LinkedIn, Instagram, Facebook, YouTube, and X at a glance.

### 2. 🗓️ Calendar (Weekly Batch View)
- Displays full **Monday–Sunday** content schedule.
- **Weekly Progress Tracker**: Live progress bar computing published vs planned items ($X$ of $30$ weekly goal).
- Card image previews, caption snippets, and inline edit/delete controls.

### 3. 💡 Idea Bank
- Lightweight, low-friction idea capture.
- Tagging system (e.g. `#PropTech`, `#RealEstate`, `#Automation`).
- **"Turn into Post"**: One-click promotion that converts raw ideas into scheduled weekly content items.

### 4. 🎬 Video Scripts Studio
- Dedicated teleprompter/script manager with short & long-form templates.
- **Duration & Word Estimator**: Calculates word count and speaking duration at ~130 WPM.
- **Status Pipeline**: Track scripts from `Idea` ➔ `Ready` ➔ `Filmed` ➔ `Posted`.

### 5. 🎨 HTML5 Canvas Card Rendering Engine
- Live high-resolution card generator with automatic text layout:
  - `**bold text**` — Renders strong bold weight.
  - `++big text++` — Renders enlarged accent highlight.
  - Line breaks & paragraph spacing.
- **Custom Branding**: Creator avatar, display name, handle (`@devmarvellous`), and verified badge.
- **Aspect Ratio Presets**:
  - `Square (1:1)` — $1080 \times 1080$ (Instagram / LinkedIn / X)
  - `Portrait (4:5)` — $1080 \times 1350$ (Instagram Feed)
  - `Story / Reel (9:16)` — $1080 \times 1920$ (Shorts, Reels, Stories)

### 6. ✨ Gemini AI "Improve for Socials" (Optional)
- Built-in client-side AI rewrite tool powered by Google Gemini API.
- Generates punchy hooks, eliminates fluff, and formats text for maximum social engagement.
- **Side-by-Side Diff View**: Review original vs AI-rewritten version with `Accept (Replace)` and `Discard` buttons.
- **Privacy & Safety**: Your API key is saved exclusively in your device's IndexedDB.

### 7. 📦 Backup, Export & Import
- **JSON Backup**: Export all content, scripts, and settings into a single backup file.
- **JSON Restore**: Seamlessly import your backup on any browser or device.

---

## 📥 Batch Import Format Contract

You can batch import weekly content batches by clicking **"📥 Import Batch"** in the top navigation bar and pasting content blocks separated by `---`:

```text
DAY: MON
TYPE: CARDTEXT
CARD: The biggest mistake tech founders make in **real estate**?\n\nIgnoring ++legal title diligence++.
CAPTION: Here is why clean title deeds protect your capital... #PropTech #RealEstate
---
DAY: TUE
TYPE: CARD
CARD: Automation without process clarity is just ++accelerated chaos++.
---
DAY: WED
TYPE: TEXT
CAPTION: 3 SaaS tools I stopped paying for this month and why simplicity scales...
```

### Parser Rules:
- `DAY:` Options: `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, `SUN` (defaults to `MON` if unspecified).
- `TYPE:` Options: `CARD`, `CARDTEXT`, `TEXT`.
- Blocks are separated by `---`.
- Importing replaces the current `content_items` after a confirmation dialog (does not overwrite `video_scripts` or `idea_bank`).

---

## 🛠️ Tech Stack & Directory Structure

```
content creation/
├── index.html               # Main SPA HTML structure & modal dialogs
├── manifest.json            # Web App Manifest for PWA installation
├── favicon.svg              # Vector brand icon & PWA app icon
├── sw.js                    # Service Worker with offline-first caching
├── README.md                # Project documentation
├── marvel-content-app-spec.md # Original specification prompt
├── css/
│   ├── main.css             # Design tokens, base layout, buttons & forms
│   └── components.css       # Cards, platform pills, calendar, AI diff & responsive rules
└── js/
    ├── db.js                # IndexedDB database layer & CRUD handlers
    ├── card-renderer.js     # HTML5 Canvas Card rendering engine
    ├── ai.js                # Client-side Gemini AI integration
    └── app.js               # Master application controller & routing
```

---

## 📱 Installation on Android & Desktop

1. Open the application in Google Chrome, Edge, or mobile browser.
2. Tap the **"📱 Install App"** button in the header or install banner.
3. Alternatively, tap the browser menu (**⋮**) and select **"Add to Home screen"** or **"Install App"**.
4. Launch directly from your home screen with full offline support.

---

## 🔒 Privacy & Data Security

- **100% Client-Side**: No user data, passwords, or content is transmitted to any third-party server.
- **Offline Storage**: All content lives inside your browser's local **IndexedDB** database.
- **Direct AI Calls**: When using the optional Gemini feature, requests are sent directly from your browser to Google's official Gemini endpoint using your own private API key.
