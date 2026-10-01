// The rules every part of Judgey agrees on: the pure TS here, the demo crowd,
// and the SQL in supabase/ (which mirrors these numbers exactly).
// See docs/backend-spec.md §2 for the definitions that use them.

export const RULES = {
  earlyTapMinutes: 45, // taps earlier than scheduledAt - 45 min are rejected ('too-early')
  minTaps: 2, // default; per-meet override meets.min_taps / Meet.minTaps
  clusterSeconds: 120, // a confirmation needs minTaps distinct taps within 120 s of each other
  freezeSeconds: 90, // taps later than (confirming tap + 90 s) are ignored
  maxTapAgeSeconds: 120, // client-reported tap age is clamped to [0, 120] s
  minGapSeconds: 120, // no new routine on a mat within 120 s of the anchor's start ('too-soon')
  tapLookahead: 2, // next 2 unconfirmed routines after the anchor are tappable
  tapLookbehind: 2, // up to 2 skipped routines just before the anchor stay tappable (swaps)
  votingWindowMinutes: 10, // UI window: [start, start + 10 min]
  ballotGraceSeconds: 60, // server still accepts ballots until start + 10 min + 60 s
  routineMinutes: 3, // on-mat display length
  breakExtraMinutes: 5, // a schedule gap > usualGap + 5 min is a break that absorbs positive drift
  priorVotes: 10,
  priorStarSum: 35, // Bayesian prior: 10 votes averaging 3.5 stars
  minVotes: 5, // to qualify for the board
  topN: 5, // board shows min(topN, floor(qualifying / 2)) teams
  recapMinVotes: 10, // recaps show the vote count only at >= 10
  revealFallbackMinutes: 90, // a division reveals 90 min after its last scheduled routine at the latest
  maxHomeTeams: 10,
} as const;

export const SECOND = 1_000;
export const MINUTE = 60_000;

const isSurrogate = (unit: number) => unit >= 0xd800 && unit <= 0xdfff;

/**
 * UTF-8 byte order, like Postgres `collate "C"`; never localeCompare. Plain `<`
 * compares UTF-16 code units, which agrees except where a character above
 * U+FFFF (a surrogate pair, e.g. an emoji) meets one in U+E000–U+FFFF.
 */
export function compareIds(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const [x, y] = [a.charCodeAt(i), b.charCodeAt(i)];
    if (x === y) continue;
    const before = isSurrogate(x) === isSurrogate(y) ? x < y : isSurrogate(y);
    return before ? -1 : 1;
  }
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}
