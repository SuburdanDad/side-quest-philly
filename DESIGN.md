# Design System — Side Quest Philadelphia

## Product Context
- **What this is:** Mobile-first scavenger hunt app for Philadelphia, tied to the 250th anniversary of America's founding, FIFA World Cup 2026, and MLB All-Star Game
- **Who it's for:** Tourists visiting for events, content creators, Philly locals rediscovering their city
- **Space/industry:** City exploration / gamification. Comps: Let's Roam, Geocaching, geosports.app, 82-0.com
- **Project type:** Mobile-first web app (PWA). Users are walking around outside, on their phones.
- **Memorable thing:** "This city is more than you think." Discovery, surprise, layers. Not a guidebook. Not hype.

## Aesthetic Direction
- **Direction:** Editorial/Magazine meets Refined
- **Decoration level:** Intentional. Skyline silhouette, subtle star-field texture on hero, gold accents as signature. No stock photos, no generic illustrations.
- **Mood:** A beautifully designed city guide that reveals itself layer by layer, like the city itself. The visual language of a high-end travel magazine, compressed for mobile. Confident, not loud.
- **Key risks (deliberate departures from category):**
  1. Serif display font in a category dominated by geometric sans-serifs
  2. Deep navy primary instead of bright/white backgrounds

## Typography
- **Display/Hero:** Instrument Serif — a modern serif with personality. Anchors the 250th anniversary weight. Not every app uses a serif for headlines; that's exactly why this works.
- **Body:** DM Sans — clean, geometric, excellent readability on mobile. Not overused.
- **UI/Labels:** DM Sans (same as body, 600 weight for emphasis)
- **Data/Tables:** Geist (already loaded via Next.js) — tabular numbers for progress indicators and counters
- **Code:** Geist Mono (already loaded)
- **Loading:** Google Fonts for Instrument Serif and DM Sans (`<link>` in layout.tsx). Geist family loaded via next/font.
- **Scale:**
  - Display: 38px / 2.375rem (hero title)
  - H1: 28px / 1.75rem (page titles)
  - H2: 20px / 1.25rem (section headers)
  - Body: 14px / 0.875rem
  - Small: 12px / 0.75rem
  - Caption: 11px / 0.6875rem
  - Micro: 10px / 0.625rem (category badges, stat labels)

## Color
- **Approach:** Restrained with a signature accent. Color is rare and meaningful.
- **Primary (navy):** #0F1D36 — deep Philadelphia navy, the night sky over the city. Used for hero background and primary text emphasis.
- **Accent (gold):** #C9A84C — aged gold, like the lettering on Independence Hall. Used for: "Philadelphia" title, fun-fact boxes, progress ring fill, completed checkboxes, achievement stamps.
- **Surface (parchment):** #F7F5F0 — warm parchment, a nod to the Declaration. Main content background.
- **Card:** #FFFFFF — white cards on parchment surface.
- **Text:** #1A1A1A — near-black for body text.
- **Muted:** #6B6B6B — secondary text, taglines, descriptions.
- **Border:** #E5E2DC — warm border on parchment.
- **Patriotic red:** #B22234 — used sparingly: top stripe, badges only.
- **Patriotic blue:** #3C3B6E — used sparingly: top stripe only.
- **Category colors:**
  - History: #B45309 (amber)
  - Culture: #7C3AED (violet)
  - Entertainment: #0891B2 (cyan)
  - Food & Drink: #DC2626 (red)
- **Dark mode:** The hero IS the dark mode. Content area stays light (parchment). No full dark mode toggle needed.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable on mobile. Not cramped, not wasteful.
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Card padding:** 14px (3.5 * base)
- **Card gap:** 8px (2 * base) between stacked cards
- **Section gap:** 24-32px between major sections

## Layout
- **Approach:** Single-column mobile-first
- **Max content width:** 448px (max-w-lg)
- **Grid:** Single column on mobile, content centered
- **Border radius:**
  - Cards: 12px
  - Badges: 6px (category), 20px (pill badges)
  - Buttons: 8px
  - Checkboxes: 50% (circular)
  - Progress rings: 50%

## Motion
- **Approach:** Minimal-functional
- **Easing:** ease-out for entrances, ease-in for exits
- **Duration:** micro(50-100ms) for checkbox bounce, short(150-250ms) for card hover, medium(300-500ms) for progress ring, long(500ms) for stamp animation
- **Existing animations:** check-bounce, stamp (scale + rotate), fade-up (removed from auto-play, available for scroll-triggered if added later)
- **Rule:** No scroll animations, no parallax. The content is the show.

## Signature Elements
- **Patriotic stripe:** 3px gradient bar at very top of hero (red → white → blue)
- **250th badge:** "EST. 1776 | 250TH ANNIVERSARY" pill badge in hero
- **Skyline silhouette:** SVG at bottom of hero, 15% opacity white on navy
- **Gold fun-fact boxes:** Revealed when objective is completed. Gold-tinted background with gold "Fun Fact:" label.
- **Circular checkboxes:** Gold fill when checked, with bounce animation
- **Progress rings:** SVG circles with gold stroke for completed arc

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-05 | Initial design system created | Created by /design-consultation. Serif + navy + gold palette chosen to differentiate from bright/white scavenger hunt apps. "This city is more than you think" as guiding principle. |
| 2026-06-05 | Instrument Serif for display | Risk: serif in a sans-serif-dominated category. Reward: instant "we have history" credibility. |
| 2026-06-05 | Deep navy hero over white | Risk: less approachable at first glance. Reward: immediate "this is different" differentiation. |
| 2026-06-05 | Parchment surface (#F7F5F0) | Warm white instead of cool white. Subtle historical weight without being heavy. |
| 2026-06-05 | Category color ordering | History → Culture → Entertainment → Food & Drink. Each quest ends at a restaurant/bar. |
| 2026-06-09 | AI verification is a carrot, never a stick | Photos always count; AI verification adds +5 XP, a gold BadgeCheck, and leaderboard credibility. Rejection shows a kind one-liner + "Try another photo" — gameplay never blocks on the judge. |
| 2026-06-09 | Leaderboard ("City Legends") typography | Geist Mono (`font-mono tabular-nums`) for ranks and XP per the Data/Tables rule — first surface to use it. Navy header matches passport; gold ring highlights the viewer's row. |
| 2026-06-09 | Instagram-gradient share button | The "Share to Stories" button in the completion modal uses Instagram's brand gradient — a deliberate exception to the restrained palette, since it signals the destination, not our brand. |
