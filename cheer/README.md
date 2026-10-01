# Judgey

*Be a little judgey. Nicely.* A cheer competition companion: live "when do we
go on?" ETAs for parents, and positive real-time fan voting for everyone in the
stands.

> **Temporary home.** This project lives in the `side-quest-philly` repo for
> now and is fully self-contained (its own `package.json`, excluded from the
> root app's tsconfig, eslint and vitest). To migrate, copy `cheer/` to its own
> repo root. Nothing outside this folder depends on it.

- Design doc and roadmap: [`docs/office-hours-2026-10-01.md`](docs/office-hours-2026-10-01.md)
- Visual design: [`DESIGN.md`](DESIGN.md)
- The product name lives in one place: `src/brand.ts`

## Screens (mobile-first)

| Route | What it does |
|---|---|
| `/` | Check-in: "Which squad are you here to see?" (or "I'm just here to cheer") |
| `/meet` | My Team: live ETA countdown, drift, 60/20/5-min alerts, open votes, mats at a glance |
| `/meet/mats` | Running order per mat with live ETAs; "They just took the mat" tap |
| `/meet/vote/[teamId]` | 1–5 stars + shout-outs; own-team block; voting window countdown |
| `/meet/favorites` | Top-5 Crowd Favorites, shout-out winners, private recap for your teams |

## Demo mode

There's no backend yet. The app runs a fictional meet with a **simulated
crowd** (`src/demo/crowd.ts`) that taps teams onto the mat and votes, all
driven by the meet clock. Tap the `DEMO` clock pill in the header to pause,
run at 1× / 10× / 60×, restart, or change teams. This device's own taps, ballots
and check-in are kept in localStorage (`lib/store.ts`); that store is where the
realtime backend plugs in.

## Code map

- `src/`: pure, tested domain logic (no React)
  - `schedule.ts`: crowd taps → confirmed starts → mat drift → ETAs + alerts
  - `voting.ts`: own-team block, voting window, Bayesian tally, top-N favorites
  - `board.ts`: per-mat view (on the mat, up next, open votes) for the screens
  - `demo/`: fictional meet, simulated crowd, demo clock
- `lib/`: client store + `useMeet()` hook (merges device state with the crowd)
- `components/`, `app/`: Next.js 16 App Router screens

## Dev

Requires Node ≥ 22.6 (tests run TypeScript natively).

```bash
cd cheer
npm install
npm run dev        # http://localhost:3004
npm test           # domain tests (node:test)
npm run typecheck
npm run lint
npm run build
```
