# Anu Spirits — LCBO Tracker Web

Next.js 16 frontend for the Anu Spirits LCBO CRM. Mobile-first, PWA-installable,
talks to the Flask backend at [lcbo-tracker.onrender.com](https://lcbo-tracker.onrender.com).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript**, strict mode
- **Tailwind CSS 4** + custom design tokens (Anu brand: deep navy, burgundy accent, gold highlight)
- **Tanstack Query** for data fetching + cache
- **shadcn/ui-style primitives** (components/ui/*)
- **Leaflet + OpenStreetMap** for the store map (free tiles, no API key)
- **Recharts** (ready for Sprint 2 drill-downs)
- **lucide-react** icons
- **Sonner** for toasts
- **Service Worker** with stale-while-revalidate cache for `/api/*` GETs

## Local development

```bash
bun install
bun run dev
# => http://localhost:3000
```

Set the backend URL if needed (defaults to production Render):

```bash
echo 'NEXT_PUBLIC_API_BASE=http://localhost:5050' > .env.local
```

## Pages

- `/` Dashboard (KPIs, tracked-SKU rollup, recent changes, territory breakdown)
- `/sod` SOD Live status + force-refresh
- `/oos` OOS risk watch (critical/high/medium severity)
- `/opportunities` Replace-slow-mover opportunity finder
- `/map` Leaflet map colored by territory
- `/territories` Territory grid
- `/reports` Daily / Weekly (Mon-Sun) / Monthly reports
- `/reps` Rep performance scoreboard
- `/goals` Sales goal progress
- `/horeca` On-premise accounts CRM
- `/stores/[storeNumber]` Store drill-in
- `/skus/[sku]` SKU drill-in

## Deploy to Vercel (one-click)

1. Go to https://vercel.com/new
2. Import Git Repository → select `ikshitgargi-ai/lcbo-tracker-web` → Deploy.
3. Vercel auto-detects Next.js; no env vars required for defaults.

Optional env vars:

- `NEXT_PUBLIC_API_BASE` — backend URL (defaults to production Render).

## Production backend CORS

The Flask backend allows these origins by default:

- `http://localhost:3000` / `http://localhost:3001` (dev)
- `https://lcbo-tracker-web.vercel.app` (Vercel default)
- `https://lcbo.anu-spirits.com` (custom domain, if configured)

To allow more, set `CORS_ORIGINS=comma,separated` on Render.

## PWA install

On mobile Safari or Chrome: Share → "Add to Home Screen." Icons come from
`/public/manifest.json` (the `icon-192.png` / `icon-512.png` are placeholders
for now — drop your real icons there to finish branding).

## Service worker

- **Install**: precaches the app shell (all routes).
- **Fetch**: stale-while-revalidate for `/api/*` GETs (offline reads work).
- **Never cached**: mutations like `/api/sod/sync` and `/api/sod/refresh-snapshot`.

## Structure

```
app/                      # file-based routes
components/
  ui/                     # shadcn-style primitives
  app-shell.tsx           # responsive sidebar + hamburger nav
  providers.tsx           # TanQuery + Toaster + SW register
  freshness-banner.tsx    # is_stale banner w/ one-tap force-refresh
  store-map.tsx           # Leaflet map (dynamic import)
  sw-register.tsx         # client SW registration
lib/
  api.ts                  # typed fetch client for Flask backend
  utils.ts                # cn(), formatters, status helpers
public/
  manifest.json
  sw.js                   # service worker
```

## Roadmap

- **Sprint 0** (backend): data correctness bugs fixed — snapshot freshness,
  rep-gap SQL, Mon-Sun weekly windows, multi-day SOD walkback, orphan cleanup.
  12 pytest assertions. (done)
- **Sprint 1** (this repo): mobile-first Next.js frontend + PWA. (done)
- **Sprint 2**: auth (Clerk), drill-down time-series charts, WoW comparisons,
  saved views, bulk actions, Excel export, Slack alerts, GPS mobile workflow,
  Claude-powered NL assistant.
- **Sprint 3**: Mapbox GL upgrade with clustering + heatmap, OR-tools TSP
  route optimizer, forecast panel, photo + voice-note check-ins.
