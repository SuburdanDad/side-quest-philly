import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoards, type RoutineRow } from "../src/board.ts";
import {
  alertText,
  ANY_MINUTE_MS,
  etaCountdown,
  homeOrder,
  matChip,
  STALE_ANCHOR_MS,
  staleAnchorLabel,
} from "../lib/eta-copy.ts";
import { MIN, T0 } from "./fixtures.ts";
import type { Meet } from "../src/types.ts";

const TZ = "America/New_York";

test("etaCountdown: a countdown, then 'Any minute' for 5 min past, then 'Running late · not tapped yet'", () => {
  assert.deepEqual(etaCountdown(T0 + 12 * MIN, T0), { text: "12 min", overdue: false });
  assert.deepEqual(etaCountdown(T0 + 1, T0), { text: "1 min", overdue: false });
  assert.deepEqual(etaCountdown(T0, T0), { text: "Any minute", overdue: true });
  assert.deepEqual(etaCountdown(T0, T0 + ANY_MINUTE_MS), { text: "Any minute", overdue: true });
  assert.deepEqual(etaCountdown(T0, T0 + ANY_MINUTE_MS + 1), { text: "Running late · not tapped yet", overdue: true });
  assert.notEqual(etaCountdown(T0, T0 + 90 * MIN).text, "Now", "never a frozen 'Now'");
});

test("matChip: no anchor is 'Not started yet' (muted), never a green 'On time'", () => {
  assert.deepEqual(matChip({ confirmed: false, driftMinutes: 0 }), { label: "Not started yet", tone: "muted" });
  assert.deepEqual(matChip({ confirmed: true, driftMinutes: 0 }), { label: "On time", tone: "go" });
  assert.deepEqual(matChip({ confirmed: true, driftMinutes: 12 }), { label: "12 min behind", tone: "late" });
});

test("matChip on a real board: a mat nobody has tapped says 'Not started yet'", () => {
  const meet: Meet = {
    id: "m",
    name: "M",
    venue: "",
    city: "",
    timeZone: TZ,
    startsAt: T0,
    mats: ["1", "2"],
    teams: [
      { id: "a", name: "A", gym: "G", division: "D" },
      { id: "x", name: "X", gym: "G", division: "D" },
    ],
    slots: [
      { teamId: "a", mat: "1", scheduledAt: T0, status: "scheduled" },
      { teamId: "x", mat: "2", scheduledAt: T0, status: "scheduled" },
    ],
  };
  const [mat1, mat2] = buildBoards(meet, new Map([["a", T0 + 3 * MIN]]), T0 + 30 * MIN);
  assert.equal(matChip(mat1).label, "3 min behind");
  assert.equal(matChip(mat2).label, "Not started yet");
});

test("staleAnchorLabel: only once the last confirmation is over 20 min old", () => {
  assert.equal(staleAnchorLabel(undefined, T0, TZ), null);
  assert.equal(staleAnchorLabel(T0, T0 + STALE_ANCHOR_MS, TZ), null);
  assert.match(staleAnchorLabel(T0, T0 + STALE_ANCHOR_MS + 1, TZ)!, /^Last confirmed \d{1,2}:\d{2} [AP]M$/);
});

test("alertText: never 'in ~Now'; due or past reads 'is up any minute on Mat N (est. h:mm)'", () => {
  const at = T0 + 4 * MIN;
  assert.match(alertText("Crown", "1", at, T0, TZ), /^Crown goes on in ~4 min · Mat 1, \d{1,2}:\d{2} [AP]M$/);
  for (const now of [at, at + MIN, at + 30 * MIN]) {
    const text = alertText("Crown", "1", at, now, TZ);
    assert.match(text, /^Crown is up any minute on Mat 1 \(est\. \d{1,2}:\d{2} [AP]M\)$/);
    assert.ok(!text.includes("Now"));
  }
});

test("homeOrder: on the mat, then upcoming by ETA, then skipped, done, scratched", () => {
  const row = (id: string, status: RoutineRow["eta"]["status"], estimatedAt: number) =>
    ({ team: { id }, eta: { status, estimatedAt } }) as unknown as RoutineRow;
  const rows = [
    row("done-early", "done", T0),
    row("scratched", "scratched", T0 - MIN),
    row("later", "upcoming", T0 + 40 * MIN),
    row("skipped", "skipped", T0 + MIN),
    row("soon", "upcoming", T0 + 10 * MIN),
    row("on-mat", "on-mat", T0 + 5 * MIN),
    row("done-late", "done", T0 + 2 * MIN),
  ];
  assert.deepEqual(
    rows.sort(homeOrder).map((r) => r.team.id),
    ["on-mat", "soon", "later", "skipped", "done-early", "done-late", "scratched"],
  );
});
