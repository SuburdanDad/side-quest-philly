import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anchorOf,
  confirmedStart,
  confirmedStarts,
  dueAlerts,
  estimateStarts,
  etaFor,
  matDrift,
  matOrder,
  tapRejection,
  usualGap,
} from "../src/schedule.ts";
import { RULES } from "../src/rules.ts";
import type { MatTap } from "../src/types.ts";
import { MIN, SEC, T0, makeMeet, randomTaps, startsOf, tap } from "./fixtures.ts";

// Mat 1: a b c d e every 4 minutes from 9:00. Mat 2: one routine.
const meet = makeMeet([
  ["a", "1", 0],
  ["b", "1", 4],
  ["c", "1", 8],
  ["d", "1", 12],
  ["e", "1", 16],
  ["x", "2", 6],
]);
const slot = (id: string) => meet.slots.find((s) => s.teamId === id)!;
/** n distinct people tap `teamId` at the given times. */
const taps = (teamId: string, ...at: number[]): MatTap[] => at.map((t, k) => tap(teamId, `p${k}`, t));

// --- confirmedStart ---------------------------------------------------------

test("one tap is not enough to confirm a start", () => {
  assert.equal(confirmedStart(slot("a"), [tap("a", "d1", T0)]), undefined);
  assert.equal(confirmedStart(slot("a"), []), undefined);
});

test("confirmed start is the median of the counted taps; repeat taps are ignored", () => {
  const list = [
    tap("a", "d1", T0 + 10 * MIN),
    tap("a", "d2", T0 + 10 * MIN + 30 * SEC), // confirms (30 s after d1)
    tap("a", "d3", T0 + 11 * MIN), // inside the freeze: counted
    tap("a", "d1", T0 + 10 * MIN + 50 * SEC), // d1 again: ignored
    tap("b", "d4", T0 + 10 * MIN), // another team: ignored
  ];
  assert.equal(confirmedStart(slot("a"), list), T0 + 10 * MIN + 30 * SEC);
});

test("an even count takes floor((a + b + 1) / 2) of the middle two, in integer ms", () => {
  assert.equal(confirmedStart(slot("a"), taps("a", T0, T0 + 1)), T0 + 1);
  assert.equal(confirmedStart(slot("a"), taps("a", T0, T0 + 3)), T0 + 2);
  assert.equal(confirmedStart(slot("a"), taps("a", T0, T0 + 10, T0 + 20, T0 + 25)), T0 + 15);
  assert.ok(Number.isInteger(confirmedStart(slot("a"), taps("a", T0 + 1, T0 + 2))!));
});

test("two taps more than 120 s apart don't confirm; exactly 120 s does", () => {
  assert.equal(confirmedStart(slot("a"), taps("a", T0, T0 + 120 * SEC + 1)), undefined);
  assert.equal(confirmedStart(slot("a"), taps("a", T0, T0 + 120 * SEC)), T0 + 60 * SEC);
});

test("a late tap after the freeze does not move the start", () => {
  const base = taps("a", T0, T0 + 5 * SEC); // confirming tap c = T0 + 5 s
  const start = confirmedStart(slot("a"), base);
  assert.equal(start, T0 + 2_500);
  const late = tap("a", "late", T0 + 5 * SEC + RULES.freezeSeconds * SEC + 1);
  assert.equal(confirmedStart(slot("a"), [...base, late]), start);
  // Right at the freeze it still counts.
  const edge = tap("a", "edge", T0 + 5 * SEC + RULES.freezeSeconds * SEC);
  assert.equal(confirmedStart(slot("a"), [...base, edge]), T0 + 5 * SEC);
});

test("a lone early tap can't drag the start: counting begins at the cluster", () => {
  const list = [tap("a", "early", T0 - 10 * MIN), ...taps("a", T0, T0 + 10 * SEC)];
  assert.equal(confirmedStart(slot("a"), list), T0 + 5 * SEC);
});

test("taps earlier than scheduledAt - 45 min are ignored; 45 min exactly counts", () => {
  const cutoff = slot("c").scheduledAt - RULES.earlyTapMinutes * MIN;
  assert.equal(confirmedStart(slot("c"), taps("c", cutoff - 1, cutoff - 1)), undefined);
  assert.equal(confirmedStart(slot("c"), taps("c", cutoff, cutoff)), cutoff);
});

