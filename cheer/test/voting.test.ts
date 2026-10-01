import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BALLOT_MESSAGES,
  OWN_TEAM_MESSAGE,
  applyCheckIn,
  awardWinner,
  checkInRejection,
  compareTallies,
  crowdFavorites,
  rankTallies,
  tally,
  validateBallot,
  type BallotContext,
} from "../src/voting.ts";
import { RULES } from "../src/rules.ts";
import type { Ballot, FanProfile } from "../src/types.ts";
import { MIN, SEC, ballot as makeBallot, makeMeet } from "./fixtures.ts";

const START = Date.UTC(2026, 11, 5, 15, 0);
const profile: FanProfile = { deviceId: "me", homeTeamIds: ["home"], everHomeTeamIds: ["home"] };
const ballot = (over: Partial<Ballot> = {}): Ballot => makeBallot({ castAt: START + 2 * MIN, ...over });
const ctx: BallotContext = { profile, teamStartedAt: START, existing: [] };
const closesAt = START + RULES.votingWindowMinutes * MIN + RULES.ballotGraceSeconds * SEC;

// --- validateBallot ---------------------------------------------------------

test("a valid ballot passes", () => {
  assert.equal(validateBallot(ballot(), ctx), null);
  assert.equal(validateBallot(ballot({ awards: ["stunts", "dance"] }), ctx), null);
});

test("you have to check in before voting", () => {
  const err = validateBallot(ballot(), { ...ctx, profile: null });
  assert.equal(err?.reason, "not-checked-in");
  assert.equal(err?.message, BALLOT_MESSAGES["not-checked-in"]);
});

test("you can't vote for your own team, with the friendly message", () => {
  const err = validateBallot(ballot({ teamId: "home" }), ctx);
  assert.equal(err?.reason, "own-team");
  assert.equal(err?.message, OWN_TEAM_MESSAGE);
  assert.equal(BALLOT_MESSAGES["own-team"], OWN_TEAM_MESSAGE);
});

test("voting runs from mat start until start + 10 min + 60 s of grace", () => {
  assert.equal(validateBallot(ballot(), { ...ctx, teamStartedAt: undefined })?.reason, "window-closed");
  assert.equal(validateBallot(ballot({ castAt: START - 1 }), ctx)?.reason, "window-closed");
  assert.equal(validateBallot(ballot({ castAt: START }), ctx), null);
  assert.equal(validateBallot(ballot({ castAt: START + 10 * MIN + 30 * SEC }), ctx), null); // grace
  assert.equal(validateBallot(ballot({ castAt: closesAt }), ctx), null);
  assert.equal(validateBallot(ballot({ castAt: closesAt + 1 }), ctx)?.reason, "window-closed");
});

test("one ballot per device per routine; stars must be whole 1-5; awards must be known", () => {
  assert.equal(validateBallot(ballot(), { ...ctx, existing: [ballot()] })?.reason, "already-voted");
  assert.equal(validateBallot(ballot(), { ...ctx, existing: [ballot({ deviceId: "other" })] }), null);
  assert.equal(validateBallot(ballot({ stars: 0 }), ctx)?.reason, "invalid");
  assert.equal(validateBallot(ballot({ stars: 6 }), ctx)?.reason, "invalid");
  assert.equal(validateBallot(ballot({ stars: 4.5 }), ctx)?.reason, "invalid");
  assert.equal(validateBallot(ballot({ stars: NaN }), ctx)?.reason, "invalid");
  const bad = ballot({ awards: ["stunts", "glitter" as never] });
  assert.equal(validateBallot(bad, ctx)?.reason, "invalid");
});

