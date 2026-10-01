# Office Hours: Cheer Ecosystem (Judgey)

**Date:** 2026-10-01 · **Status:** design approved for v1 · **Test target:** a real meet ~2 months out (early Dec 2026)

## The pitch in one line

Cheer meets are 8+ hour days for a 2.5-minute routine. Judgey tells every
parent exactly when their team goes on, and turns the hours in between into a
fun, positive crowd experience.

## What we learned (founder answers)

| Question | Answer | What it means |
|---|---|---|
| Your connection to cheer? | Parent of an athlete | We know the parent's pain first-hand and can reach a gym's parent group chat on day one. We don't have event-producer access yet, so v1 must work **without the producer's cooperation**. |
| First problem to fix? | "When do we go on?" | Parents are the wedge. Fan voting rides along on the same live signal. |
| Voting style? | Mostly positive reactions, plus some scoring. Ask "which squad are you here to see?" and block voting for your own team: *"To keep it fair, you can't vote for your own team. We know you think they're perfect."* | Built into `src/voting.ts`. |
| A real meet to test at? | Yes, within ~2 months | That date is the deadline. Everything below is scoped to be ready for it. |

## The problem, specifically

1. **The schedule is a lie by 10am.** Producers publish a running order (PDF or
   their own app), but mats drift 15–60 minutes behind (sometimes ahead). Parents
   either camp in the bleachers all day or risk missing the routine they paid
   $1,000s in travel and fees to see.
2. **The dead time is enormous.** Most of the crowd is there for one team and is
   bored or on their phones for every other routine.
3. **The sport has almost no fan layer.** No crowd voting, no shareable moments, no reason
   to watch a team that isn't yours. That's where cheer's popularity is capped.

## The key insight: one tap does two jobs

Someone in the stands taps **"They just took the mat"** for a team. When two or
more devices agree (median time, outliers ignored):

- **Parents:** the mat's drift updates and every later team's ETA shifts by
  the same amount ("Mat 2 is running 18 min behind, Stingrays now ~11:42").
  Countdown alerts go out at 60/20/5 minutes.
- **Fans:** the voting window opens for that routine (closes 10 min after).

This means **we don't need the event producer's data feed** to start. We only need the
published running order (typed in, or pasted from the PDF) plus a crowd that's
already looking at its phones. Producer integration becomes an upgrade, not a
blocker.

## Voting design (positive by design)

- **Check-in:** "Which squad are you here to see?" (can pick more than one, e.g. siblings).
- **Own-team block** with the friendly message above.
- **1–5 stars + optional shout-outs:** Best Stunts, Best Tumbling, Most Spirit, Best Dance.
- **Only the top 5 Crowd Favorites are ever published.** No bottom ranks, no
  public per-team averages. Each team can see its own recap privately ("212 fans cheered for you,
  41 picked you for Best Stunts").
- **Fairness:** one ballot per device per routine; Bayesian-smoothed rating so 3
  five-star votes can't beat 200 strong votes; a minimum vote count to qualify;
  shout-out winners judged by share of voters, not raw count, so big gyms
  with lots of parents don't automatically win.
- **Never competes with the judges.** It's framed as "the crowd's favorites",
  not a score, and shown after the division's routines finish, not during
  awards.

## The ecosystem (the roadmap, in order)

1. **Parents (v1, the meet in December):** follow your team, live ETA,
   countdown alerts, "now on Mat 2" board. *This is the wedge.*
2. **Fans (v1, alongside):** check-in, own-team block, stars + shout-outs,
   Crowd Favorites board, shareable "Crowd Favorite" card (like our IG
   Stories share card in Side Quest).
3. **Event producers (v2):** a QR code on the arena screens, an official
   running-order import, a "Crowd Favorite" award they can hand out on stage. This is the
   distribution unlock and the eventual business model (white-label per
   event).
4. **Gyms & athletes (v3):** team pages, season recaps, Crowd Favorite
   history, badges like our Side Quest achievements. **Team-level only** until
   we have parental-consent flows (see risks).

## Risks and premises to test

- **Minors.** Most athletes are under 18 (COPPA applies under 13). v1 stores
  no athlete names, faces, or videos, only teams, gyms, and divisions. Anything
  athlete-level needs a parental-consent design first.
- **Incumbents.** Varsity Spirit runs most major events and has its own
  app and streaming service. We win at independent and regional producers first, and by being
  the crowd's tool, not the producer's.
- **Arena connectivity.** Arenas are notoriously bad for signal. The client
  must cache the running order offline and queue taps/ballots to send when back online.
- **Tap griefing.** Wrong-team or early taps are filtered (needs 2+ devices,
  median, early-tap cutoff). Watch the real data at the meet.
- **Premise to prove at the meet:** *at least 15 parents use the ETA more than
  once, and at least one tells another parent about it unprompted.*

## Architecture (decided for v1)

- Lives in `cheer/` in the side-quest-philly repo for now, fully separate
  from the Side Quest app (own `package.json`, excluded from the root tsconfig,
  eslint and vitest). Move it to its own repo by copying the folder.
- `src/schedule.ts` and `src/voting.ts`: pure, tested domain logic (done).
- Next: a mobile-first Next.js web app (no app-store install, open by QR code), plus a
  realtime backend for taps and ballots. **This one genuinely needs a server**,
  unlike Side Quest's portfolio mode, because a crowd shares state. Supabase
  Realtime is the obvious pick since we've shipped with it before.

## Assignment before the meet

1. Get the meet's published running order (PDF) and enter one division by hand.
2. Ask 5 parents in your gym's group chat: *"If an app told you when your
   team was actually going on, would you use it at the meet?"* Write down the exact words they use.
3. Find out who the event producer is, and whether they'd let us put a QR on
   the screen or at the entrance (bonus, not required).