test("each identity counts with its first tap", () => {
  // d1's first tap is 150 s before d2's: no cluster, even though d1's repeat is close to d2.
  const list = [tap("a", "d1", T0), tap("a", "d1", T0 + 100 * SEC), tap("a", "d2", T0 + 150 * SEC)];
  assert.equal(confirmedStart(slot("a"), list), undefined);
});

test("minTaps: a meet can require three people", () => {
  const two = taps("a", T0, T0 + 10 * SEC);
  const three = taps("a", T0, T0 + 10 * SEC, T0 + 20 * SEC);
  assert.equal(confirmedStart(slot("a"), two, 3), undefined);
  assert.equal(confirmedStart(slot("a"), three, 3), T0 + 10 * SEC);
  const strict = { ...meet, minTaps: 3 };
  assert.equal(confirmedStarts(strict, two).has("a"), false);
  assert.equal(confirmedStarts(strict, three).get("a"), T0 + 10 * SEC);
});

test("confirmedStarts covers every routine and skips scratched ones", () => {
  const scratched = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4, "Open", "scratched"],
  ]);
  const list = [...taps("a", T0, T0 + SEC), ...taps("b", T0 + 4 * MIN, T0 + 4 * MIN)];
  assert.deepEqual([...confirmedStarts(scratched, list)], [["a", T0 + 500]]);
});

test("random taps: a confirmed start is always one of the counted taps' span, in integer ms", () => {
  for (let i = 0; i < 300; i++) {
    const list = randomTaps(`s${i}`, slot("c"));
    const start = confirmedStart(slot("c"), list);
    if (start === undefined) continue;
    const ats = list.map((t) => t.at);
    assert.ok(Number.isInteger(start));
    assert.ok(start >= Math.min(...ats) && start <= Math.max(...ats));
    assert.ok(start >= slot("c").scheduledAt - RULES.earlyTapMinutes * MIN);
  }
});

// --- anchor and drift -------------------------------------------------------

test("drift comes from the anchor: the latest-scheduled confirmed routine on that mat", () => {
  const starts = startsOf([
    ["a", 5],
    ["b", 16],
  ]);
  assert.equal(anchorOf(meet, starts, "1")?.teamId, "b");
  assert.equal(matDrift(meet, starts, "1"), 12 * MIN);
  assert.equal(anchorOf(meet, starts, "2"), undefined);
  assert.equal(matDrift(meet, starts, "2"), 0);
});

test("a scratched routine is never the anchor", () => {
  const m = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4, "Open", "scratched"],
  ]);
  const starts = startsOf([
    ["a", 2],
    ["b", 30],
  ]);
  assert.equal(anchorOf(m, starts, "1")?.teamId, "a");
  assert.equal(matDrift(m, starts, "1"), 2 * MIN);
});

// --- tapRejection -----------------------------------------------------------

test("unknown and scratched teams can't be tapped", () => {
  const m = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4, "Open", "scratched"],
  ]);
  assert.equal(tapRejection(m, new Map(), "zzz", T0), "unknown-team");
  assert.equal(tapRejection(m, new Map(), "b", T0), "scratched");
});

test("two griefer taps 45+ minutes early are rejected ('too-early' or 'not-next')", () => {
  const none = new Map<string, number>();
  // 46 minutes before the first routine.
  assert.equal(tapRejection(meet, none, "a", T0 - 46 * MIN), "too-early");
  assert.equal(tapRejection(meet, none, "a", T0 - 45 * MIN), null);
  // Inside the 45 minutes, but three routines ahead of the mat.
  assert.equal(tapRejection(meet, none, "d", T0 - 30 * MIN), "not-next");
  // And even if the taps were stored, they couldn't confirm a start that early.
  const griefers = [tap("a", "g1", T0 - 46 * MIN), tap("a", "g2", T0 - 46 * MIN)];
  assert.equal(confirmedStart(slot("a"), griefers), undefined);
});

test("with no anchor, the first two routines are tappable", () => {
  const none = new Map<string, number>();
  assert.equal(tapRejection(meet, none, "a", T0), null);
  assert.equal(tapRejection(meet, none, "b", T0), null);
  assert.equal(tapRejection(meet, none, "c", T0), "not-next");
});

