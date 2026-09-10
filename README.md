# vive-twin

Owned local codebase for **Vive** — Brad Turner body / biology digital twin (Turner Health).

Source of truth overnight: Shipper **Vive 4.0** export (`d6de0e66-29d2-4cc8-bf84-dec39157e730`), promoted off Shipper into this tree. Not a MyFitnessPal clone.

## North star

Read **[../ONE-TWIN.md](../ONE-TWIN.md)** — one digital twin (Jarvis · Vive · Twin Ops · Link).

## Shipper rescue

- Project id: `d6de0e66-29d2-4cc8-bf84-dec39157e730` (Vive 4.0)
- Export zip: `../vive-4.0-export/vive-4-0-1788726084713.zip`
- Do not drive Shipper AI with drive-by prompts; Brad approves spend / publish

## Stack (from export)

- Vite + React 19 + TypeScript
- Convex (+ better-auth)
- TanStack Router / Query
- Tailwind CSS 4 + Radix UI

## Scripts

```bash
bun install
bun run dev
bun run build      # vite production build (passes)
bun run typecheck  # tsc -b — known Shipper TS debt (~245 errors)
bun run preview
```

## Hard rules

- No medical advice claims / invented clinical outcomes
- Personal twin workspace only

## Convex / env readiness

Build works without keys. For live data + auth, see **[ENV-KEYS.md](./ENV-KEYS.md)** (keys Brad provides later — do not invent).
