// RPC parity: seeded random sequences of real RPC calls (many identities,
// retries, bad input) against a model built only from src/. Every single
// response must equal what the TS says at the instant the RPC judged
// (the transaction's now()), and the database must end in the model's state:
//   check_in / cast_ballot  ≡ checkInRejection, applyCheckIn, validateBallot,
//                             then tally / computeBoard / computeRecaps;
//   tap_mat / op_set_start / op_set_status
//                           ≡ tapRejection at the backdated tap time + rule 5,
//                             then confirmedStart over the stored taps, with
//                             operator starts overriding and scratches hiding them.
// test/db/parity.test.ts covers the same rules on bulk fixtures and exact
// boundaries; this file proves the RPC wrappers (locks, ordering, upserts,
// deletes, response shapes) don't change the answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBoard, computeRecaps } from "../../src/results.ts";
import { compareIds, MINUTE, RULES, SECOND } from "../../src/rules.ts";
import { tapRejection, type Starts } from "../../src/schedule.ts";
import { AWARDS, type Award, type Ballot, type FanProfile, type MatTap, type Meet } from "../../src/types.ts";
import { applyCheckIn, checkInRejection, tally, validateBallot } from "../../src/voting.ts";
import { seededUuid } from "../fixtures.ts";
import {
  dbSuite,
  seedMeet,
  setStart,
  storedTallies,
  type RoutineSpec,
  type SeededMeet,
  type TestDb,
} from "./harness.ts";
import { crowdOracle, LATE_TAPS, loadStarts, loadTaps, MAX_AGE, prng, shuffle } from "./parity-kit.ts";

const UNKNOWN = "zz-not-a-team";
/** Sequences per test and mode (JUDGEY_PARITY_SEEDS=240 → 10). */
const RUNS = Math.max(1, Math.round(Number(process.env.JUDGEY_PARITY_SEEDS ?? 24) / 24));
const CODE = "parity-operator-code";

/** The domain Meet behind a seeded one (seedMeet's naming: team name = id upper-cased, gym 'Test Gym'). */
function domainMeet(seeded: SeededMeet, specs: RoutineSpec[], minTaps: number): Meet {
  const slots = specs.map((s) => ({
    teamId: s.team,
    mat: s.mat ?? "1",
    scheduledAt: seeded.scheduled[s.team],
    status: s.status ?? ("scheduled" as const),
  }));
  return {
    id: seeded.id,
    name: "Test Meet",
    venue: "",
    city: "",
    timeZone: "America/New_York",
    startsAt: seeded.t0,
    mats: [...new Set(slots.map((s) => s.mat))],
    teams: specs.map((s) => ({
      id: s.team,
      name: s.team.toUpperCase(),
      gym: "Test Gym",
      division: s.division ?? "Div",
    })),
    slots,
    minTaps,
  };
}

const count = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

dbSuite("RPC parity with src/", (ctx) => {
  test("check_in and cast_ballot sequences ≡ checkInRejection, applyCheckIn, validateBallot; tallies, board and recaps follow", async (t) => {
    const seen = new Map<string, number>();
    for (let run = 0; run < RUNS; run++)
      await ballotSequence(ctx.db, (ctx.mode === "legacy" ? 202 : 101) + 1000 * run, seen);
    t.diagnostic(`coverage ${JSON.stringify(Object.fromEntries([...seen].sort()))}`);
    for (const reason of ["ok", "too-many", "unknown-team", "removed-ballots"]) {
      assert.ok(seen.has(`check_in:${reason}`), `check_in ${reason} exercised`);
    }
    for (const reason of ["ok", "not-checked-in", "own-team", "window-closed", "already-voted", "invalid"]) {
      assert.ok(seen.has(`cast_ballot:${reason}`), `cast_ballot ${reason} exercised`);
    }
  });

  test("tap_mat and operator sequences ≡ tapRejection + rule 5 and confirmedStart over the stored taps", async (t) => {
    const seen = new Map<string, number>();
    for (let run = 0; run < RUNS; run++) {
      const minTaps = (ctx.mode === "legacy" ? 3 : 2) + (run % 2);
      await tapSequence(ctx.db, (ctx.mode === "legacy" ? 404 : 303) + 1000 * run, minTaps, seen);
    }
    t.diagnostic(`coverage ${JSON.stringify(Object.fromEntries([...seen].sort()))}`);
    for (const key of [
      "tap:ok",
      "tap:confirmed",
      "tap:unknown-team",
      "tap:scratched",
      "tap:too-early",
      "tap:not-next",
      "tap:too-soon",
      "tap:already-confirmed",
      "op_set_start:set",
      "op_set_start:clear",
      "op_set_start:not-operator",
      "op_set_start:unknown-team",
      "op_set_status:changed",
      "op_set_status:invalid",
      "op_set_status:not-operator",
      "op_set_status:unknown-team",
    ]) {
      assert.ok(seen.has(key), `${key} exercised`);
    }
  });
});

