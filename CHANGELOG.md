# Changelog

All notable changes to Side Quest Philadelphia will be documented in this file.

## [0.2.0.0] - 2026-08-10

Portfolio mode: zero-infrastructure conversion. The game is now fully
self-contained — no database, no accounts, no env vars, nothing to maintain.

### Removed
- Supabase entirely: auth (magic links), cloud progress/photo sync, first-party
  analytics pipeline, admin dashboards (`/admin/funnel`, `/admin/visitors`),
  `/login`, feedback + suggestion inboxes, keepalive cron
- `@supabase/ssr` and `@supabase/supabase-js` dependencies

### Changed
- Leaderboard reimagined: you now rank against the City Legends (Ben Franklin,
  Betsy Ross, Rocky...) using your local XP — no sign-in gate
- Custom analytics events (`session_start`, `quest_start`, `objective_complete`,
  `share`, `photo_verified`/`photo_rejected`) now go to Vercel Web Analytics;
  first-touch ?src= attribution preserved
- `/suggestions` is a season-wrap thank-you page pointing to @SideQuestPhilly
- AI photo verification unchanged — server-side judge via AI Gateway (OIDC),
  verdict event still emitted server-side only

### Fixed
- `getServerSnapshot` returning a fresh object per call in the photo store
  (React hydration warning in dev)

## [0.1.1.0] - 2026-06-08

### Added
- Patriotic OG image with real Philly skyline photo for rich social sharing
- Entrance animations with staggered timing on landing and passport pages
- Accessible gold focus ring for keyboard navigation across all interactive elements
- Support for `prefers-reduced-motion` to disable animations for users who prefer it

### Changed
- Parchment background color aligned to design system (#F7F5F0)
- Card border radius set to 12px per design spec
- All page headings now use Instrument Serif italic for consistent typography
- DM Sans loaded as the primary body font via next/font
- Warm border and secondary surface colors tuned to match parchment palette
- Touch targets on neighborhood cards enlarged to meet 44px minimum

### Fixed
- Event date text bumped from 9px to readable 10px minimum
- H2 headings upgraded from 14px labels to proper 20px Instrument Serif
- Missing space in secret quest locked state text
