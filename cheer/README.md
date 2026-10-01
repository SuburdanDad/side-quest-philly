# Mat Time (working name)

A cheer competition companion app. It gives parents live "when do we go on?" ETAs and lets spectators vote on routines in a
positive way.

> **Temporary home.** This project lives in the `side-quest-philly` repo for
> now and is fully self-contained (its own `package.json`, excluded from the
> root app's tsconfig, eslint and vitest). To migrate, copy `cheer/` to its own
> repo root. Nothing outside this folder depends on it.

- Design doc and roadmap: [`docs/office-hours-2026-10-01.md`](docs/office-hours-2026-10-01.md)
- `src/schedule.ts`: crowd "took the mat" taps → mat drift → team ETAs + countdown alerts
- `src/voting.ts`: own-team block, voting window, 1–5 stars + shout-outs, top-N Crowd Favorites

## Dev

Requires Node ≥ 22.6 (runs TypeScript natively, no build step).

```bash
cd cheer
npm install
npm test
npm run typecheck
```