test("after the anchor: the next two and the anchor itself, never within 120 s of its start", () => {
  const starts = startsOf([["a", 1]]);
  const soon = T0 + 1 * MIN + RULES.minGapSeconds * SEC;
  assert.equal(tapRejection(meet, starts, "b", soon - 1), "too-soon");
  assert.equal(tapRejection(meet, starts, "b", soon), null);
  assert.equal(tapRejection(meet, starts, "c", soon), null);
  assert.equal(tapRejection(meet, starts, "d", soon), "not-next");
  // More confirmations for the anchor are fine right away.
  assert.equal(tapRejection(meet, starts, "a", T0 + 1 * MIN), null);
});

test("scratched routines don't use up the lookahead", () => {
  const m = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4, "Open", "scratched"],
    ["c", "1", 8],
    ["d", "1", 12],
  ]);
  const later = T0 + 10 * MIN;
  const starts = startsOf([["a", 0]]);
  assert.equal(tapRejection(m, starts, "c", later), null);
  assert.equal(tapRejection(m, starts, "d", later), null);
});

test("a no-show doesn't stall the mat: later routines confirm and it becomes 'skipped'", () => {
  let list = taps("a", T0, T0 + 5 * SEC);
  let starts = confirmedStarts(meet, list);
  // b never shows up; c is still in the lookahead, so the crowd can tap it.
  const cAt = T0 + 8 * MIN;
  assert.equal(tapRejection(meet, starts, "c", cAt), null);
  list = [...list, ...taps("c", cAt, cAt + 5 * SEC)];
  starts = confirmedStarts(meet, list);
  assert.equal(anchorOf(meet, starts, "1")?.teamId, "c");
  const now = cAt + 3 * MIN;
  assert.equal(tapRejection(meet, starts, "d", now), null);
  assert.equal(tapRejection(meet, starts, "e", now), null);
  const b = etaFor(meet, starts, "b", now)!;
  assert.equal(b.status, "skipped");
  assert.equal(b.estimatedAt, b.scheduledAt);
  assert.deepEqual(dueAlerts(b, now), []);
});

test("a swap works via lookbehind: the later team goes first, then the earlier one", () => {
  let list = taps("a", T0, T0 + 5 * SEC);
  // c takes the mat before b.
  const cAt = T0 + 5 * MIN;
  assert.equal(tapRejection(meet, confirmedStarts(meet, list), "c", cAt), null);
  list = [...list, ...taps("c", cAt, cAt + 2 * SEC)];
  let starts = confirmedStarts(meet, list);
  assert.equal(etaFor(meet, starts, "b", cAt + 1 * MIN)!.status, "skipped");
  // Then b performs: it's just before the anchor, so it's still tappable (after the 120 s gap).
  const bAt = cAt + 4 * MIN;
  assert.equal(tapRejection(meet, starts, "b", cAt + 1 * MIN), "too-soon");
  assert.equal(tapRejection(meet, starts, "b", bAt), null);
  list = [...list, ...taps("b", bAt, bAt + 2 * SEC)];
  starts = confirmedStarts(meet, list);
  assert.equal(starts.get("b"), bAt + 1 * SEC);
  assert.equal(etaFor(meet, starts, "b", bAt + 1 * MIN)!.status, "on-mat");
  // The anchor (and the mat's drift) is still c, the latest-scheduled confirmed routine.
  assert.equal(anchorOf(meet, starts, "1")?.teamId, "c");
  assert.equal(etaFor(meet, starts, "d", bAt + 1 * MIN)!.estimatedAt, starts.get("c")! + 4 * MIN);
});

test("lookbehind: the nearest two unconfirmed routines before the anchor, skipping confirmed ones", () => {
  const now = T0 + 30 * MIN;
  const onlyE = startsOf([["e", 16]]);
  assert.equal(tapRejection(meet, onlyE, "d", now), null);
  assert.equal(tapRejection(meet, onlyE, "c", now), null);
  assert.equal(tapRejection(meet, onlyE, "b", now), "not-next");
  const cAndE = startsOf([
    ["c", 8],
    ["e", 16],
  ]);
  assert.equal(tapRejection(meet, cAndE, "d", now), null);
  assert.equal(tapRejection(meet, cAndE, "b", now), null);
  assert.equal(tapRejection(meet, cAndE, "a", now), "not-next");
  // A confirmed routine that isn't the anchor is not tappable.
  assert.equal(tapRejection(meet, cAndE, "c", now), "not-next");
});

