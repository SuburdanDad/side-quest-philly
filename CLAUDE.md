# Side Quest Philadelphia

Neighborhood scavenger hunt app for Philadelphia, tied to summer 2026 (FIFA World Cup + MLB All-Star Game).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (base-nova style)
- canvas-confetti for celebrations
- localStorage for progress (no backend)

## Structure

- `lib/types.ts` — Core types (Objective, Neighborhood, QuestProgress)
- `lib/data/quests.ts` — All 30 objectives (6 neighborhoods x 5)
- `lib/data/neighborhoods.ts` — Neighborhood metadata + objective assembly
- `lib/data/events.ts` — Summer 2026 event info
- `lib/hooks/use-quest-progress.ts` — localStorage hook with useSyncExternalStore
- `app/page.tsx` — Landing page (hero, events, neighborhood grid, ultimate CTA)
- `app/quest/[slug]/` — Individual neighborhood quest pages
- `app/ultimate/` — City-wide 10-objective ultimate quest

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
