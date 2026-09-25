# Production Deployment Guide — AFF Demo Day Live Pitch OS

This guide details how to deploy the **AFF Demo Day Live Pitch** platform to production quickly and reliably.

---

## ⚡ Quickest Deployment Options (Choose Any)

### Option 1: Vercel (Recommended — Zero-Config, 1 Minute)
The repository includes a ready-to-use [`vercel.json`](file:///vercel.json) with security headers, PWA caching rules, and SPA rewrites.

1. Install Vercel CLI (or connect via GitHub on [vercel.com](https://vercel.com)):
   ```bash
   npm i -g vercel
   vercel --prod
   ```
2. Your app is live with SSL, global CDN, and automated preview branches.

---

### Option 2: Netlify (1 Minute)
The repository includes [`netlify.toml`](file:///netlify.toml) with caching and security headers.

1. Drag-and-drop the project folder to the [Netlify Drop](https://app.netlify.com/drop) dashboard, OR:
   ```bash
   npx netlify-cli deploy --prod --dir=.
   ```

---

### Option 3: Docker & Cloud Run (Enterprise Container Deployment)
The repository includes an ultra-lightweight [`Dockerfile`](file:///Dockerfile) (Alpine NGINX with Gzip, security headers, and health probes).

#### Test locally with Docker Compose:
```bash
docker compose up --build
# Visit http://localhost:8080
```

#### Deploy to Google Cloud Run:
```bash
# Build & deploy in one step
gcloud run deploy demo-day-app \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080
```

#### Deploy to Railway / Render / Fly.io:
Point your repository to Railway or Render; it will automatically detect either the `Dockerfile` or `server.js` (`npm start`).

---

### Option 4: GitHub Pages (Free Static Hosting)
The repository includes a GitHub Actions workflow in [`.github/workflows/ci-deploy.yml`](file:///.github/workflows/ci-deploy.yml).

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Production deployment setup"
   git push origin main
   ```
2. On GitHub: go to **Settings** → **Pages** → Source: **GitHub Actions**.
3. Every commit pushed to `main` will automatically validate tests and deploy.

---

## 🗄️ Supabase Production Setup (1-Time Step)

The application connects to Supabase for realtime event sync, passwordless sessions, and immutable responses.

1. Open your Supabase Project: **Dashboard → SQL Editor**.
2. Copy and run the entire contents of [`schema.sql`](file:///schema.sql).
3. This creates:
   - `demo_organisations` (Organisation links & master passcodes)
   - `demo_investors` (Passwordless attendee sessions)
   - `demo_responses` (Strictly immutable, idempotent responses)
   - `demo_event_state` (Authoritative single-row live state)
   - `interaction_feed` (High-throughput telemetry)
   - High-concurrency B-Tree indexes for 1,000+ concurrent investors.
   - Realtime publication enablement for `demo_responses`, `demo_investors`, and `demo_event_state`.

---

## 🔒 Environment & Configuration

Production runtime settings can be customized in [`config.js`](file:///config.js) or injected at runtime:

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "https://<your-project>.supabase.co",
  SUPABASE_ANON_KEY: "<your-anon-key>",
  DEFAULT_PASSCODE: "thatAff2026@",
  MAX_CONCURRENT_PITCHES: 15
};
```

---

## 🧪 Production Verification

Run the automated test suite before any live demo day event:

```bash
npm run validate
```
This runs:
- `npm test` — Core smoke test & file integrity checks.
- `npm run deploy:check` — Validates code syntax, JSON configs, container configs, and tests the local `/healthz` probe.

---

## 🌐 Live Event Route URLs

| Role | Hash Route | Description |
|---|---|---|
| **Organisation Portal** | `/#org` | Multi-event manager, direct link generator |
| **Investor App** | `/#investor` | Mobile-first voter interface |
| **Admin Command** | `/#admin` | Event conductor, live vote counts, stage publisher |
| **Main Stage** | `/#stage` | Public display (shows aggregated approved results only) |
| **UI Reference** | `/#references` | UI screen catalog |
