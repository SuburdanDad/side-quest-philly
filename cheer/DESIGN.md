# Judgey Design System

Read this before any visual or UI decision in `cheer/`. (The root `DESIGN.md`
is for Side Quest Philly and does not apply here.)

## Direction: "Arena lights"

Judgey is used inside a dim arena, one-handed, holding a bow-covered bag
and a Starbucks. So the design is **dark-first, huge type, big hit targets**, and it
borrows its colors from the meet itself: the blue spring floor, the
pink-and-rhinestone bows, the gold trophies.

- Dark ink background in every theme. A bright white screen in a dark arena is
  rude to the people behind you.
- One dominant number per screen (the ETA, the countdown, the stars).
- Playful, never mean. Copy is warm and a little cheeky, like "Be a little judgey. Nicely."

## Color tokens (defined in `app/globals.css` `@theme`)

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0B14` | App background |
| `surface` | `#161625` | Cards |
| `surface-2` | `#20203A` | Raised / pressed cards, inputs |
| `line` | `#2E2E4D` | Hairlines, borders |
| `text` | `#F5F3FF` | Primary text |
| `muted` | `#A3A1C2` | Secondary text |
| `bow` | `#FF3D8B` | Primary actions, voting, brand |
| `mat` | `#2EC4FF` | Schedule, mats, "on the mat now" |
| `gold` | `#FFC83D` | Stars, awards, Crowd Favorites |
| `go` | `#3DDC97` | On time / ahead, success |
| `late` | `#FF8A3D` | Running behind |

Text on `bow` / `mat` / `gold` / `go` fills is `ink` (they're all light enough).
Never stack bow and mat in one gradient; each color has a job.

## Type

- **Display:** Anton (all caps for headlines, team numbers, countdowns). Athletic block lettering, like the back of a warm-up jacket.
- **Body/UI:** DM Sans 400/500/700.
- Countdown numbers: Anton, 64–96px, `tabular-nums`.

## Layout & components

- Mobile-first, max content width 480px centered, 16px gutters.
- Bottom tab bar (My Team · Mats · Favorites), 64px tall, safe-area padded.
- Hit targets ≥ 48px. Primary buttons are full-width, 56px, rounded-2xl.
- Cards: `surface`, rounded-3xl, 1px `line` border, no drop shadows (shadows disappear in a dark arena anyway).
- Status chips: pill, uppercase 11px bold, colored by meaning (mat / late / go / gold).
- Motion: short (150–250ms). Confetti only on a successful vote.
