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
| `/` | Check-in: "Which squad are you here to see?" (or "I'm just here to cheer"). Reads `?meet=` (QR / group-chat links), `?src=` (first touch) and `?op=` (operator code, claimed once and stripped from the URL). No `?meet=`: the meet this phone picked before, else the demo |
| `/meet` | My Team: ETA countdown and the absolute time, drift, 60/20/5-min heads-ups, skipped/scratched notices, "Send to another parent" share link, open votes, mats at a glance |
| `/meet/mats` | Running order per mat; "&lt;Team&gt; just took the mat" tap (with an offline outbox), "Someone else on the mat?" for swaps, "last confirmed h:mm" when a mat goes quiet; Start now / Clear / Scratch for operators |
| `/meet/vote/[teamId]` | 1–5 stars + shout-outs; own-team block; voting window countdown. Dynamic route: the team is resolved on the client |
| `/meet/favorites` | Crowd Favorites (top half, max 5) per revealed division, shout-out winners, private recaps for your teams |

## Demo and live mode

**Demo (zero config).** With no env vars the app runs a fictional meet with a
**simulated crowd** (`src/demo/crowd.ts`) that taps teams onto the mat and
votes by the real rules, driven by the meet clock. Tap the `DEMO` clock pill in
the header to pause, run at 1× / 10× / 60×, restart, or change teams. Nothing
leaves the phone (`lib/sources/demo.ts`, state in `lib/store.ts`).

**Live.** Copy `.env.example` to `.env.local` and set:

| Variable | |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | New-style `sb_publishable_…` key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional. Anonymous sign-in then sends a Turnstile token |

Then open `/?meet=<id>` for a meet imported with `npm run import:meet`. Phones
poll one public snapshot (`meet_snapshot`, every 15 s ± 3 s while visible) and
sign in anonymously only when they check in, tap or vote. The ETA never waits
on sign-in, and the last known times are cached per meet for bad arena signal.
Operators open `/?meet=<id>&op=<code>`. Contract: `docs/backend-spec.md`.

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
npm test           # domain + client-core tests (node:test)
npm run typecheck
npm run lint
npm run build
```