test("reasons come in the server's order", () => {
  const everything = ballot({ teamId: "home", castAt: START - MIN, stars: 9 });
  assert.equal(validateBallot(everything, { ...ctx, profile: null })?.reason, "not-checked-in");
  assert.equal(validateBallot(everything, ctx)?.reason, "own-team");
  const late = ballot({ castAt: closesAt + 1, stars: 9 });
  assert.equal(validateBallot(late, { ...ctx, existing: [late] })?.reason, "window-closed");
  assert.equal(validateBallot(ballot({ stars: 9 }), { ...ctx, existing: [ballot()] })?.reason, "already-voted");
});

// --- check-in ---------------------------------------------------------------

test("first check-in: home and ever-home are the (deduped) picks", () => {
  const { profile: p, removedBallotTeamIds } = applyCheckIn(null, "me", ["a", "b", "a"], []);
  assert.deepEqual(p, { deviceId: "me", homeTeamIds: ["a", "b"], everHomeTeamIds: ["a", "b"] });
  assert.deepEqual(removedBallotTeamIds, []);
  // "I'm just here to cheer."
  assert.deepEqual(applyCheckIn(null, "me", [], []).profile.everHomeTeamIds, []);
});

test("un-follow, vote, re-follow is blocked: everHomeTeamIds only grows", () => {
  let p = applyCheckIn(null, "me", ["home"], []).profile;
  p = applyCheckIn(p, "me", [], []).profile; // un-follow
  assert.deepEqual(p.homeTeamIds, []);
  assert.deepEqual(p.everHomeTeamIds, ["home"]);
  const err = validateBallot(ballot({ teamId: "home" }), { ...ctx, profile: p });
  assert.equal(err?.reason, "own-team");
  p = applyCheckIn(p, "me", ["home", "other"], []).profile; // re-follow
  assert.deepEqual(p.everHomeTeamIds, ["home", "other"]);
});

test("following a team you already voted for removes that ballot", () => {
  const mine = [ballot({ teamId: "rival" }), ballot({ teamId: "zeta" }), ballot({ teamId: "alpha" })];
  let p = applyCheckIn(null, "me", ["home"], mine).profile;
  const res = applyCheckIn(p, "me", ["home", "zeta", "rival", "new"], mine);
  assert.deepEqual(res.removedBallotTeamIds, ["rival", "zeta"]); // sorted, code-unit order
  assert.deepEqual(res.profile.everHomeTeamIds, ["home", "zeta", "rival", "new"]);
  // Only teams *newly* added to everHome count.
  p = res.profile;
  assert.deepEqual(applyCheckIn(p, "me", ["rival"], mine).removedBallotTeamIds, []);
});

test("check-in rejects too many teams and unknown or scratched ones", () => {
  const meet = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4, "Open", "scratched"],
  ]);
  assert.equal(checkInRejection(meet, ["a"]), null);
  assert.equal(checkInRejection(meet, []), null);
  assert.equal(checkInRejection(meet, ["a", "zzz"]), "unknown-team");
  assert.equal(checkInRejection(meet, ["b"]), "unknown-team");
  const many = Array.from({ length: RULES.maxHomeTeams + 1 }, (_, i) => `t${i}`);
  assert.equal(checkInRejection(meet, many), "too-many");
  assert.equal(checkInRejection(meet, ["a", "a"]), null); // deduped first
});

// --- tallies and ordering ---------------------------------------------------

test("tally keeps an integer starSum; one ballot per device per team; awards once per ballot", () => {
  const t = tally([
    ballot({ deviceId: "d1", stars: 5, awards: ["stunts", "stunts"] }),
    ballot({ deviceId: "d2", stars: 2 }),
    ballot({ deviceId: "d1", stars: 1, awards: ["dance"] }), // repeat: ignored
  ]).get("rival")!;
  assert.equal(t.votes, 2);
  assert.equal(t.starSum, 7);
  assert.equal(t.averageStars, 3.5);
  assert.equal(t.rating, (RULES.priorStarSum + 7) / (RULES.priorVotes + 2));
  assert.deepEqual(t.awards, { stunts: 1, tumbling: 0, spirit: 0, dance: 0 });
});

