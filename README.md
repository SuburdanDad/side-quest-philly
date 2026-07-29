# 🔔 Side Quest Philadelphia

**An AI-verified scavenger hunt across 9 Philly neighborhoods — built for the summer the world came to Philadelphia.**

**Live: [side-quest-philly.vercel.app](https://side-quest-philly.vercel.app)** · No app, no signup — open it on your phone and walk.

> *"That's a beautiful Philly skyline, but we need YOU in the photo with the Liberty Bell!"*
> — the AI referee, rejecting a fake completion photo

Players complete real-world objectives (find Carpenters' Hall, order the roast pork at Tony Luke's, walk the Rail Park at golden hour), snap a photo as proof, and an AI judge — with the personality of a hyped Philly local — decides whether they actually did it. Verified photos earn bonus XP and feed a public leaderboard.

Built solo over ~4 weeks with [Claude Code](https://claude.com/claude-code) for the FIFA World Cup / MLB All-Star / America250 summer of 2026. Now maintained as a portfolio piece — fully playable.

---

## What's in the game

- **90 hand-curated objectives**: 9 neighborhoods × 5 core stops + a "Chapter II" bonus wave of 5 more each, plus a secret quest that unlocks after two neighborhood stamps and a city-wide Ultimate Quest
- **AI photo verification**: every photo is judged by `claude-haiku-4.5` (vision) against the *actual* objective — lenient like a friend, strict enough that a skyline photo doesn't pass for a Liberty Bell selfie
- **Game economy**: category-based XP, five levels (Tourist → Philly Native), 19 achievements, neighborhood stamps, +5 XP per verified photo
- **City Legends leaderboard**: email-gated (magic link), ranked by XP with verified-photo counts
- **Instagram Stories share cards**: 1080×1920 branded cards generated server-side with the player's photo and a gold "AI VERIFIED" stamp
- **QR distribution**: print-ready posters per neighborhood (`/posters`), deep links (`/q/{slug}`) with per-poster source attribution

## The engineering bits I'm proud of

**Unspoofable verification receipts.** The AI verdict and its analytics event share one server codepath — the client physically cannot claim a photo was verified. The objective is looked up server-side too, so you can't feed the judge an easier prompt.

**A game economy that provably can't drift.** XP is computed twice — client-side TypeScript and a Postgres `get_leaderboard()` function — from the same `objectives.category` data with identical expiry semantics. Stamps derive only from the core 45 objectives (`quests.counts_for_stamp`), so content waves and secret quests can never mint stamps or trigger false celebrations.

**Content waves as a pipeline, not a project.** `lib/data/chapters.ts` is the single source of truth; `scripts/gen-chapter-sql.ts` generates the DB migration from it, so TypeScript and SQL cannot disagree. Adding "Chapter III" is a content drop, not an engineering task.

**First-party analytics with a deny-all posture.** No analytics vendor. Events flow through an enrichment route (country via edge geo headers, device via UA) into Postgres via validated `SECURITY DEFINER` functions — the tables themselves accept no direct reads or writes. Admin dashboards (`/admin/funnel`, `/admin/visitors`) show conversion funnels, per-visitor histories, QR-vs-social attribution, and which objectives the AI judge rejects most (a built-in content-QA signal). Rate-limited, session-token-forwarded, expired-token-degrades-gracefully.

**Guest-first, sync-on-login.** Everything works with zero accounts: progress, photos (compressed client-side to ~100KB JPEGs), XP — all in localStorage. Sign in once and it all syncs to Postgres + Storage under RLS owner policies.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase (Postgres + RLS, Auth magic links, Storage) · Vercel AI SDK v6 via AI Gateway (OIDC — zero API keys to manage) · `next/og` for share cards & posters · Vitest (98 tests)

## Run it locally

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key
npm run dev                   # port 3003
```

AI verification degrades gracefully without gateway credentials — photos save as unverified. The full design system lives in `DESIGN.md`; agent-facing architecture notes in `CLAUDE.md`.

---

*Built with Instrument Serif, aged gold, and an unreasonable amount of love for Philadelphia.* 🥨