/** Random check-ins and ballots from a dozen fans; every response and the final state match the TS. */
async function ballotSequence(db: TestDb, seed: number, seen: Map<string, number>): Promise<void> {
  const r = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

  const specs: RoutineSpec[] = Array.from({ length: 14 }, (_, i) => ({
    team: `t-${i}`,
    at: -40 + 3 * i,
    mat: String(1 + (i % 2)),
    division: ["Youth 2", "junior 3", "Open"][i % 3],
    status: i === 5 ? "scratched" : "scheduled",
  }));
  const seeded = await seedMeet(db, specs);
  const meet = domainMeet(seeded, specs, RULES.minTaps);
  // Voting windows relative to the database clock: closed, in grace, open,
  // not open yet, never started; t-5 is scratched (with a start), t-7 is an operator start.
  const offsets: Record<string, number> = {
    "t-0": -40 * MINUTE,
    "t-1": -30 * MINUTE,
    "t-2": -12 * MINUTE,
    "t-3": -(10 * MINUTE + 40 * SECOND),
    "t-4": -9 * MINUTE,
    "t-5": -2 * MINUTE,
    "t-6": -2 * MINUTE,
    "t-7": -MINUTE,
    "t-8": 3 * MINUTE,
  };
  const starts: Starts = new Map();
  for (const [team, offset] of Object.entries(offsets)) {
    await setStart(db, seeded.id, team, seeded.t0 + offset, team === "t-7" ? "operator" : "crowd");
    if (team !== "t-5") starts.set(team, seeded.t0 + offset);
  }
  const live = meet.slots.filter((s) => s.status !== "scratched").map((s) => s.teamId);
  const teams = [...meet.slots.map((s) => s.teamId), UNKNOWN];
  const open = ["t-3", "t-4", "t-6", "t-7"]; // voting open (or in grace) for the whole sequence

  const fans = Array.from({ length: 12 }, () => seededUuid(r));
  const profiles = new Map<string, FanProfile>();
  let ballots: Ballot[] = [];

  for (let k = 0; k < 500; k++) {
    const me = pick(fans);
    if (r() < 0.12) {
      const kind = r();
      let home: Array<string | null> | null;
      if (kind < 0.05) home = null;
      else if (kind < 0.15) home = shuffle(r, live).slice(0, RULES.maxHomeTeams + 1);
      else if (kind < 0.17) home = shuffle(r, live).slice(0, RULES.maxHomeTeams);
      else {
        home = Array.from({ length: int(0, 3) }, () => (r() < 0.08 ? pick([UNKNOWN, "t-5"]) : pick(live)));
        if (home.length && r() < 0.2) home.push(home[0]);
        if (r() < 0.03) home.push(null);
      }
      const { result } = await db.rpcAt(me, "check_in", { p_meet: meet.id, p_home_team_ids: home });
      const ids = (home ?? []) as string[];
      const reason = checkInRejection(meet, ids);
      if (reason) {
        assert.deepEqual(result, { ok: false, reason }, `op ${k}: check_in ${JSON.stringify(home)}`);
        count(seen, `check_in:${reason}`);
        continue;
      }
      const mine = ballots.filter((b) => b.deviceId === me);
      const { profile, removedBallotTeamIds } = applyCheckIn(profiles.get(me) ?? null, me, ids, mine);
      assert.deepEqual(
        result,
        {
          ok: true,
          fan: { homeTeamIds: profile.homeTeamIds, everHomeTeamIds: profile.everHomeTeamIds },
          removedBallotTeamIds,
        },
        `op ${k}: check_in ${JSON.stringify(home)}`,
      );
      profiles.set(me, profile);
      ballots = ballots.filter((b) => !(b.deviceId === me && removedBallotTeamIds.includes(b.teamId)));
      count(seen, removedBallotTeamIds.length ? "check_in:removed-ballots" : "check_in:ok");
    } else {
      const teamId = r() < 0.5 ? pick(open) : pick(teams);
      const stars = pick<number | null>([1, 2, 3, 4, 5, 5, 4, 4, 3, 0, 6, 2.5, NaN, null]);
      const kind = r();
      const awards: Array<string | null> | null =
        kind < 0.6
          ? AWARDS.filter(() => r() < 0.3).reverse()
          : kind < 0.75
            ? [pick(AWARDS), pick(AWARDS), pick(AWARDS)] // duplicates: stored once
            : kind < 0.85
              ? []
              : kind < 0.9
                ? ["best-hair"]
                : kind < 0.95
                  ? [null]
                  : null;
      const { result, now } = await db.rpcAt(me, "cast_ballot", {
        p_meet: meet.id,
        p_team: teamId,
        p_stars: stars,
        p_awards: awards,
      });
      const ballot = { deviceId: me, teamId, stars, awards, castAt: now } as unknown as Ballot;
      const error = validateBallot(ballot, {
        profile: profiles.get(me) ?? null,
        teamStartedAt: starts.get(teamId),
        existing: ballots,
      });
      assert.deepEqual(
        result,
        error ? { ok: false, reason: error.reason } : { ok: true },
        `op ${k}: cast_ballot ${teamId} ${stars} ${JSON.stringify(awards)} at ${now}`,
      );
      count(seen, `cast_ballot:${error?.reason ?? "ok"}`);
      if (!error) ballots.push({ ...ballot, awards: [...new Set(awards as Award[])].sort(compareIds) });
    }
  }

  // The database ends where the model does.
  const rows = await db.sql<{ team_id: string; user_id: string; stars: number; awards: string[] }>(
    "select team_id, user_id::text, stars, awards from public.ballots where meet_id = $1",
    [meet.id],
  );
  const key = (x: { teamId: string; deviceId: string }) => `${x.teamId} ${x.deviceId}`;
  assert.deepEqual(
    rows
      .map((b) => ({ teamId: b.team_id, deviceId: b.user_id, stars: b.stars, awards: b.awards }))
      .sort((a, b) => compareIds(key(a), key(b))),
    ballots
      .map(({ teamId, deviceId, stars, awards }) => ({ teamId, deviceId, stars, awards }))
      .sort((a, b) => compareIds(key(a), key(b))),
    "ballots",
  );
  assert.deepEqual(
    await storedTallies(db, meet.id),
    [...tally(ballots).values()]
      .sort((a, b) => compareIds(a.teamId, b.teamId))
      .map((x) => ({ team_id: x.teamId, votes: x.votes, star_sum: x.starSum, ...x.awards })),
    "team_tallies",
  );
  const snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id });
  assert.deepEqual(snap.board, computeBoard(meet, starts, ballots, snap.serverNow), "board");
  for (const fan of fans) {
    const state = await db.rpc(fan, "my_state", { p_meet: meet.id });
    const profile = profiles.get(fan);
    const board = computeBoard(meet, starts, ballots, state.serverNow);
    assert.deepEqual(
      state,
      {
        serverNow: state.serverNow,
        fan: profile ? { homeTeamIds: profile.homeTeamIds, everHomeTeamIds: profile.everHomeTeamIds } : null,
        tappedTeamIds: [],
        ballots: ballots
          .filter((b) => b.deviceId === fan)
          .sort((a, b) => a.castAt - b.castAt || compareIds(a.teamId, b.teamId))
          .map(({ teamId, stars, awards }) => ({ teamId, stars, awards })),
        recaps: computeRecaps(meet, starts, ballots, profile?.homeTeamIds ?? [], state.serverNow, board),
        isOperator: false,
      },
      `my_state of ${fan}`,
    );
  }
}

