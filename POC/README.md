# AI Product Finder — Offline POC

A standalone product-finder demo that runs entirely from local JSON. Runtime has no Bedrock client, API key, embedding service, database, or external document fetch.

## Included

- React/Vite chat UI
- Node.js HTTP and WebSocket backend
- 979-product catalog
- 879 approved product answers
- 6,879 approved question variants
- Exact, product/FGMN, lexical, bounded-fuzzy, conversation-context, and safe no-match handling

## Requirements

- Windows PowerShell
- Node.js 20.6 or newer
- npm

## Quick start

Open PowerShell in this `POC` folder:

```powershell
.\start-demo.ps1
```

The start script automatically installs dependencies on first use, verifies the local corpus, launches the backend, waits for the expected release, and opens `http://localhost:5173`. Press `Ctrl+C` to stop it.

If port 3000 or 5173 is already occupied, stop the older backend/frontend process first. The launcher deliberately refuses to connect to a stale server.

## Manual start

Install once:

```powershell
npm --prefix Backend ci
npm --prefix Frontend ci
```

Run in separate terminals:

```powershell
npm --prefix Backend start
```

```powershell
npm --prefix Frontend run dev
```

Open `http://localhost:5173`.

## Verification

```powershell
npm --prefix Backend run smoke
npm --prefix Frontend test
npm --prefix Frontend run lint
npm --prefix Frontend run build
```

The backend smoke test checks corpus loading, exact retrieval, safe no-match behavior, HTTP readiness, and the complete WebSocket chat lifecycle.

## Documentation

- `ARCHITECTURE.md` — simplified runtime design and request flow
- `DEMO_SCRIPT.md` — presenter walkthrough and suggested questions

## Important POC limitation

This corpus is for demonstration. Generated answers passed automated schema, evidence-number, reference, and conflict validation, but did not receive production-grade domain review. Products without an approved generated answer use a deterministic catalog description.
