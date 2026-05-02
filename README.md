# AI Food Order

A macOS desktop app that imports your UberEats order history, visualises your spending habits, and uses on-device AI to suggest what you might want to order next.

## What it does

**AI Food Order** connects to your UberEats account (via a session cookie), pulls your full order history, and stores it locally on your Mac. It then gives you a personal food-ordering dashboard with three main capabilities:

- **Analytics** – see breakdowns of your spending by day of the week, time of day, and month, along with your most-visited restaurants.
- **Orders** – browse and search every past order synced from UberEats.
- **AI Recommendations** – get on-device AI suggestions for what to order, based on your historical patterns for a given day and time. Recommendations are generated entirely on your Mac using [Apple Intelligence](https://developer.apple.com/documentation/FoundationModels) — no order data ever leaves your device.

You can rate each recommendation (👍 / 👎) and request a fresh one; the app tracks your feedback and avoids repeating recent suggestions.

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18, Vite, TypeScript, TailwindCSS |
| Desktop shell | Electron (main process + IPC services) |
| Local storage | SQLite via `better-sqlite3` |
| AI predictions | Swift helper using Apple Foundation Models framework |
| Package manager | pnpm |

## Requirements

- **macOS 26 (Sequoia) or later** on an **Apple Silicon Mac** (M1 or later)
- **Apple Intelligence** enabled (System Settings → Apple Intelligence & Siri)
- **Node.js 18+** and **pnpm**
- **Xcode 16.4+** (to compile the Swift AI helper)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

If Electron's postinstall step was blocked, allow it first:

```bash
pnpm approve-builds
```

### 2. Build the AI helper

The recommendation feature requires a compiled Swift binary. Run this once after cloning:

```bash
pnpm build:native
```

This builds `electron/native/foundation-model-predictor/` and places the binary at `.build/release/FoodPredictor`.

### 3. Launch the app

```bash
pnpm electron:dev
```

This starts the Vite dev server and opens the Electron window.

## Connecting your UberEats account

1. Open **Settings** inside the app.
2. Paste your UberEats cookie header (must include `sid`, optionally `csrf_token`).
3. Click **Connect Session**.
4. Go to **Orders** and click **Sync from UberEats** to fetch your full history.

Your session credentials are stored locally in the app's user data folder (`~/Library/Application Support/ai-food-order` on macOS) and are never sent anywhere else. Use **Disconnect** in Settings to remove them.

## Available scripts

Run from the repository root:

| Command | Description |
|---|---|
| `pnpm electron:dev` | Start Vite + Electron in development mode |
| `pnpm electron:start` | Start Electron against a pre-built frontend |
| `pnpm build:native` | Compile the Swift Foundation Models helper |
| `pnpm test:electron` | Run Electron-side unit tests |
| `pnpm frontend:dev` | Start the Vite dev server on its own |

Run from the `frontend/` directory:

| Command | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript checks |

## Privacy

All data is stored locally in a SQLite database on your Mac. The AI prediction feature passes only compact, anonymised pattern summaries (top restaurants, common items, recency signals) to the on-device model — no raw order data or personal identifiers are included.

## Troubleshooting

- **Desktop service calls fail** – make sure you launched the app via `pnpm electron:dev`, not just `pnpm frontend:dev`.
- **Apple Intelligence unavailable** – check that Apple Intelligence is enabled in System Settings and that you are running macOS 26 on Apple Silicon.
- **Type or lint errors** – run `pnpm lint` and `pnpm type-check` from the repo root.
