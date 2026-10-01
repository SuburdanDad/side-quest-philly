# Judgey (cheer/)

A self-contained Next.js 16 app, temporarily living inside side-quest-philly.
The root CLAUDE.md, DESIGN.md and portfolio-mode rules are for Side Quest and do
NOT apply here. Read `README.md` (code map) and `DESIGN.md` (visual rules) first.

- Domain logic stays pure in `src/`, with node:test coverage in `test/`; screens only compose it.
- Teams only: never store athlete names, photos or videos (minors).
- Voting stays positive: own-team block, top-N only, never publish bottom ranks.
- The product name comes from `src/brand.ts`; never hard-code it.
- Next.js 16: `params`/`searchParams` are Promises. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.
