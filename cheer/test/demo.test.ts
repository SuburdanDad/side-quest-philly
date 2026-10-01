import { test } from "node:test";
import assert from "node:assert/strict";
import { BREAKS, DEMO_MEET } from "../src/demo/meet.ts";
import { buildCrowdPlan, crowdAt } from "../src/demo/crowd.ts";
import { initialClock, meetNow, setSpeed, startClock } from "../src/demo/clock.ts";
import { buildBoards, findRow } from "../src/board.ts";
import { computeBoard, isClosed } from "../src/results.ts";
import { RULES } from "../src/rules.ts";
import { confirmedStarts, estimateStarts, matDrift, matOrder, tapRejection, usualGap } from "../src/schedule.ts";
import { validateBallot } from "../src/voting.ts";

const MIN = 60_000;
const plan = buildCrowdPlan(DEMO_MEET);
const END = DEMO_MEET.startsAt + 6 * 60 * MIN;
const allStarts = confirmedStarts(DEMO_MEET, plan.taps);
const mat1 = matOrder(DEMO_MEET, "1");
/** Index (in mat 1's order) of the first routine after the awards break. */
const afterBreak = BREAKS[0].afterRoutines;

test("demo meet: every team has exactly one slot with unique ids", () => {
  const ids = DEMO_MEET.teams.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(DEMO_MEET.slots.length, ids.length);
});

test("crowd plan is deterministic", () => {
  const again = buildCrowdPlan(DEMO_MEET);
  assert.deepEqual([...again.actualStart], [...plan.actualStart]);
  assert.deepEqual(again.taps, plan.taps);
  assert.deepEqual(again.ballots, plan.ballots);
});

test("mat 1 has a scheduled awards break that counts as a break", () => {
  const gap = mat1[afterBreak].scheduledAt - mat1[afterBreak - 1].scheduledAt;
  assert.equal(gap, (4 + BREAKS[0].minutes) * MIN);
  assert.ok(gap > usualGap(mat1) + RULES.breakExtraMinutes * MIN);
});

test("simulated routines never overlap; mat 1 runs late before the break and catches up after", () => {
  for (const mat of DEMO_MEET.mats) {
    const starts = matOrder(DEMO_MEET, mat).map((s) => plan.actualStart.get(s.teamId)!);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 3 * MIN);
  }
  const lateness = (k: number) => plan.actualStart.get(mat1[k].teamId)! - mat1[k].scheduledAt;
  assert.ok(lateness(afterBreak - 1) > 10 * MIN);
  assert.ok(Math.abs(lateness(afterBreak)) < 1 * MIN);
});

test("every crowd tap is on a tappable routine when it lands", () => {
  const taps = [...plan.taps].sort((a, b) => a.at - b.at);
  taps.forEach((t, i) => {
    const starts = confirmedStarts(DEMO_MEET, taps.slice(0, i));
    assert.equal(tapRejection(DEMO_MEET, starts, t.teamId, t.at), null, `${t.deviceId} → ${t.teamId}`);
  });
  // Every routine ends up confirmed.
  assert.equal(allStarts.size, DEMO_MEET.slots.length);
});

test("every crowd ballot lands inside its voting window and passes validation", () => {
  const seen = new Set<string>();
  for (const b of plan.ballots) {
    const start = allStarts.get(b.teamId)!;
    assert.ok(b.castAt >= start && b.castAt <= start + RULES.votingWindowMinutes * MIN, b.deviceId);
    // Crowd devices follow no teams.
    const profile = { deviceId: b.deviceId, homeTeamIds: [], everHomeTeamIds: [] };
    assert.equal(validateBallot(b, { profile, teamStartedAt: start, existing: [] }), null);
    const key = `${b.deviceId}/${b.teamId}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
});

test("at drop-in, mat 1 is running late and the break absorbs it", () => {
  const now = initialClock(DEMO_MEET.startsAt).anchorMeet;
  const starts = confirmedStarts(DEMO_MEET, crowdAt(plan, now).taps);
  assert.ok(matDrift(DEMO_MEET, starts, "1") > 10 * MIN);
  const est = estimateStarts(DEMO_MEET, starts);
  const before = mat1[afterBreak - 1];
  const after = mat1[afterBreak];
  assert.ok(est.get(before.teamId)! - before.scheduledAt > 10 * MIN);
  assert.equal(est.get(after.teamId), after.scheduledAt);
});

test("boards: on-mat, up-next, open voting, and closed teams line up", () => {
  const first = DEMO_MEET.slots[0];
  const now = plan.actualStart.get(first.teamId)! + 1 * MIN;
  const starts = confirmedStarts(DEMO_MEET, crowdAt(plan, now).taps);
  const board = buildBoards(DEMO_MEET, starts, now).find((b) => b.mat === "1")!;
  assert.equal(board.onMat?.team.id, first.teamId);
  assert.equal(board.upNext?.team.id, DEMO_MEET.slots[1].teamId);
  assert.ok(board.onMat?.votingOpen);
  assert.equal(isClosed(starts.get(first.teamId), now), false);

  const later = now + (RULES.votingWindowMinutes + 1) * MIN;
  const laterStarts = confirmedStarts(DEMO_MEET, crowdAt(plan, later).taps);
  assert.ok(!findRow(buildBoards(DEMO_MEET, laterStarts, later), first.teamId)!.votingOpen);
  assert.ok(isClosed(laterStarts.get(first.teamId), later));
});

test("by the end of the day every division is revealed and the board is full", () => {
  const board = computeBoard(DEMO_MEET, allStarts, plan.ballots, END);
  assert.deepEqual(board.pendingDivisions, []);
  assert.equal(board.top.length, RULES.topN);
  for (const winner of Object.values(board.awards)) assert.notEqual(winner, null);
});

test("demo clock: starts paused at drop-in time, speeds up, re-anchors", () => {
  let c = initialClock(DEMO_MEET.startsAt);
  assert.equal(meetNow(c, 123), DEMO_MEET.startsAt + 40 * MIN);
  c = startClock(c, 1_000);
  assert.equal(meetNow(c, 1_000 + 6_000), DEMO_MEET.startsAt + 41 * MIN); // 10x
  c = setSpeed(c, 0, 7_000);
  assert.equal(meetNow(c, 99_000), DEMO_MEET.startsAt + 41 * MIN); // paused
});
