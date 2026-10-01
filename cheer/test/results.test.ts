import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBoard, computeRecaps, divisionReveal, isClosed, publishedRating } from "../src/results.ts";
import { RULES } from "../src/rules.ts";
import { tally } from "../src/voting.ts";
import type { Award, Ballot } from "../src/types.ts";
import { MIN, SEC, T0, ballot, makeMeet, randomBallots, randomMeet, randomStarts, startsOf } from "./fixtures.ts";

/** Minutes after which a routine that started at `minute` is closed for good. */
const CLOSE = RULES.votingWindowMinutes + RULES.ballotGraceSeconds / 60;

const meet = makeMeet([
  ["y1", "1", 0, "Youth"],
  ["y2", "1", 4, "Youth"],
  ["y3", "2", 2, "Youth"],
  ["j1", "1", 8, "Junior"],
  ["j2", "1", 12, "Junior"],
  ["j3", "1", 16, "Junior", "scratched"],
]);
const at = (minute: number) => T0 + minute * MIN;

/** n distinct fans vote for teamId with these stars/awards. */
function votes(teamId: string, n: number, stars = 5, awards: (i: number) => Award[] = () => []): Ballot[] {
  return Array.from({ length: n }, (_, i) =>
    ballot({ deviceId: `${teamId}-fan${i}`, teamId, stars, awards: awards(i) }),
  );
}

// --- closing and reveal -----------------------------------------------------

test("a routine is closed once start + 10 min + 60 s has passed", () => {
  assert.equal(isClosed(undefined, at(999)), false);
  const deadline = T0 + RULES.votingWindowMinutes * MIN + RULES.ballotGraceSeconds * SEC;
  assert.equal(isClosed(T0, deadline), false);
  assert.equal(isClosed(T0, deadline + 1), true);
});

test("a division reveals once every routine in it is closed", () => {
  assert.deepEqual(divisionReveal(meet, new Map(), at(0)), { revealed: [], pending: ["Junior", "Youth"] });
  const starts = startsOf([
    ["y1", 0],
    ["y3", 2],
    ["y2", 4],
  ]);
  assert.deepEqual(divisionReveal(meet, starts, at(4 + CLOSE)).pending, ["Junior", "Youth"]);
  assert.deepEqual(divisionReveal(meet, starts, at(4 + CLOSE) + 1), { revealed: ["Youth"], pending: ["Junior"] });
});

test("a skipped routine stops holding its division back once a later routine on its mat closes", () => {
  // y2 never seen; j1 (later on mat 1) went at minute 8.
  const starts = startsOf([
    ["y1", 0],
    ["y3", 2],
    ["j1", 8],
  ]);
  assert.deepEqual(divisionReveal(meet, starts, at(8 + CLOSE)).pending, ["Junior", "Youth"]);
  assert.deepEqual(divisionReveal(meet, starts, at(8 + CLOSE) + 1).revealed, ["Youth"]);
});

test("scratched routines don't hold a division back", () => {
  const starts = startsOf([
    ["j1", 8],
    ["j2", 12],
  ]);
  assert.deepEqual(divisionReveal(meet, starts, at(12 + CLOSE) + 1).revealed, ["Junior"]);
});

test("fallback: a division reveals 90 min after its last scheduled routine (scratched included)", () => {
  // Junior's last scheduled routine is j3 at minute 16 (scratched).
  const last = at(16) + RULES.revealFallbackMinutes * MIN;
  assert.deepEqual(divisionReveal(meet, new Map(), last).revealed, ["Youth"]);
  assert.deepEqual(divisionReveal(meet, new Map(), last + 1).revealed, ["Junior", "Youth"]);
});

test("divisions sort in byte order (collate \"C\"), not locale order", () => {
  const m = makeMeet([
    ["a", "1", 0, "junior"],
    ["b", "1", 4, "Youth"],
    ["c", "1", 8, "Senior"],
    ["d", "1", 12, "Open 🏆"],
    ["e", "1", 16, "Open Ｓ"],
    ["f", "1", 20, "Élite"],
  ]);
  // UTF-8 bytes put U+FF33 (Ｓ) before U+1F3C6 (🏆), although its UTF-16 code unit is larger.
  assert.deepEqual(divisionReveal(m, new Map(), at(0)).pending, [
    "Open Ｓ",
    "Open 🏆",
    "Senior",
    "Youth",
    "junior",
    "Élite",
  ]);
});

// --- board ------------------------------------------------------------------

/** Six Open teams, all closed by minute 60. */
const open = makeMeet(["a", "b", "c", "d", "e", "f"].map((id, i) => [id, "1", i * 4, "Open"]));
const openStarts = new Map(open.slots.map((s) => [s.teamId, s.scheduledAt]));
const late = at(60);

test("the board never shows more than half the qualifying teams", () => {
  const three = [...votes("a", 6, 5), ...votes("b", 6, 4), ...votes("c", 6, 3), ...votes("d", 4, 5)];
  const board = computeBoard(open, openStarts, three, late);
  assert.deepEqual(board.top, [{ teamId: "a", votes: 6, rating: 4.1 }]); // 3 qualify → 1 shown; 65/16
  assert.deepEqual(computeBoard(open, openStarts, votes("a", 9), late).top, []); // 1 qualifies → 0 shown
  const six = ["a", "b", "c", "d", "e", "f"].flatMap((id, i) => votes(id, 5 + i, 4));
  assert.equal(computeBoard(open, openStarts, six, late).top.length, 3);
});

