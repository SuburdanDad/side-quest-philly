import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_MEET } from "../src/demo/meet.ts";
import { buildCrowdPlan, crowdAt } from "../src/demo/crowd.ts";
import { initialClock, meetNow, setSpeed, startClock } from "../src/demo/clock.ts";
import { buildBoards, closedTeamIds, findRow, VOTING_WINDOW_MINUTES } from "../src/board.ts";
import { validateBallot } from "../src/voting.ts";

const MIN = 60_000;
const plan = buildCrowdPlan(DEMO_MEET);

test("demo meet: every team has exactly one slot with unique ids", () => {
  const ids = DEMO_MEET.teams.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(DEMO_MEET.slots.length, ids.length);
});

test("crowd plan is deterministic", () => {
  const again = buildCrowdPlan(DEMO_MEET);
  assert.deepEqual([...again.actualStart], [...plan.actualStart]);
  assert.equal(again.ballots.length, plan.ballots.length);
});

test("simulated routines never overlap on a mat, and mat 1 runs late", () => {
  for (const mat of DEMO_MEET.mats) {
    const starts = DEMO_MEET.slots
      .filter((s) => s.mat === mat)
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .map((s) => plan.actualStart.get(s.teamId)!);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 3 * MIN);
  }
  const last = DEMO_MEET.slots.filter((s) => s.mat === "1").at(-1)!;
  assert.ok(plan.actualStart.get(last.teamId)! - last.scheduledAt > 10 * MIN);
});

test("every simulated ballot is valid for the crowd's own taps", () => {
  const end = DEMO_MEET.startsAt + 6 * 60 * MIN;
  const { taps, ballots } = crowdAt(plan, end);
  const boards = buildBoards(DEMO_MEET, taps, end);
  for (const b of ballots.slice(0, 400)) {
    const err = validateBallot(b, {
      profile: { deviceId: b.deviceId, homeTeamIds: [] },
      teamStartedAt: findRow(boards, b.teamId)!.startedAt,
      existing: [],
      windowMinutes: VOTING_WINDOW_MINUTES,
    });
    assert.equal(err, null, `${b.deviceId}: ${err?.reason}`);
  }
});

test("boards: on-mat, up-next, open voting, and closed teams line up", () => {
  const first = DEMO_MEET.slots[0];
  const now = plan.actualStart.get(first.teamId)! + 1 * MIN;
  const boards = buildBoards(DEMO_MEET, crowdAt(plan, now).taps, now);
  const mat1 = boards.find((b) => b.mat === "1")!;
  assert.equal(mat1.onMat?.team.id, first.teamId);
  assert.equal(mat1.upNext?.team.id, DEMO_MEET.slots[1].teamId);
  assert.ok(mat1.onMat?.votingOpen);
  assert.equal(closedTeamIds(boards, now).size, 0);

  const later = now + (VOTING_WINDOW_MINUTES + 1) * MIN;
  const laterBoards = buildBoards(DEMO_MEET, crowdAt(plan, later).taps, later);
  assert.ok(closedTeamIds(laterBoards, later).has(first.teamId));
});

test("demo clock: starts paused at drop-in time, speeds up, re-anchors", () => {
  let c = initialClock(DEMO_MEET.startsAt);
  assert.equal(meetNow(c, 123), DEMO_MEET.startsAt + 40 * MIN);
  c = startClock(c, 1_000);
  assert.equal(meetNow(c, 1_000 + 6_000), DEMO_MEET.startsAt + 41 * MIN); // 10x
  c = setSpeed(c, 0, 7_000);
  assert.equal(meetNow(c, 99_000), DEMO_MEET.startsAt + 41 * MIN); // paused
});
