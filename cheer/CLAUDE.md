# Judgey (cheer/)

A self-contained Next.js 16 app, temporarily living inside side-quest-philly.
The root CLAUDE.md, DESIGN.md and portfolio-mode rules are for Side Quest and do
NOT apply here. Read `README.md` (code map) and `DESIGN.md` (visual rules) first.

- Domain logic stays pure in `src/`, with node:test coverage in `test/`; screens only compose it.
- Teams only: never store athlete names, photos or videos (minors).
- Voting stays positive: own-team block, top-N only, never publish bottom ranks.
- The product name comes from `src/brand.ts`; never hard-code it.
- Next.js 16: `params`/`searchParams` are Promises. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Client architecture (lib/)

- Screens read one `MeetView` from `useMeet()` (`lib/meet-view.ts`), the same shape in demo and live mode. `useMeet()` always calls both `useDemoSource()` and `useLiveSource()` and picks by the device's selected meet; never call hooks conditionally.
- `lib/live-core.ts` is the pure half of live mode (RPC JSON ↔ domain, snapshot merging, clock offset, freshness, outbox and cadence decisions, reason copy). It uses relative `.ts` imports and is tested by `test/live-core.test.ts`; keep React, `next/*` and supabase-js out of it.
- `lib/sources/live.ts` only does timers and I/O around live-core: one external store per meet, cached in `localStorage` as `judgey_live_<meetId>`. `lib/supabase.ts` is the only file that talks to Supabase (lazy clients; `meet_snapshot` never waits on sign-in).
- `lib/store.ts` holds device-level state only (`judgey_v2`): selected meet, local-first check-ins, first-touch src, dismissed alerts, the tap outbox, demo state and clock. Server data never goes there.
- The React Compiler lint rules are on: no `Date.now()`/`Math.random()` in render (use `view.now`), and no synchronous `setState` in effects.
