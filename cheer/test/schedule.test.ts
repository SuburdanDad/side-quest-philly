import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedStart, dueAlerts, etaFor, matDrift } from "../src/schedule.ts";
import type { MatTap, Slot } from "../src/types.ts";

const MIN = 60_000;
const T0 = Date.UTC(2026, 11, 5, 14, 0); // 9:00am ET meet start

const slots: Slot[] = [
  { teamId: "a", mat: "1", scheduledAt: T0 },
  { teamId: "b", mat: "1", scheduledAt: T0 + 3 * MIN },
  { teamId: "c", mat: "1", scheduledAt: T0 + 6 * MIN },
  { teamId: "x", mat: "2", scheduledAt: T0 + 6 * MIN },
];
const tap = (teamId: string, deviceId: string, at: number): MatTap => ({ teamId, deviceId, at });

test("one tap is not enough to confirm a start", () => {
  assert.equal(confirmedStart(slots[0], [tap("a", "d1", T0)]), undefined);
});

test("confirmed start is the median of distinct devices", () => {
  const taps = [
    tap("a", "d1", T0 + 10 * MIN),
    tap("a", "d2", T0 + 11 * MIN),
    tap("a", "d3", T0 + 30 * MIN), // outlier
    tap("a", "d1", T0 + 12 * MIN), // d1 again: ignored
  ];
  assert.equal(confirmedStart(slots[0], taps), T0 + 11 * MIN);
});

test("taps far before the scheduled time are ignored", () => {
  const taps = [tap("c", "d1", T0 - 60 * MIN), tap("c", "d2", T0 - 60 * MIN)];
  assert.equal(confirmedStart(slots[2], taps), undefined);
});

test("drift comes from the latest confirmed routine on that mat only", () => {
  const taps = [
    tap("a", "d1", T0 + 5 * MIN),
    tap("a", "d2", T0 + 5 * MIN),
    tap("b", "d1", T0 + 15 * MIN),
    tap("b", "d2", T0 + 15 * MIN),
  ];
  assert.equal(matDrift("1", slots, taps), 12 * MIN);
  assert.equal(matDrift("2", slots, taps), 0);
});

test("ETA shifts with the mat running behind and fires countdown alerts", () => {
  const taps = [tap("b", "d1", T0 + 23 * MIN), tap("b", "d2", T0 + 23 * MIN)];
  const now = T0 + 24 * MIN;
  const eta = etaFor("c", slots, taps, now)!;
  assert.equal(eta.status, "upcoming");
  assert.equal(eta.driftMinutes, 20);
  assert.equal(eta.estimatedAt, T0 + 26 * MIN);
  assert.deepEqual(dueAlerts(eta, now), [60, 20, 5]);
  assert.deepEqual(dueAlerts(eta, T0 + 10 * MIN), [60, 20]);
});

test("a confirmed team is on-mat, then done", () => {
  const taps = [tap("a", "d1", T0), tap("a", "d2", T0)];
  assert.equal(etaFor("a", slots, taps, T0 + 1 * MIN)!.status, "on-mat");
  assert.equal(etaFor("a", slots, taps, T0 + 4 * MIN)!.status, "done");
  assert.equal(etaFor("zzz", slots, taps, T0), undefined);
});
