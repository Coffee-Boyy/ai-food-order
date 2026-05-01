# AI Food Order

A full-stack app for exploring UberEats order history and generating food-order insights with an AI-oriented dashboard experience.

## Repository Layout

- `frontend`: React + Vite + TypeScript dashboard UI.
- `backend`: Node-based API service (containerized) and UberEats integration docs/scripts.

## Frontend Features

The frontend includes route-based views for:

- `Dashboard`
- `Feed`
- `Orders`
- `Predictions`
- `Analytics`
- `Settings`

Authentication/session checks happen through `GET /api/auth/session`, and frontend API calls are proxied to the backend in local development.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, React Router, React Query, TailwindCSS
- **Backend:** Node.js service in Docker, UberEats session/API integration
- **Package manager:** pnpm

## Prerequisites

- Node.js 18+ (recommended)
- pnpm (or Corepack-enabled Node)
- Docker + Docker Compose

## Getting Started

### 1. Install frontend dependencies

```bash
cd frontend
pnpm install
```

### 2. Start/reload the backend service in Docker

From the repository root:

```bash
docker compose up -d --build backend
```

### 3. Run the frontend in development mode

```bash
cd frontend
pnpm dev
```

The frontend runs on `http://localhost:3005` and proxies `/api` requests to `http://localhost:3001`.

## Frontend Scripts

Run these inside `frontend`:

- `pnpm dev` - start Vite dev server
- `pnpm build` - production build
- `pnpm preview` - preview production build
- `pnpm lint` - run ESLint
- `pnpm type-check` - run TypeScript checks

## Backend Notes

- The backend container exposes port `3001` and includes a health endpoint at `/health`.
- Additional UberEats integration details are documented in `backend/UBER_API_DOCUMENTATION.md`.
- A backend test utility script exists at `backend/test-past-orders.js`.

## Authentication Flow

When no valid session is available, the app prompts users to create a session through the CLI-based UberEats auth flow, then refresh to continue.

## Troubleshooting

- If API calls fail from the UI, confirm backend is up:
  - `docker compose ps`
  - `docker compose logs backend`
- If frontend cannot connect to backend, verify backend is listening on `3001`.
- If types or linting fail, run:
  - `pnpm lint`
  - `pnpm type-check`