test("a handful of 5-star votes can't beat a big, strong crowd", () => {
  const ballots: Ballot[] = [
    ...Array.from({ length: 3 }, (_, i) => ballot({ deviceId: `s${i}`, teamId: "small", stars: 5 })),
    ...Array.from({ length: 200 }, (_, i) =>
      ballot({ deviceId: `b${i}`, teamId: "big", stars: i % 5 === 0 ? 4 : 5 }),
    ),
  ];
  const t = tally(ballots);
  assert.deepEqual(rankTallies(t, 3).map((f) => f.teamId), ["big", "small"]);
  assert.equal(t.get("small")!.averageStars, 5);
  // Two qualifying teams: the board shows only the better half.
  assert.deepEqual(crowdFavorites(t, { minVotes: 3 }).map((f) => f.teamId), ["big"]);
});

test("only the top N are published, never more than half, never the bottom", () => {
  const ballots = Array.from({ length: 10 }, (_, team) =>
    Array.from({ length: 6 }, (_, v) => ballot({ deviceId: `d${v}`, teamId: `t${team}`, stars: 1 + (team % 5) })),
  ).flat();
  const t = tally(ballots);
  const favs = crowdFavorites(t, { top: 3 });
  assert.equal(favs.length, 3);
  assert.ok(favs.every((f) => f.averageStars === 5 || f.averageStars === 4));
  assert.equal(crowdFavorites(t).length, 5); // min(topN, floor(10 / 2))
  const three = tally(ballots.filter((b) => ["t0", "t1", "t2"].includes(b.teamId)));
  assert.deepEqual(crowdFavorites(three).map((f) => f.teamId), ["t2"]); // floor(3 / 2) = 1
});

test("exact rating ties go to more votes, then teamId in code-unit order", () => {
  const row = (teamId: string, votes: number, starSum: number) => ({
    teamId,
    votes,
    starSum,
    averageStars: 0,
    rating: 0,
    awards: { stunts: 0, tumbling: 0, spirit: 0, dance: 0 },
  });
  // (35 + 35) / (10 + 10) = (35 + 105) / (10 + 30) = 3.5 exactly.
  const rows = [row("x", 10, 35), row("y", 30, 105), row("b", 10, 35), row("B", 10, 35), row("a-2", 10, 35)];
  const sorted = [...rows, row("a0", 10, 35)].sort(compareTallies).map((r) => r.teamId);
  assert.deepEqual(sorted, ["y", "B", "a-2", "a0", "b", "x"]);
  // Higher exact rating first, whatever the votes: 60/15 = 4 beats 66/17 ≈ 3.88.
  assert.ok(compareTallies(row("p", 7, 31), row("q", 5, 25)) > 0);
  // Tiny differences are still exact: 4035/1010 vs 4031/1009 (cross products differ by 5).
  assert.ok(compareTallies(row("r", 1000, 4000), row("s", 999, 3996)) < 0);
});

test("award winner is by share of voters (3/7 beats 2/5), not raw count", () => {
  const voters = (teamId: string, n: number, withAward: number) =>
    Array.from({ length: n }, (_, i) =>
      ballot({ deviceId: `${teamId}${i}`, teamId, awards: i < withAward ? ["stunts"] : [] }),
    );
  const t = tally([...voters("a", 7, 3), ...voters("b", 5, 2), ...voters("c", 20, 8)]);
  assert.equal(awardWinner(t, "stunts")?.teamId, "a"); // 3/7 > 2/5 = 8/20
  assert.equal(awardWinner(t, "dance"), undefined);
  // Same share: more votes wins, then teamId.
  const tie = tally([...voters("m", 5, 1), ...voters("n", 10, 2), ...voters("k", 10, 2)]);
  assert.equal(awardWinner(tie, "stunts")?.teamId, "k");
  // Too few votes to qualify.
  assert.equal(awardWinner(tally(voters("z", 4, 4)), "stunts"), undefined);
});
