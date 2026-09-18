# Vive twin — web prod deploy (Brad GO 2026-09-18)

Ship lane: **web prod now**. App Store later.  
Agents: prepare tree + drafts only. **No push / publish / spend** until Brad supplies GitHub remote URL and approves the Vercel card.

Local checkpoint: `main` @ `900937e` (+ uncommitted polish). Convex today: `dev:colorless-bear-98`.

---

## Exact Vercel project settings (for Brad)

| Setting | Value |
|---|---|
| Framework preset | **Vite** |
| Root directory | repo root of `vive-twin` (or monorepo subpath `vive-twin` if parent is the GitHub root) |
| Install command | `bun install` (or `npm install` if Bun unavailable on plan) |
| Build command | `bun run build` |
| Output directory | `dist` |
| Node | 20.x (if asked) |
| SPA rewrites | use committed `vercel.json` (all routes → `/index.html`) |

### Vercel Environment Variables (Production)

| Name | Value |
|---|---|
| `VITE_CONVEX_URL` | Production Convex URL `https://<prod>.convex.cloud` |
| `VITE_CONVEX_SITE_URL` | Production Convex site `https://<prod>.convex.site` |

Do **not** put `BETTER_AUTH_SECRET` in Vercel — that stays on **Convex** only.  
Do **not** set Shipper AI keys.

### Convex production env (Dashboard)

| Name | Value |
|---|---|
| `BETTER_AUTH_SECRET` | New strong secret (or copy from box `.better-auth-secret.txt` — never commit) |
| `SITE_URL` | Exact public origin, e.g. `https://vive-xxxx.vercel.app` (no trailing slash) |

Create/use a **production** Convex deployment — do not treat `colorless-bear-98` (dev) as prod for public users.

---

## Brad click path

1. Create private GitHub repo → paste URL to ViveCoder / Jarvis.  
2. Approve agent: `git remote add origin <url>` + push `main` (or PR).  
3. Vercel → New Project → import that repo → settings table above → Add env vars → Deploy.  
4. Copy Vercel URL → Convex prod `SITE_URL` → save.  
5. Smoke on public URL: signup → food text → vitals → lab paste → Morning Brief → Visit Prep.

---

## Secrets hygiene (verified)

`.gitignore` includes: `.env`, `.env.local`, `.env.*.local`, `.better-auth-secret.txt`  
`git ls-files` has **no** tracked secrets.

---

## Local (still)

```bash
cd /workspace/turner-health/vive-twin
bun run dev   # http://127.0.0.1:5173
```

See `FINISH-20.md` + `ENV-KEYS.md`.
