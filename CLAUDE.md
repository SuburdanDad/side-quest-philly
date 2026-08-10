# Side Quest Philadelphia

Neighborhood scavenger hunt app for Philadelphia, tied to summer 2026 (FIFA World Cup + MLB All-Star Game).

**PORTFOLIO MODE (since 2026-08-10):** the Supabase backend (auth, cloud sync,
Postgres analytics, admin dashboards) is fully removed. Zero infrastructure, zero
env vars; all game state is localStorage. Do not re-introduce a database or
accounts without explicit direction. Season-era DB snapshot lives in
`~/General Queries/supabase-backups/2026-08-10/side-quest-philadelphia.json`.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-nova style)
- canvas-confetti for celebrations
- localStorage for ALL state (progress, photos, XP, achievements) — no accounts
- AI SDK v6 via Vercel AI Gateway (`anthropic/claude-haiku-4.5`) for photo verification
- Vercel Web Analytics for custom events

## Structure

- `lib/types.ts` — Core types (Objective, Neighborhood, QuestProgress)
- `lib/data/quests.ts` — All 45 objectives (9 neighborhoods x 5)
- `lib/data/neighborhoods.ts` — Neighborhood metadata + objective assembly
- `lib/data/secret-quests.ts` — Tim's Favorites (8 objectives, timf-*)
- `lib/data/chapters.ts` — Chapter II content wave (45 objectives, {prefix}2-NN)
- `lib/data/all-objectives.ts` — ALL_OBJECTIVES (98) + findObjective lookup; XP source of truth
- `scripts/gen-chapter-sql.ts` — generates wave migrations FROM chapters.ts (never hand-write rows)
- `lib/data/events.ts` — Summer 2026 event info
- `lib/hooks/use-quest-progress.ts` — localStorage hook with useSyncExternalStore
- `lib/hooks/use-photo-storage.ts` — photo proof store (PhotoEntry: dataUrl/verified/reason)
- `lib/photos/verification.ts` — pure AI-judge helpers (prompts, schema, clamping)
- `app/api/verify-photo/` — AI vision judge (graceful no-op without gateway creds); emits photo_verified/photo_rejected events server-side via @vercel/analytics/server
- `app/api/share-card/` — 1080x1920 IG Stories card (next/og)
- `app/leaderboard/` — City Legends board: local XP ranked against fixed legend rows (no accounts)
- `lib/analytics.ts` — custom events (anon id, first-touch ?src=, daily session_start) → Vercel Web Analytics track()
- `app/q/[slug]/` — QR deep links (307 → quest with src=qr-{slug})
- `app/posters/` — printable QR posters (master + 9 neighborhoods)
- `app/suggestions/` — static season-wrap page (form retired)
- `app/page.tsx` — Landing page (hero, events, neighborhood grid, ultimate CTA)
- `app/quest/[slug]/` — Individual neighborhood quest pages
- `app/ultimate/` — City-wide 10-objective ultimate quest

## Game economy (keep in sync!)

- XP: history 10 / culture 15 / entertainment 20 / food-beverage 25, **+5 per AI-verified photo**
- `calculateTotalXP` in `lib/gamification/xp.ts` over ALL_OBJECTIVES (98) is the single formula (no server mirror anymore)
- **Stamps = core 45 only** (NEIGHBORHOODS.objectives). Chapters/secret quests NEVER mint stamps.
- Milestone achievements (halfway-hero, completionist) count CORE completions only
- Photo achievements: shutterbug (5 verified), photo-journalist (15), city-documentarian (30)

## Adding a content wave (the repeatable pipeline)

1. Write objectives in `lib/data/chapters.ts` (new CHAPTER_III map; ids `{prefix}3-NN`, never reuse)
2. Wire into `all-objectives.ts` (ALL_OBJECTIVES + LOOKUP with quest context)
3. Render where appropriate (quest page section like ChapterTwoSection)
4. Update test/chapters.test.ts totals; run suite; ship. No leaderboard changes ever needed.
   (scripts/gen-chapter-sql.ts is a season-era relic — no DB to migrate anymore)

## Dev

```bash
npm run dev  # runs on port 3003
```

## Key Decisions

- Curated quest data is static TypeScript constants — the only source of truth
- Verification verdict events are emitted server-side only (verify-photo route) so clients can't forge photo_verified
- Progress stored in localStorage under key `sqp_progress`
- `useSyncExternalStore` for SSR-safe localStorage reads
- `generateStaticParams` pre-renders all 6 quest pages
- Next.js 16: `params` is a Promise — always `await params`
- shadcn base-nova style uses Base UI, not Radix — no `asChild` prop

@AGENTS.md

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
