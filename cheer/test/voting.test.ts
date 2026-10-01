import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OWN_TEAM_MESSAGE,
  awardWinner,
  crowdFavorites,
  tally,
  validateBallot,
} from "../src/voting.ts";
import type { Ballot, FanProfile } from "../src/types.ts";

const MIN = 60_000;
const START = Date.UTC(2026, 11, 5, 15, 0);
const profile: FanProfile = { deviceId: "me", homeTeamIds: ["home"] };
const ballot = (over: Partial<Ballot> = {}): Ballot => ({
  deviceId: "me",
  teamId: "rival",
  stars: 5,
  awards: [],
  castAt: START + 2 * MIN,
  ...over,
});
const ctx = { profile, teamStartedAt: START, existing: [] as Ballot[] };

test("a valid ballot passes", () => {
  assert.equal(validateBallot(ballot(), ctx), null);
});

test("you can't vote for your own team", () => {
  const err = validateBallot(ballot({ teamId: "home" }), ctx);
  assert.equal(err?.reason, "own-team");
  assert.equal(err?.message, OWN_TEAM_MESSAGE);
});

test("voting is only open from mat start until the window closes", () => {
  assert.equal(validateBallot(ballot(), { ...ctx, teamStartedAt: undefined })?.reason, "window-closed");
  assert.equal(validateBallot(ballot({ castAt: START - MIN }), ctx)?.reason, "window-closed");
  assert.equal(validateBallot(ballot({ castAt: START + 11 * MIN }), ctx)?.reason, "window-closed");
});

test("one ballot per device per routine; stars must be 1-5", () => {
  assert.equal(validateBallot(ballot(), { ...ctx, existing: [ballot()] })?.reason, "already-voted");
  assert.equal(validateBallot(ballot({ stars: 0 }), ctx)?.reason, "invalid");
  assert.equal(validateBallot(ballot({ stars: 4.5 }), ctx)?.reason, "invalid");
});

test("a handful of 5-star votes can't beat a big, strong crowd", () => {
  const ballots: Ballot[] = [
    ...Array.from({ length: 3 }, (_, i) => ballot({ deviceId: `s${i}`, teamId: "small", stars: 5 })),
    ...Array.from({ length: 200 }, (_, i) =>
      ballot({ deviceId: `b${i}`, teamId: "big", stars: i % 5 === 0 ? 4 : 5 }),
    ),
  ];
  const t = tally(ballots);
  const favs = crowdFavorites(t, { minVotes: 3 });
  assert.deepEqual(favs.map((f) => f.teamId), ["big", "small"]);
  assert.equal(t.get("small")!.averageStars, 5);
});

test("only the top N are published, never the bottom", () => {
  const ballots = Array.from({ length: 10 }, (_, team) =>
    Array.from({ length: 6 }, (_, v) =>
      ballot({ deviceId: `d${v}`, teamId: `t${team}`, stars: 1 + (team % 5) }),
    ),
  ).flat();
  const favs = crowdFavorites(tally(ballots), { top: 3 });
  assert.equal(favs.length, 3);
  assert.ok(favs.every((f) => f.averageStars === 5 || f.averageStars === 4));
});

test("award winner is by share of voters, not raw count", () => {
  const ballots: Ballot[] = [
    ...Array.from({ length: 5 }, (_, i) =>
      ballot({ deviceId: `a${i}`, teamId: "a", awards: ["stunts", "stunts"] }),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      ballot({ deviceId: `b${i}`, teamId: "b", awards: i < 8 ? ["stunts"] : [] }),
    ),
  ];
  const t = tally(ballots);
  assert.equal(t.get("a")!.awards.stunts, 5); // duplicates in one ballot count once
  assert.equal(awardWinner(t, "stunts")?.teamId, "a");
  assert.equal(awardWinner(t, "dance"), undefined);
});
