import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoards, findRow } from "../src/board.ts";
import { RULES } from "../src/rules.ts";
import { tapRejection } from "../src/schedule.ts";
import { MIN, SEC, T0, makeMeet, startsOf } from "./fixtures.ts";

const meet = makeMeet([
  ["a", "1", 0],
  ["b", "1", 4],
  ["s", "1", 6, "Open", "scratched"],
  ["c", "1", 8],
  ["d", "1", 12],
  ["x", "2", 2],
  ["y", "2", 6],
]);

test("rows list every routine in scheduled order, scratched ones included", () => {
  const [mat1, mat2] = buildBoards(meet, new Map(), T0);
  assert.equal(mat1.mat, "1");
  assert.deepEqual(mat1.rows.map((r) => r.team.id), ["a", "b", "s", "c", "d"]);
  assert.equal(mat1.rows[2].eta.status, "scratched");
  assert.equal(mat1.rows[2].tappable, false);
  assert.deepEqual(mat2.rows.map((r) => r.team.id), ["x", "y"]);
});

test("before anything is confirmed: on time, first routine up next, first two tappable", () => {
  const [mat1] = buildBoards(meet, new Map(), T0);
  assert.equal(mat1.driftMinutes, 0);
  assert.equal(mat1.lastConfirmedAt, undefined);
  assert.equal(mat1.confirmed, false, "no anchor: the UI must not call this 'on time'");
  assert.equal(mat1.onMat, undefined);
  assert.equal(mat1.upNext?.team.id, "a");
  assert.deepEqual(mat1.tapCandidates.map((r) => r.team.id), ["a", "b"]);
});

test("on the mat, up next, open voting and tap candidates line up", () => {
  const starts = startsOf([["a", 5]]); // 5 min behind
  const now = T0 + 6 * MIN;
  const [mat1, mat2] = buildBoards(meet, starts, now);
  assert.equal(mat1.driftMinutes, 5);
  assert.equal(mat1.lastConfirmedAt, T0 + 5 * MIN);
  assert.equal(mat1.confirmed, true);
  assert.equal(mat2.confirmed, false, "confirmed is per mat");
  assert.equal(mat1.onMat?.team.id, "a");
  assert.equal(mat1.onMat?.startedAt, T0 + 5 * MIN);
  assert.ok(mat1.onMat?.votingOpen);
  assert.equal(mat1.onMat?.votingClosesAt, T0 + 5 * MIN + RULES.votingWindowMinutes * MIN);
  assert.equal(mat1.upNext?.team.id, "b");
  assert.equal(mat1.upNext?.eta.estimatedAt, T0 + 9 * MIN);
  // Within 120 s of a's start, only a itself can still be tapped.
  assert.deepEqual(mat1.tapCandidates.map((r) => r.team.id), ["a"]);
  const later = buildBoards(meet, starts, T0 + 7 * MIN + 1)[0];
  assert.deepEqual(later.tapCandidates.map((r) => r.team.id), ["a", "b", "c"]);
  // The other mat is untouched.
  assert.equal(mat2.driftMinutes, 0);
  assert.equal(mat2.upNext?.team.id, "x");
});

test("tappable matches tapRejection for every row", () => {
  const starts = startsOf([["c", 9]]);
  for (const now of [T0, T0 + 10 * MIN, T0 + 12 * MIN, T0 + 30 * MIN]) {
    for (const board of buildBoards(meet, starts, now)) {
      for (const row of board.rows) {
        assert.equal(row.tappable, tapRejection(meet, starts, row.team.id, now) === null);
      }
    }
  }
});

test("voting is open in the UI from start to start + 10 min (grace is server-only)", () => {
  const starts = startsOf([["a", 0]]);
  const at = (now: number) => findRow(buildBoards(meet, starts, now), "a")!.votingOpen;
  assert.equal(at(T0 - 1), false);
  assert.equal(at(T0), true);
  assert.equal(at(T0 + RULES.votingWindowMinutes * MIN), true);
  assert.equal(at(T0 + RULES.votingWindowMinutes * MIN + 1), false);
});

test("skipped rows: no countdown, not up next", () => {
  const starts = startsOf([["c", 9]]); // a and b never seen
  const [mat1] = buildBoards(meet, starts, T0 + 10 * MIN);
  assert.deepEqual(
    mat1.rows.map((r) => r.eta.status),
    ["skipped", "skipped", "scratched", "on-mat", "upcoming"],
  );
  assert.equal(mat1.upNext?.team.id, "d");
});

test("after a swap, onMat is the routine that started last", () => {
  const starts = new Map([
    ["c", T0 + 8 * MIN],
    ["b", T0 + 8 * MIN + 2 * MIN + 30 * SEC],
  ]);
  const [mat1] = buildBoards(meet, starts, T0 + 10 * MIN + 45 * SEC);
  assert.deepEqual(mat1.rows.filter((r) => r.eta.status === "on-mat").map((r) => r.team.id), ["b", "c"]);
  assert.equal(mat1.onMat?.team.id, "b");
});

test("findRow finds a team on any mat", () => {
  const boards = buildBoards(meet, new Map(), T0);
  assert.equal(findRow(boards, "y")?.slot.mat, "2");
  assert.equal(findRow(boards, "zzz"), undefined);
});
