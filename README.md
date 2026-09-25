# demo-day-app

Mobile-first startup demo investor response experience with immutable response recording, admin-controlled stage publishing, and Supabase cloud backend. Built for high-concurrency pitch sessions (1,000+ simultaneous attendees).

## Features

- **Investor Experience** — Mobile-optimized startup browsing and one-click immutable response recording
- **Admin Command Center** — Passcode-protected admin panel for event control, live response monitoring, and stage publishing
- **Organisation Portal** — Central hub for event configuration and custom direct link sharing
- **Live Stage** — Public projector display showing admin-approved aggregated results with zero raw vote leakage
- **Supabase Cloud Backend** — Real-time event state sync, persistent attendee tracking, and telemetry feed
- **Zero Data Loss & Offline-First** — Local outbox queue with auto-retry and resilient service worker

## Access Routes

| View | URL | Access |
|------|-----|--------|
| Organisation Portal | `/#org` | Event organizer portal |
| Investor App | `/#investor` (default) | Public attendee voting |
| Admin Command | `/#admin` | Passcode protected (`thatAff2026@`) |
| Live Stage | `/#stage` | Direct link only (projector view) |
| UI References | `/#references` | Direct link only |

## Tech Stack

- Vanilla HTML5 / Modern CSS / ES6+ JavaScript (zero build step)
- Supabase (Postgres with high-concurrency indexes + Realtime websockets)
- PWA-ready (Production Service Worker with offline caching + Web Manifest)
- Docker & NGINX with Gzip compression and HTTP/2 support

## Production Deployment

Detailed step-by-step instructions for Vercel, Netlify, Cloud Run, Docker, and GitHub Pages are in [**`DEPLOYMENT.md`**](file:///DEPLOYMENT.md).

### Quick Commands

```bash
# 1. Validate all production configs and tests
npm run validate

# 2. Run local production server
npm start
# Server starts at http://localhost:8080 (Health check: /healthz)

# 3. Deploy via Vercel
npx vercel --prod

# 4. Deploy via Docker Compose
docker compose up --build
```

## Supabase Database Setup

Run [`schema.sql`](file:///schema.sql) in your Supabase SQL editor to provision the tables, indexes, RLS policies, and realtime publications.
