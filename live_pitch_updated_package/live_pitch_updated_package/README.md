# Startup Demo — Updated Mobile-First Package

This package implements the updated workflow:

**Join → Startup List → Open Startup → Choose response → Database recording → Confirmation → Back to Startup List**

The investor does **not** navigate pitch-by-pitch using a live timer. The investor has the complete startup list and chooses startups directly.

## Response colors

- 🟢 Interested
- 🟡 Explore More
- 🔵 Not Interested
- ⚪ Not Responded

Once recorded, the response is immutable for that startup.

## Stage rule

The main stage is intentionally isolated from individual investor activity.

Investor response:

`Investor → Backend / Database`

Public stage:

`Admin review → Publish → Stage`

The stage never shows individual investor selections live.

## Run locally

### Option A — Python static server

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

### Option B — Node

Any static HTTP server can serve this folder.

## Demo behavior

The pure HTML build uses `localStorage` and `BroadcastChannel` for local persistence and multi-tab simulation. This is a front-end demo, not the authoritative production backend.

## Package contents

- `index.html` — application shell
- `styles.css` — mobile-first and desktop styling
- `app.js` — investor flow, immutable response simulation, admin, stage, persistence
- `schema.sql` — production-oriented PostgreSQL/Supabase schema
- `realtime-contract.json` — production event/command contract
- `manifest.webmanifest` / `sw.js` — installable/offline-friendly shell
- `assets/ui-reference/` — generated UI images from the design process
- `docs/` — architecture, API, flow, QA notes
- `supabase/` — deployment notes / RLS checklist
- `tests/` — scenario checklist

## Important production gap

The demo browser is intentionally not the security authority. Production must implement server-side authentication, RLS, immutable response insertion, idempotency, audit logging, and a separate stage-publish channel.