/** Random taps (backdated, retried, mistaken) plus operator fixes; every response and the final state match the TS. */
async function tapSequence(db: TestDb, seed: number, minTaps: number, seen: Map<string, number>): Promise<void> {
  const r = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

  // Two mats around "now": a late first mat with a stale crowd anchor, a second
  // mat run by an operator, a scratch, a lone early tap, and far-future routines.
  const specs: RoutineSpec[] = [
    ...[-30, -26, -22, -18, -14, -10, -6, -2, 2, 50].map((at, i) => ({
      team: `m1-${i}`,
      at,
      mat: "1",
      status: i === 3 ? ("scratched" as const) : ("scheduled" as const),
    })),
    ...[-12, -8, -4, 0, 4, 47].map((at, i) => ({ team: `m2-${i}`, at, mat: "2" })),
  ];
  const seeded = await seedMeet(db, specs, { minTaps, operatorCode: CODE });
  const meet = domainMeet(seeded, specs, minTaps);
  const { t0 } = seeded;
  const users = Array.from({ length: 9 }, () => seededUuid(r));
  const [operator, outsider] = [seededUuid(r), seededUuid(r)];
  assert.deepEqual(await db.rpc(operator, "claim_operator", { p_meet: meet.id, p_code: CODE }), { ok: true });

  // Model state: the stored taps (one per identity per routine) and operator starts.
  let stored: MatTap[] = [];
  const operatorStarts = new Map<string, number>();
  const slotOf = (teamId: string) => meet.slots.find((s) => s.teamId === teamId);
  const crowd = (teamId: string) => {
    const slot = slotOf(teamId)!;
    const times = stored.filter((x) => x.teamId === teamId).map((x) => x.at);
    return crowdOracle(times, slot.scheduledAt, minTaps);
  };
  const effective = () => {
    const starts: Starts = new Map();
    for (const slot of meet.slots) {
      if (slot.status === "scratched") continue;
      const at = operatorStarts.get(slot.teamId) ?? crowd(slot.teamId)?.start;
      if (at !== undefined) starts.set(slot.teamId, at);
    }
    return starts;
  };

  // History. Taps inserted as the superuser: m1-0, m1-1 and m1-4 confirmed by
  // the crowd (m1-4 five minutes ago: the anchor, past its rule-5 window) and a
  // lone tap on m1-2. Then an operator start on m2-0 three minutes ago.
  const tapAt = (teamId: string, user: number, at: number): MatTap => ({ teamId, deviceId: users[user], at });
  const history: MatTap[] = [
    tapAt("m1-0", 0, t0 - 29 * MINUTE),
    tapAt("m1-0", 1, t0 - 29 * MINUTE + 4 * SECOND),
    tapAt("m1-0", 2, t0 - 29 * MINUTE + 9 * SECOND),
    tapAt("m1-1", 3, t0 - 24 * MINUTE),
    tapAt("m1-1", 4, t0 - 24 * MINUTE + 30 * SECOND),
    tapAt("m1-1", 0, t0 - 24 * MINUTE + 50 * SECOND),
    tapAt("m1-2", 5, t0 - 20 * MINUTE),
    tapAt("m1-4", 6, t0 - 5 * MINUTE),
    tapAt("m1-4", 7, t0 - 5 * MINUTE + 2 * SECOND),
    tapAt("m1-4", 8, t0 - 5 * MINUTE + 40 * SECOND),
  ];
  for (const x of history) {
    await db.sql("insert into public.taps values ($1, $2, $3, judgey_private.from_ms($4))", [
      meet.id,
      x.teamId,
      x.deviceId,
      x.at,
    ]);
  }
  stored = [...history];
  await db.sql("select judgey_private.recompute_start($1, r.team_id) from public.routines r where r.meet_id = $1", [
    meet.id,
  ]);
  const opStart = { p_meet: meet.id, p_team: "m2-0", p_started_at_ms: t0 - 3 * MINUTE };
  assert.deepEqual(await db.rpc(operator, "op_set_start", opStart), { ok: true });
  operatorStarts.set("m2-0", t0 - 3 * MINUTE);

  const teams = [...meet.slots.map((s) => s.teamId), UNKNOWN];
  let lastNow = t0;
  let version = 1;
  const checkStarts = async (label: string) => {
    const snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id, p_have_version: 0 });
    const starts = effective();
    assert.deepEqual(
      snap.starts,
      [...starts]
        .sort(([a], [b]) => compareIds(a, b))
        .map(([teamId, startedAt]) => ({
          teamId,
          startedAt,
          source: operatorStarts.has(teamId) ? "operator" : "crowd",
        })),
      `${label}: snapshot starts`,
    );
    assert.equal(snap.scheduleVersion, version, `${label}: schedule version`);
    assert.deepEqual(
      snap.schedule.routines.map((x: { teamId: string; status: string }) => `${x.teamId}:${x.status}`).sort(),
      meet.slots.map((s) => `${s.teamId}:${s.status}`).sort(),
      `${label}: statuses`,
    );
  };
  await checkStarts("history");

  for (let k = 0; k < 450; k++) {
    const op = r();
    if (op < 0.82) {
      // The crowd mostly taps what the TS says is tappable, plus mistakes.
      const tappable = teams.filter((id) => tapRejection(meet, effective(), id, lastNow) === null);
      const teamId = tappable.length && r() < 0.6 ? pick(tappable) : pick(teams);
      const me = pick(users);
      const age = pick<number | null>([0, 0, int(0, 130_000), int(0, 30_000), -1000, null, 600_000]);
      const { result, now } = await db.rpcAt(me, "tap_mat", { p_meet: meet.id, p_team: teamId, p_age_ms: age });
      lastNow = now;
      const at = now - Math.min(Math.max(age ?? 0, 0), MAX_AGE);
      const before = effective();
      let reason: string | null = tapRejection(meet, before, teamId, at);
      if (reason === null && before.has(teamId)) {
        const late = operatorStarts.has(teamId) || now > crowd(teamId)!.c + LATE_TAPS;
        if (late) reason = "already-confirmed";
      }
      if (reason === null && !stored.some((x) => x.teamId === teamId && x.deviceId === me)) {
        stored.push({ teamId, deviceId: me, at });
      }
      const start = effective().get(teamId);
      const expected: Record<string, unknown> = { ok: reason === null, confirmed: start !== undefined };
      if (reason !== null) expected.reason = reason;
      if (start !== undefined) expected.startedAt = start;
      assert.deepEqual(result, expected, `op ${k}: ${me} taps ${teamId} (age ${age}) at ${at}, now ${now}`);
      count(seen, `tap:${reason ?? "ok"}`);
      if (reason === null && before.get(teamId) === undefined && start !== undefined) count(seen, "tap:confirmed");
    } else if (op < 0.91) {
      const caller = r() < 0.85 ? operator : outsider;
      const teamId = r() < 0.9 ? pick(meet.slots).teamId : UNKNOWN;
      const value = r() < 0.4 ? null : lastNow - int(0, 10 * MINUTE);
      const { result } = await db.rpcAt(caller, "op_set_start", {
        p_meet: meet.id,
        p_team: teamId,
        p_started_at_ms: value,
      });
      const reason = caller !== operator ? "not-operator" : !slotOf(teamId) ? "unknown-team" : null;
      assert.deepEqual(
        result,
        reason ? { ok: false, reason } : { ok: true },
        `op ${k}: op_set_start ${teamId} ${value}`,
      );
      count(seen, `op_set_start:${reason ?? (value === null ? "clear" : "set")}`);
      if (reason) continue;
      if (value === null) {
        operatorStarts.delete(teamId);
        stored = stored.filter((x) => x.teamId !== teamId);
      } else {
        operatorStarts.set(teamId, value);
      }
      await checkStarts(`op ${k}`);
    } else {
      const caller = r() < 0.85 ? operator : outsider;
      const teamId = r() < 0.9 ? pick(meet.slots).teamId : UNKNOWN;
      const status = pick(["scratched", "scheduled", "scheduled", "bogus", null]);
      const { result } = await db.rpcAt(caller, "op_set_status", { p_meet: meet.id, p_team: teamId, p_status: status });
      const slot = slotOf(teamId);
      const reason =
        caller !== operator
          ? "not-operator"
          : status !== "scratched" && status !== "scheduled"
            ? "invalid"
            : !slot
              ? "unknown-team"
              : null;
      assert.deepEqual(
        result,
        reason ? { ok: false, reason } : { ok: true },
        `op ${k}: op_set_status ${teamId} ${status}`,
      );
      count(seen, `op_set_status:${reason ?? "ok"}`);
      if (reason) continue;
      if (slot!.status !== status) {
        slot!.status = status as "scheduled" | "scratched";
        version++;
        count(seen, "op_set_status:changed");
      }
      await checkStarts(`op ${k}`);
    }
  }

  // The database ends where the model does: taps, starts (with c and counted taps), my_state.
  await checkStarts("end");
  const key = (x: MatTap) => `${x.teamId} ${x.deviceId}`;
  assert.deepEqual(
    (await loadTaps(db, meet.id)).sort((a, b) => compareIds(key(a), key(b))),
    [...stored].sort((a, b) => compareIds(key(a), key(b))),
    "stored taps",
  );
  const rows = await loadStarts(db, meet.id);
  for (const slot of meet.slots) {
    const at = operatorStarts.get(slot.teamId);
    const c = crowd(slot.teamId);
    const expected =
      at !== undefined
        ? { started: at, confirmed: null, n: 0, source: "operator" }
        : c && { started: c.start, confirmed: c.c, n: c.n, source: "crowd" };
    assert.deepEqual(rows.get(slot.teamId), expected, `routine_starts of ${slot.teamId}`);
  }
  for (const me of users) {
    const state = await db.rpc(me, "my_state", { p_meet: meet.id });
    assert.deepEqual(
      state.tappedTeamIds,
      stored
        .filter((x) => x.deviceId === me)
        .sort((a, b) => a.at - b.at || compareIds(a.teamId, b.teamId))
        .map((x) => x.teamId),
      `tappedTeamIds of ${me}`,
    );
  }
  assert.equal((await db.rpc(operator, "my_state", { p_meet: meet.id })).isOperator, true);
}
