# AI Food Order

A full-stack app for exploring UberEats order history and generating food-order insights with an AI-oriented dashboard experience.

## Repository Layout

- `frontend`: React + Vite + TypeScript dashboard UI.
- `electron`: Electron main/preload process for desktop shell.

## Frontend Features

The frontend includes route-based views for:

- `Dashboard`
- `Feed`
- `Orders`
- `Predictions`
- `Analytics`
- `Settings`

Authentication/session checks and all data operations are handled by Electron main-process services through secure IPC.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, React Router, React Query, TailwindCSS
- **Desktop services:** Electron main-process service layer (IPC)
- **Package manager:** pnpm

## Prerequisites

- Node.js 18+ (recommended)
- pnpm (or Corepack-enabled Node)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

If Electron is run for the first time and its postinstall was blocked, allow it:

```bash
pnpm approve-builds
```

### 2. Run the Electron desktop app in development mode

```bash
pnpm electron:dev
```

This starts Vite and launches Electron pointed at `http://localhost:3005`. The frontend calls desktop services via IPC (no HTTP backend required).

## Frontend Scripts

Run these inside `frontend`:

- `pnpm dev` - start Vite dev server
- `pnpm build` - production build
- `pnpm preview` - preview production build
- `pnpm lint` - run ESLint
- `pnpm type-check` - run TypeScript checks

## Root Scripts

Run these from the repository root:

- `pnpm backend:reload` - rebuild/restart backend container
- `pnpm frontend:dev` - run Vite frontend
- `pnpm electron:dev` - run desktop app (Vite + Electron)
- `pnpm electron:start` - start Electron against a built frontend (`frontend/dist`)

You can point Electron to a different backend URL with:

```bash
ELECTRON_API_URL=http://localhost:3001 pnpm electron:start
```

## Authentication Flow

The app now supports importing an UberEats web session directly:

- Go to `Settings` in the app
- Paste a valid UberEats cookie header containing `sid` (and optionally `csrf_token`)
- Click `Connect Session`, then use `Sync from UberEats` on the `Orders` page
- The UberEats session (`sid` / `csrf_token`) is saved under the app’s user data folder (e.g. `Application Support/ai-food-order` on macOS) and restored when you reopen the desktop app. The main process sets the app name from `package.json` so that path stays stable in development. Use **Disconnect** in Settings to clear it.
- Full history sync loads every page from Uber (`getPastOrdersV1`), passing `lastWorkflowUUID` from each response until there are no more orders; the Orders screen shows a progress bar while pages are fetched.

For Electron, this same flow can be automated by capturing cookies from an in-app Uber login window and POSTing them to `/api/uber/session/import`.

## Troubleshooting

- If desktop service calls fail, make sure you launched the app using Electron (`pnpm electron:dev`), not only Vite.
- If types or linting fail, run:
  - `pnpm lint`
  - `pnpm type-check`

