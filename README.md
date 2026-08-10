# 🔔 Side Quest Philadelphia

**An AI-verified scavenger hunt across 9 Philly neighborhoods — built for the summer the world came to Philadelphia.**

**Live: [side-quest-philly.vercel.app](https://side-quest-philly.vercel.app)** · No app, no signup — open it on your phone and walk.

> *"That's a beautiful Philly skyline, but we need YOU in the photo with the Liberty Bell!"*
> — the AI referee, rejecting a fake completion photo

Players complete real-world objectives (find Carpenters' Hall, order the roast pork at Tony Luke's, walk the Rail Park at golden hour), snap a photo as proof, and an AI judge — with the personality of a hyped Philly local — decides whether they actually did it. Verified photos earn bonus XP toward City Legend status.

Built solo over ~4 weeks with [Claude Code](https://claude.com/claude-code) for the FIFA World Cup / MLB All-Star / America250 summer of 2026. Now preserved in **portfolio mode**: the season's backend (accounts, live leaderboard, analytics pipeline) has been retired and the game runs on zero infrastructure — fully playable, forever, with nothing to maintain.

---

## What's in the game

- **90 hand-curated objectives**: 9 neighborhoods × 5 core stops + a "Chapter II" bonus wave of 5 more each, plus a secret quest that unlocks after two neighborhood stamps and a city-wide Ultimate Quest
- **AI photo verification**: every photo is judged by `claude-haiku-4.5` (vision) against the *actual* objective — lenient like a friend, strict enough that a skyline photo doesn't pass for a Liberty Bell selfie
- **Game economy**: category-based XP, five levels (Tourist → Philly Native), 19 achievements, neighborhood stamps, +5 XP per verified photo
- **City Legends leaderboard**: race Ben Franklin, Betsy Ross, and Rocky for the top spot — your rank computed live from your local XP
- **Instagram Stories share cards**: 1080×1920 branded cards generated server-side with the player's photo and a gold "AI VERIFIED" stamp
- **QR distribution**: print-ready posters per neighborhood (`/posters`), deep links (`/q/{slug}`) with per-poster source attribution

## The engineering bits I'm proud of

**Unspoofable verification receipts.** The AI verdict and its analytics event share one server codepath — the client physically cannot claim a photo was verified. The objective is looked up server-side too, so you can't feed the judge an easier prompt.

**Local-first meant deletable-backend.** From day one, progress, photos (compressed client-side to ~100KB JPEGs), and XP lived in localStorage, with accounts and cloud sync as a layer on top. When the season ended, that layer unbolted cleanly: the Supabase runtime (auth, sync, Postgres analytics, admin dashboards) came out without touching gameplay — all 98 tests passed unmodified. The app now runs on zero infrastructure and zero env vars.

**Content waves as a pipeline, not a project.** `lib/data/chapters.ts` is the single source of truth for all 90 objectives — TypeScript data, no database. Adding "Chapter III" is a content drop, not an engineering task.

**Season-scale analytics, then vendor-scale.** During the live season, events flowed through a first-party enrichment route into Postgres via validated `SECURITY DEFINER` functions, feeding admin funnels and per-visitor histories. Portfolio mode keeps the same event taxonomy (`quest_start`, `objective_complete`, `photo_verified`…) and first-touch `?src=` attribution, but ships it to Vercel Web Analytics — no backend, same signal.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · localStorage (all game state) · Vercel AI SDK v6 via AI Gateway (OIDC — zero API keys to manage) · Vercel Web Analytics · `next/og` for share cards & posters · Vitest (98 tests)

## Run it locally

```bash
npm install
npm run dev   # port 3003 — no env vars needed
```

AI verification degrades gracefully without gateway credentials — photos save as unverified. (Set `AI_GATEWAY_API_KEY` to exercise the judge locally; deployments authenticate via OIDC automatically.) The full design system lives in `DESIGN.md`; agent-facing architecture notes in `CLAUDE.md`.

---

*Built with Instrument Serif, aged gold, and an unreasonable amount of love for Philadelphia.* 🥨
