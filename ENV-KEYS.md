# Vive twin — env keys

**Owned tree:** `/workspace/turner-health/vive-twin`  
**Updated:** 2026-09-10 ~12:00 PM ET — Convex functions re-synced (`bunx convex dev --once` PASS after TS fixes in dailyVector/objectives/protocolScheduler)

## Current wired status

| Item | Status |
|---|---|
| Client `.env.local` | **Present** — `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT=dev:colorless-bear-98` |
| Project | https://dashboard.convex.dev/t/brad-turner/vive/colorless-bear-98 |
| Deployment | `colorless-bear-98` (dev) |
| Convex CLI login | **Done** (device `vive-twin-box`) |
| Convex functions deploy | **Done** (re-synced 2026-09-10) — `bunx convex dev --once` at ~5:29 PM ET (indexes + betterAuth component) |
| Convex env | **`BETTER_AUTH_SECRET` set** · **`SITE_URL=http://127.0.0.1:5173` set** · `CONVEX_SITE_URL` is built-in (cannot override; client uses `VITE_CONVEX_SITE_URL`) |
| Shipper AI keys | **Intentionally unset** (do not set / do not call) |
| `bun run build` | **PASS** (vite, ~2330 modules) |

## Client (Vite — `.env.local`)

| Key | Value / notes |
|---|---|
| `VITE_CONVEX_URL` | `https://colorless-bear-98.convex.cloud` |
| `VITE_CONVEX_SITE_URL` | `https://colorless-bear-98.convex.site` |
| `CONVEX_DEPLOYMENT` | `dev:colorless-bear-98` |

Secret file on box (not committed): `/workspace/turner-health/vive-twin/.better-auth-secret.txt`

## Convex dashboard env (live)

| Key | Status |
|---|---|
| `BETTER_AUTH_SECRET` | set from `.better-auth-secret.txt` |
| `SITE_URL` | `http://127.0.0.1:5173` (local for now; update when public URL exists) |
| `CONVEX_SITE_URL` | built-in — do not set |

**Do not set** `SHIPPER_AI_URL` / `SHIPPER_AI_TOKEN`.

## Local preview

```bash
cd /workspace/turner-health/vive-twin
bun run dev   # → http://127.0.0.1:5173
# or: bun run build && bunx vite preview --host 127.0.0.1 --port 4173
```
