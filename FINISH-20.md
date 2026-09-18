> **Ship lane locked (Brad GO 2026-09-18):** web prod now. App Store later. See `DEPLOY.md`.

# Vive twin — FINISH-20 (last ~20%)

**Owner:** Brad Turner / Turner Health personal twin  
**Written:** 2026-09-18 ~7:45 AM ET  
**Tree:** `/workspace/turner-health/vive-twin`  
**Hard rules:** no medical advice claims / invented clinical outcomes · personal twin only

---

## Audit snapshot (pre → post this run)

| Area | Before | After this run |
|------|--------|----------------|
| Home route `/` | Protocol OS only (full shell orphaned) | **ViewManager** shell (dashboard, Morning Brief, Quick Log, Visit Prep, BottomNav) |
| BottomNav | Linked to missing `/protocols` `/bio` `/journal` routes | **View-based** nav when shell provides `onNavigate` |
| Protocol OS data | Empty `protocols: []`, wrong query shape → blank map | Wired to `getBiomarkerProtocolMap` + `getAdherenceHistory30d` + **auto `seedDefaults`** |
| ProtocolsView session | Hardcoded `vive-user-001` | **`getTwinSessionId()`** |
| Auth demo path | Sign-in/up only | **Continue as guest →** |
| Auth CORS | localhost only in static list | + **127.0.0.1:5173/4173** (pushed to Convex) |
| Convex | Logged in; `colorless-bear-98` | Re-synced this run (`bunx convex dev --once` PASS) |
| Git remote | **None** | Still **none** — do not invent |
| Public host | None | Still Brad-only (Vercel/etc.) |

---

## Done (usable local/demo ship)

1. **Core shell reachable** — `/` mounts `ViewManager` (induction → dashboard → Morning Brief once/day, Orb, Cmd+K, Doctor Visit Prep via ExportUtility).
2. **BottomNav works inside shell** — Home / Protocols / Bio / Journal switch views (Bio still opens `/biovault` route when used outside shell).
3. **Protocol OS** usable as Protocols tab — seeds starter stack, shows category map + toggle completions, honest “not medical advice” strip.
4. **Auth** — email/password better-auth on Convex; guest continue; session bind (`user:<id>`) already present.
5. **Env** — client `.env.local` + Convex `BETTER_AUTH_SECRET` + `SITE_URL=http://127.0.0.1:5173` (see `ENV-KEYS.md`).
6. **Build** — `bun run build` (vite) — see status below / re-run.

---

## Remaining (ranked)

1. **Public URL / deploy** — no GitHub remote; no Vercel/Netlify project. Local only until Brad creates remote + host and updates Convex `SITE_URL` + trusted origins.
2. **Brad account smoke** — sign up once on `http://127.0.0.1:5173/signup`, confirm session bind + seeded protocols, Morning Brief, lab paste → BioVault, Visit Prep export.
3. **Wearables** — still **simulated demo** connect only (`useBiometricSync`); live OAuth needs Brad API keys + provider apps.
4. **Lab photo AI** — paste path works; photo extract stays Coming Soon (no Shipper AI keys — intentional).
5. **Shipper TS debt / typecheck** — do not boil ocean; fix only if a change blocks `bun run build`.
6. **One-twin converge** — Morning Brief ↔ Jarvis / Twin Ops / Link (`../ONE-TWIN.md`) — later, not ship blocker for Vive alone.
7. **Prod Convex** — still on `dev:colorless-bear-98`; promote to prod when Brad wants durable public.

---

## Exact Brad-only steps

1. **Local use now**
   ```bash
   cd /workspace/turner-health/vive-twin
   bun run dev
   # → http://127.0.0.1:5173
   # Guest: open /signin → “Continue as guest”
   # Or: /signup with email + password
   ```
2. **When you have a public URL** (you create host — agent must not invent remotes):
   - Convex dashboard → `colorless-bear-98` → set `SITE_URL=https://YOUR_HOST`
   - Redeploy functions / confirm better-auth CORS (static list + `SITE_URL`)
   - Optional: `bunx convex env set SITE_URL https://YOUR_HOST`
3. **GitHub (optional)** — create repo yourself, then:
   ```bash
   git remote add origin git@github.com:YOUR_ORG/vive-twin.git
   git push -u origin main
   ```
   Current: **`git remote -v` is empty** — leave empty until you add one.
4. **Do not set** `SHIPPER_AI_URL` / `SHIPPER_AI_TOKEN`.
5. **Wearable / Stripe / extra API keys** — only when you approve spend; document in `ENV-KEYS.md`, never invent.

---

## This run — shipped code

- `src/routes/index.tsx` — home → `ViewManager`
- `src/components/layout/BottomNav.tsx` — view callbacks
- `src/components/layout/ViewManager.tsx` — Protocols tab → Protocol OS; main bottom padding
- `src/components/ProtocolOperatingSystem.tsx` — real Convex map + seed + disclaimer language
- `src/components/Views/ProtocolsView.tsx` — twin session id
- `src/components/SystemAccess.tsx` — guest continue
- `convex/auth.ts` — 127.0.0.1 trusted origins (deployed)

---

## Build status

```
bun run build  →  PASS  (vite, ~1.57s, 2026-09-18 ~7:45 AM ET)
```

`bunx convex dev --once` → PASS (auth trusted origins redeployed).
