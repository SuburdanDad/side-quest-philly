// Real overlapping transactions on separate connections. Each test proves the
// overlap (one backend observed waiting on a lock, or both in flight at once)
// instead of trusting timing.

import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {
  begin,
  callRpc,
  dbSuite,
  MINUTE,
  seedMeet,
  setStart,
  storedTallies,
  talliesFromBallots,
  user,
  waitUntilBlocked,
  type Caller,
  type Json,
  type TestDb,
} from "./harness.ts";

/** Two dedicated connections with their backend pids. */
async function pair(db: TestDb): Promise<Array<{ c: pg.PoolClient; pid: number }>> {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const c = await db.connect();
    out.push({ c, pid: (await c.query("select pg_backend_pid() as pid")).rows[0].pid as number });
  }
  return out;
}

/** Start an RPC in an open transaction; resolves to its result (transaction left open). */
async function open<T = Json>(c: pg.PoolClient, caller: Caller, fn: string, args: Record<string, unknown>): Promise<T> {
  await begin(c, caller);
  return callRpc<T>(c, fn, args);
}

dbSuite("concurrency", (ctx) => {
  test("two phones tap the same routine at once → it confirms (routine row lock)", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -1 }]);
    const [one, two] = await pair(db);
    try {
      const first = await open(one.c, user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
      assert.deepEqual(first, { ok: true, confirmed: false });
      const second = open(two.c, user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
      await waitUntilBlocked(db, two.pid); // serialized on the routine row, not racing
      await one.c.query("commit");
      const res = await second;
      await two.c.query("commit");
      assert.equal(res.ok, true);
      assert.equal(res.confirmed, true, "the second tap sees the first one");
    } finally {
      one.c.release();
      two.c.release();
    }
    const rows = await db.sql("select source, confirmations from public.routine_starts where meet_id = $1", [meet.id]);
    assert.deepEqual(rows, [{ source: "crowd", confirmations: 2 }]);
  });

  test("simultaneous taps with both transactions in flight (pg_sleep) still confirm", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -1 }]);
    const [one, two] = await pair(db);
    try {
      const run = async ({ c }: { c: pg.PoolClient }) => {
        await begin(c, user());
        const [res] = (
          await c.query("select public.tap_mat(p_meet => $1, p_team => 'a') as r, pg_sleep(0.3)", [meet.id])
        ).rows.map((r) => r.r);
        await c.query("commit");
        return res;
      };
      const results = await Promise.all([run(one), run(two)]);
      assert.deepEqual(
        results.map((r) => r.ok),
        [true, true],
      );
      assert.equal(results.filter((r) => r.confirmed).length, 1, "exactly the later one confirms");
    } finally {
      one.c.release();
      two.c.release();
    }
    const rows = await db.sql("select confirmations from public.routine_starts where meet_id = $1", [meet.id]);
    assert.deepEqual(rows, [{ confirmations: 2 }]);
  });

  test("cast_ballot then check_in(same team): check_in waits, then removes the ballot", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "t", at: -5 }]);
    await setStart(db, meet.id, "t", meet.t0 - 2 * MINUTE);
    const me = user();
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    const [one, two] = await pair(db);
    try {
      const ballot = await open(one.c, me, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 5, p_awards: ["spirit"] });
      assert.deepEqual(ballot, { ok: true });
      const checkIn = open(two.c, me, "check_in", { p_meet: meet.id, p_home_team_ids: ["t"] });
      await waitUntilBlocked(db, two.pid);
      await one.c.query("commit");
      const res = await checkIn;
      await two.c.query("commit");
      assert.deepEqual(res.removedBallotTeamIds, ["t"]);
    } finally {
      one.c.release();
      two.c.release();
    }
    assert.deepEqual(await db.sql("select * from public.ballots where meet_id = $1", [meet.id]), []);
    assert.deepEqual(await storedTallies(db, meet.id), []);
    assert.deepEqual(await storedTallies(db, meet.id), await talliesFromBallots(db, meet.id));
  });

  test("check_in(team) then cast_ballot(same team): the ballot waits, then gets 'own-team'", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "t", at: -5 }]);
    await setStart(db, meet.id, "t", meet.t0 - 2 * MINUTE);
    const me = user();
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    const [one, two] = await pair(db);
    try {
      const res = await open(one.c, me, "check_in", { p_meet: meet.id, p_home_team_ids: ["t"] });
      assert.equal(res.ok, true);
      const ballot = open(two.c, me, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 5 });
      await waitUntilBlocked(db, two.pid);
      await one.c.query("commit");
      assert.deepEqual(await ballot, { ok: false, reason: "own-team" });
      await two.c.query("commit");
    } finally {
      one.c.release();
      two.c.release();
    }
    assert.deepEqual(await db.sql("select * from public.ballots where meet_id = $1", [meet.id]), []);
  });

  test("the same ballot sent twice at once counts once ('already-voted')", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "t", at: -5 }]);
    await setStart(db, meet.id, "t", meet.t0 - 2 * MINUTE);
    const me = user();
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    const [one, two] = await pair(db);
    try {
      assert.deepEqual(await open(one.c, me, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 4 }), { ok: true });
      const retry = open(two.c, me, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 4 });
      await waitUntilBlocked(db, two.pid); // on the ballots primary key
      await one.c.query("commit");
      assert.deepEqual(await retry, { ok: false, reason: "already-voted" });
      await two.c.query("commit");
    } finally {
      one.c.release();
      two.c.release();
    }
    assert.deepEqual(await storedTallies(db, meet.id), [
      { team_id: "t", votes: 1, star_sum: 4, stunts: 0, tumbling: 0, spirit: 0, dance: 0 },
    ]);
  });

  test("a tap or an operator fix in flight blocks neither ballots for that routine nor the snapshot", async () => {
    // tap_mat and op_set_start hold the routine row FOR NO KEY UPDATE until commit; the
    // ballot's foreign-key check only needs KEY SHARE, and the snapshot takes no row locks.
    const { db } = ctx;
    const code = "in-flight-code";
    const meet = await seedMeet(db, [{ team: "t", at: -5 }], { operatorCode: code });
    // Two real taps a minute ago confirm t (a start row without taps would not survive the next recompute).
    for (const age of [60_000, 59_000]) {
      await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "t", p_age_ms: age });
    }
    const op = user();
    assert.deepEqual(await db.rpc(op, "claim_operator", { p_meet: meet.id, p_code: code }), { ok: true });
    const [one, two] = await pair(db);
    const voteWhileHeld = async (caller: Caller, fn: string, args: Record<string, unknown>) => {
      const held = await open(one.c, caller, fn, args);
      assert.equal(held.ok, true, `${fn} holds the routine row`);
      const fan = user();
      await db.rpc(fan, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
      await begin(two.c, fan);
      await two.c.query("set local lock_timeout = '2s'");
      assert.deepEqual(await callRpc(two.c, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 5 }), { ok: true });
      assert.equal((await callRpc(two.c, "meet_snapshot", { p_meet: meet.id })).meetId, meet.id);
      await two.c.query("commit");
      await one.c.query("commit");
    };
    try {
      await voteWhileHeld(user(), "tap_mat", { p_meet: meet.id, p_team: "t" }); // the anchor: more confirmations
      await voteWhileHeld(op, "op_set_start", { p_meet: meet.id, p_team: "t", p_started_at_ms: meet.t0 - MINUTE });
    } finally {
      for (const { c } of [two, one]) {
        await c.query("rollback").catch(() => {});
        c.release();
      }
    }
    assert.deepEqual(await storedTallies(db, meet.id), await talliesFromBallots(db, meet.id));
    assert.equal((await storedTallies(db, meet.id))[0].votes, 2);
  });

  test("many fans voting at once keep tallies equal to the ballots", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "t", at: -9 },
      { team: "u", at: -5 },
    ]);
    await setStart(db, meet.id, "t", meet.t0 - 4 * MINUTE);
    await setStart(db, meet.id, "u", meet.t0 - 2 * MINUTE);
    const fans = Array.from({ length: 24 }, () => user());
    await Promise.all(fans.map((f) => db.rpc(f, "check_in", { p_meet: meet.id, p_home_team_ids: [] })));
    await Promise.all(
      fans.flatMap((f, i) => [
        db.rpc(f, "cast_ballot", { p_meet: meet.id, p_team: "t", p_stars: 1 + (i % 5), p_awards: i % 3 ? ["stunts"] : [] }),
        db.rpc(f, "cast_ballot", { p_meet: meet.id, p_team: "u", p_stars: 5, p_awards: ["dance", "spirit"] }),
      ]),
    );
    // Half of them then follow u: their u ballots are removed concurrently.
    await Promise.all(
      fans.slice(0, 12).map((f) => db.rpc(f, "check_in", { p_meet: meet.id, p_home_team_ids: ["u"] })),
    );
    const tallies = await storedTallies(db, meet.id);
    assert.deepEqual(tallies, await talliesFromBallots(db, meet.id));
    assert.equal(tallies.find((t) => t.team_id === "t")!.votes, 24);
    assert.equal(tallies.find((t) => t.team_id === "u")!.votes, 12);
  });
});
