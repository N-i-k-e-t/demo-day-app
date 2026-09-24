# demo-day-app

Mobile-first startup demo investor response experience with immutable response recording, admin-controlled stage publishing, and Supabase cloud backend.

## Features

- **Investor Experience** — Mobile-optimized startup browsing and one-click immutable response recording
- **Admin Command Center** — Passcode-protected admin panel for event control, response monitoring, and stage publishing
- **Live Stage** — Public display with admin-approved result snapshots only
- **Supabase Integration** — Cloud-connected with realtime sync and persistent response storage
- **Direct Link Routing** — Pages accessible via URL hash (`#admin`, `#stage`, `#references`) — no exposed navigation buttons on mobile

## Access

| View | URL | Access |
|------|-----|--------|
| Investor | `/#investor` (default) | Public |
| Admin | `/#admin` | Passcode protected |
| Stage | `/#stage` | Direct link only |
| References | `/#references` | Direct link only |

## Tech Stack

- Vanilla HTML/CSS/JS (zero build step)
- Supabase (Postgres + Realtime)
- PWA-ready (service worker + manifest)
- Mobile-first responsive design

## Quick Start

1. Open `index.html` in any browser
2. Or deploy to any static hosting (GitHub Pages, Vercel, Netlify)

## Supabase Setup

The app connects to Supabase automatically. Run `schema.sql` in your Supabase SQL editor to set up the database tables.