test("random meets: the board shows at most min(5, floor(qualifying / 2)) revealed teams", () => {
  for (let i = 0; i < 60; i++) {
    const m = randomMeet(`r${i}`, { routinesPerMat: 12 });
    const now = m.startsAt + (40 + (i % 5) * 30) * MIN;
    const starts = randomStarts(`r${i}`, m, now);
    const ballots = randomBallots(`r${i}`, m.teams.map((t) => t.id));
    const board = computeBoard(m, starts, ballots, now);
    const revealed = new Set(board.revealedDivisions);
    const t = tally(ballots);
    const qualifying = m.teams.filter(
      (x) => revealed.has(x.division) && (t.get(x.id)?.votes ?? 0) >= RULES.minVotes,
    );
    assert.ok(board.top.length <= Math.min(RULES.topN, Math.floor(qualifying.length / 2)));
    assert.equal(board.top.length, Math.min(RULES.topN, Math.floor(qualifying.length / 2)));
    for (const e of board.top) assert.ok(qualifying.some((q) => q.id === e.teamId));
    const divisions = [...new Set(m.teams.map((x) => x.division))].sort();
    assert.deepEqual([...board.revealedDivisions, ...board.pendingDivisions].sort(), divisions);
  }
});

test("only revealed divisions count", () => {
  const starts = startsOf([
    ["y1", 0],
    ["y3", 2],
    ["y2", 4],
    ["j1", 8],
  ]);
  const ballots = [
    ...votes("y1", 8, 4),
    ...votes("y2", 8, 3),
    ...votes("y3", 8, 2),
    ...votes("j1", 50, 5, () => ["dance"]), // Junior is still pending
  ];
  const board = computeBoard(meet, starts, ballots, at(4 + CLOSE) + 1);
  assert.deepEqual(board.revealedDivisions, ["Youth"]);
  assert.deepEqual(board.pendingDivisions, ["Junior"]);
  assert.deepEqual(board.top.map((e) => e.teamId), ["y1"]);
  assert.equal(board.awards.dance, null);
});

test("exact ties on the board: more votes first, then teamId", () => {
  // d: 10 votes of 3.5 → (35 + 35) / 20; e: 30 votes → (35 + 105) / 40; both exactly 3.5.
  const ballots = [
    ...votes("f", 12, 5),
    ...votes("d", 10, 3).map((b, i) => (i < 5 ? { ...b, stars: 4 } : b)),
    ...votes("e", 30, 3).map((b, i) => (i < 15 ? { ...b, stars: 4 } : b)),
    ...votes("c", 10, 3).map((b, i) => (i < 5 ? { ...b, stars: 4 } : b)),
    ...votes("a", 6, 1),
    ...votes("b", 6, 1),
  ];
  const board = computeBoard(open, openStarts, ballots, late);
  assert.deepEqual(board.top.map((e) => e.teamId), ["f", "e", "c"]); // 6 qualify → 3 shown
  assert.deepEqual(board.top.map((e) => e.rating), [4.3, 3.5, 3.5]); // 95/22 ≈ 4.32
});

test("published rating: tenths, rounded half-up with integers", () => {
  assert.equal(publishedRating({ votes: 0, starSum: 0 }), 3.5);
  assert.equal(publishedRating({ votes: 10, starSum: 46 }), 4.1); // 81/20 = 4.05 → 4.1
  assert.equal(publishedRating({ votes: 10, starSum: 44 }), 4); // 79/20 = 3.95 → 4.0
  assert.equal(publishedRating({ votes: 30, starSum: 150 }), 4.6); // 4.625
  assert.equal(publishedRating({ votes: 3, starSum: 15 }), 3.8); // 3.846…
  assert.equal(publishedRating({ votes: 100, starSum: 500 }), 4.9); // 535/110 = 4.863…
});

test("shout-out winners: highest share among qualifying teams, null when nobody", () => {
  const ballots = [
    ...votes("a", 7, 4, (i) => (i < 3 ? ["stunts"] : [])), // 3/7
    ...votes("b", 5, 4, (i) => (i < 2 ? ["stunts", "spirit"] : [])), // 2/5
    ...votes("c", 20, 4, (i) => (i < 8 ? ["stunts"] : [])), // 8/20
    ...votes("d", 4, 4, () => ["tumbling"]), // 4/4 but too few votes to qualify
  ];
  const board = computeBoard(open, openStarts, ballots, late);
  assert.deepEqual(board.awards, { stunts: "a", tumbling: null, spirit: "b", dance: null });
});

// --- recaps -----------------------------------------------------------------

test("recaps: closed home teams only, small counts hidden, sparse awards, rank", () => {
  const ballots = [
    ...votes("a", 10, 5, (i) => (i < 3 ? ["stunts"] : [])),
    ...votes("b", 9, 4),
    ...votes("c", 6, 2),
    ...votes("d", 5, 2),
  ];
  const board = computeBoard(open, openStarts, ballots, late);
  assert.deepEqual(board.top.map((e) => e.teamId), ["a", "b"]);
  const recaps = computeRecaps(open, openStarts, ballots, ["b", "a", "zzz", "a", "e"], late, board);
  assert.deepEqual(recaps, [
    { teamId: "b", votes: null, awards: {}, rank: 2 }, // 9 votes: hidden
    { teamId: "a", votes: 10, awards: { stunts: 3 }, rank: 1 },
    { teamId: "e", votes: null, awards: {}, rank: null }, // closed, no votes
  ]);
  // Not closed yet: no recap.
  const early = computeRecaps(open, openStarts, ballots, ["f"], at(20) + CLOSE * MIN, board);
  assert.deepEqual(early, []);
});

test("recaps skip a scratched routine even if the server still has a start for it", () => {
  const starts = startsOf([
    ["j1", 8],
    ["j3", 16],
  ]);
  const board = computeBoard(meet, starts, [], at(60));
  assert.deepEqual(
    computeRecaps(meet, starts, votes("j3", 12), ["j3", "j1"], at(60), board).map((r) => r.teamId),
    ["j1"],
  );
});
