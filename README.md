# AI Product Finder — Offline POC

This repository contains a React/Vite frontend and a Node.js backend. Chat answers are retrieved from the active local JSON corpus; the normal runtime does not call Bedrock or external document services.

## Prerequisites

- Node.js 20 or newer
- npm

## First-time setup

From the repository root:

```powershell
npm --prefix Backend install
npm --prefix Frontend install
Copy-Item Backend/.env.example Backend/.env
```

If `Backend/.env` already exists, keep it. For the offline POC, ensure `CHAT_MODE=offline`.

## Verify the active corpus

```powershell
npm --prefix Backend run smoke:offline
```

The command checks active artifact loading, exact retrieval, safe no-match behavior, HTTP readiness, and the WebSocket chat lifecycle without external model calls.

## Run the demo

Start the backend in one terminal:

```powershell
npm --prefix Backend start
```

Start the frontend in another terminal:

```powershell
npm --prefix Frontend run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/ws` to the backend at `127.0.0.1:3000`.

## Validate changes

```powershell
npm --prefix Backend test
npm --prefix Frontend test
npm --prefix Frontend run lint
npm --prefix Frontend run build
```

## Corpus workflow

Generation and POC review instructions are documented in `Backend/GENERATION.md`. Generated drafts remain outside the runtime until a reviewed immutable release is explicitly published and activated.
