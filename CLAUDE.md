# Side Quest Philadelphia

Neighborhood scavenger hunt app for Philadelphia, tied to summer 2026 (FIFA World Cup + MLB All-Star Game).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-nova style)
- canvas-confetti for celebrations
- Supabase Auth (magic link) + Postgres with RLS + Storage (`quest-photos` bucket)
- localStorage for guest progress, Supabase sync on auth
- AI SDK v6 via Vercel AI Gateway (`anthropic/claude-haiku-4.5`) for photo verification

## Structure

- `lib/types.ts` — Core types (Objective, Neighborhood, QuestProgress)
- `lib/data/quests.ts` — All 45 objectives (9 neighborhoods x 5)
- `lib/data/neighborhoods.ts` — Neighborhood metadata + objective assembly
- `lib/data/secret-quests.ts` — Tim's Favorites (8 objectives, timf-*)
- `lib/data/all-objectives.ts` — ALL_OBJECTIVES (53) + findObjective lookup; XP source of truth
- `lib/data/events.ts` — Summer 2026 event info
- `lib/hooks/use-quest-progress.ts` — localStorage hook with useSyncExternalStore
- `lib/hooks/use-photo-storage.ts` — photo proof store (PhotoEntry: dataUrl/verified/reason) + cloud sync on login
- `lib/photos/verification.ts` — pure AI-judge helpers (prompts, schema, clamping)
- `lib/photos/sync.ts` — Supabase Storage upload + user_progress photo columns
- `app/api/verify-photo/` — AI vision judge (graceful no-op without gateway creds)
- `app/api/share-card/` — 1080x1920 IG Stories card (next/og)
- `app/leaderboard/` — email-gated City Legends board (get_leaderboard RPC)
- `app/page.tsx` — Landing page (hero, events, neighborhood grid, ultimate CTA)
- `app/quest/[slug]/` — Individual neighborhood quest pages
- `app/ultimate/` — City-wide 10-objective ultimate quest

## Game economy (keep in sync!)

- XP: history 10 / culture 15 / entertainment 20 / food-beverage 25, **+5 per AI-verified photo**
- Client: `calculateTotalXP` in `lib/gamification/xp.ts` over ALL_OBJECTIVES (53)
- Server: `get_leaderboard()` Postgres fn mirrors the same formula — change both or neither
- Photo achievements: shutterbug (5 verified), photo-journalist (15), city-documentarian (30)

## Dev

```bash
npm run dev  # runs on port 3003
```

## Key Decisions

- All quest data is static TypeScript constants — no database needed
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