// --- estimates, statuses, alerts --------------------------------------------

test("with no anchor, estimates are the schedule", () => {
  const est = estimateStarts(meet, new Map());
  for (const s of meet.slots) assert.equal(est.get(s.teamId), s.scheduledAt);
});

test("ETA walks forward from the anchor and fires countdown alerts", () => {
  const starts = startsOf([["b", 24]]); // 20 min behind
  const now = T0 + 25 * MIN;
  const eta = etaFor(meet, starts, "c", now)!;
  assert.equal(eta.status, "upcoming");
  assert.equal(eta.driftMinutes, 20);
  assert.equal(eta.estimatedAt, T0 + 28 * MIN);
  assert.deepEqual(dueAlerts(eta, now), [60, 20, 5]);
  assert.deepEqual(dueAlerts(eta, T0 + 10 * MIN), [60, 20]);
  assert.equal(etaFor(meet, starts, "a", now)!.status, "skipped");
});

test("usualGap is the median scheduled gap; an even count floors the middle two's mean", () => {
  assert.equal(usualGap(matOrder(meet, "1")), 4 * MIN);
  const ms = (scheduledAt: number) => ({ teamId: `t${scheduledAt}`, mat: "1", scheduledAt });
  assert.equal(usualGap([ms(T0), ms(T0 + 1), ms(T0 + 3)]), 1); // gaps of 1 ms and 2 ms
  assert.equal(usualGap([ms(T0), ms(T0 + 1), ms(T0 + 3), ms(T0 + 13)]), 2); // 1, 2, 10
  assert.equal(usualGap(matOrder(makeMeet([["a", "1", 0]]), "1")), 0);
});

test("positive drift shrinks across a break while negative drift carries", () => {
  // Gaps 4, 4, 30, 4 → usualGap 4 min; 30 > 4 + 5 is a break.
  const m = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4],
    ["c", "1", 8],
    ["d", "1", 38],
    ["e", "1", 42],
  ]);
  const est = (starts: Map<string, number>, id: string) => estimateStarts(m, starts).get(id)! - T0;
  // 12 min late before the break: the break absorbs all of it.
  assert.equal(est(startsOf([["c", 20]]), "d"), 38 * MIN);
  assert.equal(est(startsOf([["c", 20]]), "e"), 42 * MIN);
  // 32 min late: the break absorbs most of it, never more than (gap - usualGap).
  assert.equal(est(startsOf([["c", 40]]), "d"), 44 * MIN);
  assert.equal(est(startsOf([["c", 40]]), "e"), 48 * MIN);
  // 2 min early: running ahead carries straight through the break.
  assert.equal(est(startsOf([["c", 6]]), "d"), 36 * MIN);
  assert.equal(est(startsOf([["c", 6]]), "e"), 40 * MIN);
  // Late but no break ahead: the drift carries.
  assert.equal(est(startsOf([["a", 10]]), "c"), 18 * MIN);
});

test("skipped routines estimate their schedule; scratched ones get no estimate", () => {
  const m = makeMeet([
    ["a", "1", 0],
    ["b", "1", 4],
    ["c", "1", 8, "Open", "scratched"],
    ["d", "1", 12],
  ]);
  const est = estimateStarts(m, startsOf([["b", 10]]));
  assert.equal(est.get("a"), T0);
  assert.equal(est.has("c"), false);
  // d walks from b across the scratched slot's gap (8 min: not a break).
  assert.equal(est.get("d"), T0 + 18 * MIN);
  const eta = etaFor(m, new Map(), "c", T0)!;
  assert.equal(eta.status, "scratched");
  assert.deepEqual(dueAlerts(eta, T0 + 60 * MIN), []);
});

test("a confirmed team is on-mat for routineMinutes, then done", () => {
  const starts = startsOf([["a", 0]]);
  assert.equal(etaFor(meet, starts, "a", T0 + 1 * MIN)!.status, "on-mat");
  assert.equal(etaFor(meet, starts, "a", T0 + RULES.routineMinutes * MIN - 1)!.status, "on-mat");
  assert.equal(etaFor(meet, starts, "a", T0 + RULES.routineMinutes * MIN)!.status, "done");
  assert.deepEqual(dueAlerts(etaFor(meet, starts, "a", T0)!, T0), []);
  assert.equal(etaFor(meet, starts, "zzz", T0), undefined);
});
