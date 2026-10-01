// tap_mat and recompute_start: the tap gate (§2 rules 1-5) and the crowd
// confirmation protocol (cluster, freeze, median), end to end through the RPC.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, pgCode, SECOND, seedMeet, setStart, user, type TestDb } from "./harness.ts";

const tap = (db: TestDb, me: string, meet: unknown, team: unknown, age: unknown = 0) =>
  db.rpc(me, "tap_mat", { p_meet: meet, p_team: team, p_age_ms: age });

async function tapTimes(db: TestDb, meet: string, team: string): Promise<number[]> {
  const rows = await db.sql<{ at: number }>(
    "select judgey_private.ms(at) as at from public.taps where meet_id = $1 and team_id = $2 order by at",
    [meet, team],
  );
  return rows.map((r) => r.at);
}

async function startRow(db: TestDb, meet: string, team: string) {
  const rows = await db.sql<{ started: number; confirmed: number | null; n: number; source: string }>(
    `select judgey_private.ms(started_at) as started, judgey_private.ms(confirmed_at) as confirmed,
            confirmations as n, source
     from public.routine_starts where meet_id = $1 and team_id = $2`,
    [meet, team],
  );
  return rows[0];
}

/** Insert a tap directly (as the superuser) at an exact time. */
async function rawTap(db: TestDb, meet: string, team: string, at: number, who = user()) {
  await db.sql("insert into public.taps values ($1, $2, $3, judgey_private.from_ms($4))", [meet, team, who, at]);
  return who;
}

const median2 = (a: number, b: number) => Math.floor((a + b + 1) / 2);

dbSuite("tap_mat", (ctx) => {
  test("requires a session", async () => {
    const meet = await seedMeet(ctx.db, [{ team: "a", at: 0 }]);
    await assert.rejects(tap(ctx.db, "no-sub", meet.id, "a"), pgCode("28000"));
  });

  test("unknown-team and scratched", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: 0 },
      { team: "s", at: 4, status: "scratched" },
    ]);
    const me = user();
    for (const [m, t] of [
      [meet.id, "nope"],
      [meet.id, null],
      [null, "a"],
      ["no-such-meet", "a"],
    ]) {
      assert.deepEqual(await tap(db, me, m, t), { ok: false, reason: "unknown-team", confirmed: false });
    }
    assert.deepEqual(await tap(db, me, meet.id, "s"), { ok: false, reason: "scratched", confirmed: false });
    assert.deepEqual(await db.sql("select * from public.taps where user_id = $1", [me]), []);
  });

  test("two taps within 120 s confirm at their median; a lone tap does not", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -1 }]);
    const first = await tap(db, user(), meet.id, "a", 110_000);
    assert.deepEqual(first, { ok: true, confirmed: false });
    const second = await tap(db, user(), meet.id, "a", 0);
    const [t1, t2] = await tapTimes(db, meet.id, "a");
    assert.ok(t2 - t1 >= 110 * SECOND && t2 - t1 < 120 * SECOND, `gap ${t2 - t1}`);
    assert.deepEqual(second, { ok: true, confirmed: true, startedAt: median2(t1, t2) });
    const row = await startRow(db, meet.id, "a");
    assert.deepEqual(row, { started: median2(t1, t2), confirmed: t2, n: 2, source: "crowd" });
  });

  test("two taps more than 120 s apart don't confirm; a third close one does", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -3 }]);
    await rawTap(db, meet.id, "a", meet.t0 - 121 * SECOND);
    assert.deepEqual(await tap(db, user(), meet.id, "a"), { ok: true, confirmed: false });
    assert.equal(await startRow(db, meet.id, "a"), undefined);
    const third = await tap(db, user(), meet.id, "a", 500);
    const [, t2, t3] = await tapTimes(db, meet.id, "a");
    // Cluster starts at the second tap; the stale first tap is not counted.
    assert.deepEqual(third, { ok: true, confirmed: true, startedAt: median2(t2, t3) });
    assert.equal((await startRow(db, meet.id, "a")).n, 2);
  });

  test("p_age_ms is clamped to [0, 120 s]; retries are idempotent (first tap wins)", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }]);
    const [u1, u2] = [user(), user()];
    let before = await db.nowMs();
    await tap(db, u1, meet.id, "a", 10 * MINUTE);
    let after = await db.nowMs();
    let [at] = await tapTimes(db, meet.id, "a");
    assert.ok(at >= before - 120 * SECOND - 1 && at <= after - 120 * SECOND, "clamped to 120 s");
    before = await db.nowMs();
    await tap(db, u2, meet.id, "a", -5000);
    after = await db.nowMs();
    at = (await db.one("select judgey_private.ms(at) as at from public.taps where user_id = $1", [u2])).at;
    assert.ok(at >= before - 1 && at <= after, "negative age → 0");
    // u1 again: accepted (still tappable) but the stored tap does not move.
    const firstAt = (await db.one("select judgey_private.ms(at) as at from public.taps where user_id = $1", [u1])).at;
    const retry = await tap(db, u1, meet.id, "a", 0);
    assert.equal(retry.ok, true);
    const rows = await db.sql("select judgey_private.ms(at) as at from public.taps where user_id = $1", [u1]);
    assert.deepEqual(rows, [{ at: firstAt }]);
    // null age = 0
    assert.equal((await tap(db, user(), meet.id, "a", null)).ok, true);
  });

  test("griefers 45+ min early are rejected ('too-early') and leave no trace", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: 46 },
      { team: "b", at: 50 },
    ]);
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(await tap(db, user(), meet.id, "a"), { ok: false, reason: "too-early", confirmed: false });
      assert.deepEqual(await tap(db, user(), meet.id, "b"), { ok: false, reason: "too-early", confirmed: false });
    }
    assert.deepEqual(await db.sql("select * from public.taps where meet_id = $1", [meet.id]), []);
    // 44 minutes early is inside the window (first routine on an idle mat).
    const soon = await seedMeet(db, [{ team: "a", at: 44 }]);
    assert.equal((await tap(db, user(), soon.id, "a")).ok, true);
  });

  test("not-next: only the next two after the anchor (scratched ones skipped)", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -20 },
      { team: "b", at: -16 },
      { team: "c", at: -12 },
      { team: "d", at: -8 },
      { team: "e", at: -4 },
      { team: "z", at: -4, mat: "2" },
    ]);
    const me = user();
    // No anchor: the first two are tappable.
    assert.equal((await tap(db, me, meet.id, "b")).ok, true);
    assert.deepEqual(await tap(db, me, meet.id, "c"), { ok: false, reason: "not-next", confirmed: false });
    // Anchor a (5 min ago): b and c are next.
    await setStart(db, meet.id, "a", meet.t0 - 5 * MINUTE);
    assert.equal((await tap(db, me, meet.id, "c")).ok, true);
    assert.deepEqual((await tap(db, me, meet.id, "d")).reason, "not-next");
    // Scratch b: c and d are next.
    await db.sql("update public.routines set status = 'scratched' where meet_id = $1 and team_id = 'b'", [meet.id]);
    assert.equal((await tap(db, me, meet.id, "d")).ok, true);
    assert.deepEqual((await tap(db, me, meet.id, "e")).reason, "not-next");
    // Mats are independent.
    assert.equal((await tap(db, me, meet.id, "z")).ok, true);
  });

  test("too-soon: nothing new within 120 s of the anchor's start", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -6 },
      { team: "b", at: -2 },
    ]);
    await setStart(db, meet.id, "a", meet.t0 - 60 * SECOND);
    assert.deepEqual(await tap(db, user(), meet.id, "b"), { ok: false, reason: "too-soon", confirmed: false });
    // A backdated tap is judged at its own (earlier) time.
    await setStart(db, meet.id, "a", meet.t0 - 150 * SECOND);
    assert.deepEqual((await tap(db, user(), meet.id, "b", 60_000)).reason, "too-soon");
    assert.equal((await tap(db, user(), meet.id, "b", 0)).ok, true);
    // The anchor itself still takes taps (more confirmations).
    assert.equal((await tap(db, user(), meet.id, "a", 0)).ok, true);
  });

  test("freeze: late taps are accepted but ignored, then 'already-confirmed'", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -5 },
      { team: "b", at: 30 },
    ]);
    // Two taps 150 s ago confirm a; the freeze (c + 90 s) has passed.
    const t1 = meet.t0 - 151 * SECOND;
    const t2 = meet.t0 - 150 * SECOND;
    await rawTap(db, meet.id, "a", t1);
    await rawTap(db, meet.id, "a", t2);
    await db.sql("select judgey_private.recompute_start($1, 'a')", [meet.id]);
    const confirmed = { started: median2(t1, t2), confirmed: t2, n: 2, source: "crowd" };
    assert.deepEqual(await startRow(db, meet.id, "a"), confirmed);

    // now - c ≈ 150 s: inside c + freeze + maxTapAge, so accepted, but outside the freeze.
    const late = await tap(db, user(), meet.id, "a");
    assert.deepEqual(late, { ok: true, confirmed: true, startedAt: median2(t1, t2) });
    assert.equal((await tapTimes(db, meet.id, "a")).length, 3);
    assert.deepEqual(await startRow(db, meet.id, "a"), confirmed, "late tap does not move the start");

    // Move the whole routine 60 s further into the past: now > c + 210 s.
    await db.sql("update public.taps set at = at - interval '60 seconds' where meet_id = $1", [meet.id]);
    await db.sql("select judgey_private.recompute_start($1, 'a')", [meet.id]);
    const res = await tap(db, user(), meet.id, "a");
    assert.deepEqual(res, {
      ok: false,
      reason: "already-confirmed",
      confirmed: true,
      startedAt: median2(t1, t2) - 60 * SECOND,
    });
  });

  test("a tap inside the freeze joins the median", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -5 }]);
    const t1 = meet.t0 - 40 * SECOND;
    const t2 = meet.t0 - 30 * SECOND;
    await rawTap(db, meet.id, "a", t1);
    await rawTap(db, meet.id, "a", t2);
    const res = await tap(db, user(), meet.id, "a", 0);
    const t3 = (await tapTimes(db, meet.id, "a"))[2];
    assert.deepEqual(res, { ok: true, confirmed: true, startedAt: t2 });
    assert.deepEqual(await startRow(db, meet.id, "a"), { started: t2, confirmed: t2, n: 3, source: "crowd" });
    assert.ok(t3 <= t2 + 90 * SECOND);
  });

  test("lookbehind: swapped teams stay tappable before the anchor", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -16 },
      { team: "b", at: -12 },
      { team: "c", at: -8 },
    ]);
    await setStart(db, meet.id, "a", meet.t0 - 10 * MINUTE);
    // c goes before b: c is the second lookahead candidate and confirms.
    await tap(db, user(), meet.id, "c");
    const c = await tap(db, user(), meet.id, "c");
    assert.equal(c.confirmed, true);
    // b is now before the anchor (skipped) but tappable once the gap has passed.
    assert.deepEqual((await tap(db, user(), meet.id, "b")).reason, "too-soon");
    await setStart(db, meet.id, "c", meet.t0 - 3 * MINUTE);
    await tap(db, user(), meet.id, "b");
    const b = await tap(db, user(), meet.id, "b");
    assert.equal(b.ok, true);
    assert.equal(b.confirmed, true);
  });

  test("lookbehind: the two nearest unconfirmed routines before the anchor", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -24 },
      { team: "b", at: -20 },
      { team: "c", at: -16 },
      { team: "d", at: -12 },
      { team: "e", at: -8 },
    ]);
    await setStart(db, meet.id, "c", meet.t0 - 9 * MINUTE);
    await setStart(db, meet.id, "e", meet.t0 - 5 * MINUTE);
    // Unconfirmed before anchor e, nearest first: d, b (c is confirmed); a is third.
    assert.equal((await tap(db, user(), meet.id, "d")).ok, true);
    assert.equal((await tap(db, user(), meet.id, "b")).ok, true);
    assert.deepEqual((await tap(db, user(), meet.id, "a")).reason, "not-next");
    // A confirmed routine that is not the anchor is not tappable.
    assert.deepEqual((await tap(db, user(), meet.id, "c")).reason, "not-next");
  });

  test("operator starts are final ('already-confirmed'); recompute never overwrites them", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -2 }]);
    await setStart(db, meet.id, "a", meet.t0 - 30 * SECOND, "operator");
    const res = await tap(db, user(), meet.id, "a");
    assert.deepEqual(res, { ok: false, reason: "already-confirmed", confirmed: true, startedAt: meet.t0 - 30 * SECOND });
    await rawTap(db, meet.id, "a", meet.t0 - 5 * SECOND);
    await rawTap(db, meet.id, "a", meet.t0 - 4 * SECOND);
    await db.sql("select judgey_private.recompute_start($1, 'a')", [meet.id]);
    assert.deepEqual(await startRow(db, meet.id, "a"), {
      started: meet.t0 - 30 * SECOND,
      confirmed: null,
      n: 2,
      source: "operator",
    });
  });

  test("meets.min_taps = 3 needs three people", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }], { minTaps: 3 });
    assert.equal((await tap(db, user(), meet.id, "a")).confirmed, false);
    assert.equal((await tap(db, user(), meet.id, "a")).confirmed, false);
    assert.equal((await tap(db, user(), meet.id, "a")).confirmed, true);
    assert.equal((await startRow(db, meet.id, "a")).n, 3);
  });

  test("scratching a confirmed routine hides its start and re-opens the mat", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -10 },
      { team: "b", at: -6 },
      { team: "c", at: -2 },
      { team: "d", at: 2 },
    ]);
    await setStart(db, meet.id, "b", meet.t0 - 5 * MINUTE);
    let snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id });
    assert.deepEqual(snap.starts, [{ teamId: "b", startedAt: meet.t0 - 5 * MINUTE, source: "crowd" }]);
    // Anchor b: a (lookbehind), b (anchor), c and d (lookahead) are tappable.
    assert.equal((await tap(db, user(), meet.id, "d")).ok, true);
    await db.sql("update public.routines set status = 'scratched' where meet_id = $1 and team_id = 'b'", [meet.id]);
    // Without b there is no anchor: only the first two (a, c) are candidates.
    assert.deepEqual((await tap(db, user(), meet.id, "d")).reason, "not-next");
    assert.equal((await tap(db, user(), meet.id, "c")).ok, true);
    snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id });
    assert.deepEqual(snap.starts, []);
    assert.deepEqual((await tap(db, user(), meet.id, "b")).reason, "scratched");
  });

  test("recompute_start boundaries: early cutoff, 120 s cluster, 90 s freeze, median rounding", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: 0 },
      { team: "b", at: 4 },
      { team: "c", at: 8 },
      { team: "d", at: 12 },
      { team: "e", at: 16 },
    ]);
    const s = meet.scheduled;
    const recompute = async (team: string) => {
      await db.sql("select judgey_private.recompute_start($1, $2)", [meet.id, team]);
      return startRow(db, meet.id, team);
    };
    // Exactly 120 s apart confirms; 120.001 s does not.
    await rawTap(db, meet.id, "a", s.a);
    await rawTap(db, meet.id, "a", s.a + 120_000);
    assert.equal((await recompute("a")).started, median2(s.a, s.a + 120_000));
    await rawTap(db, meet.id, "b", s.b);
    await rawTap(db, meet.id, "b", s.b + 120_001);
    assert.equal(await recompute("b"), undefined);
    // Taps exactly 45 min early count; 1 ms earlier they are ignored.
    await rawTap(db, meet.id, "c", s.c - 45 * MINUTE);
    await rawTap(db, meet.id, "c", s.c - 45 * MINUTE + 1);
    assert.equal((await recompute("c")).started, s.c - 45 * MINUTE + 1);
    await rawTap(db, meet.id, "d", s.d - 45 * MINUTE - 1);
    await rawTap(db, meet.id, "d", s.d - 45 * MINUTE);
    assert.equal(await recompute("d"), undefined);
    // Freeze: c + 90 s is counted, c + 90.001 s is not. Even count → floor((a + b + 1) / 2).
    const c = s.e + 10_000;
    await rawTap(db, meet.id, "e", s.e);
    await rawTap(db, meet.id, "e", c);
    await rawTap(db, meet.id, "e", c + 90_000);
    await rawTap(db, meet.id, "e", c + 90_001);
    assert.deepEqual(await recompute("e"), { started: c, confirmed: c, n: 3, source: "crowd" });
    await db.sql("delete from public.taps where meet_id = $1 and team_id = 'e' and at > judgey_private.from_ms($2)", [
      meet.id,
      c + 1,
    ]);
    await rawTap(db, meet.id, "e", s.e + 1);
    // taps: s.e, s.e + 1, c → median of three = s.e + 1
    assert.deepEqual(await recompute("e"), { started: s.e + 1, confirmed: s.e + 1, n: 3, source: "crowd" });
    // Losing a tap un-confirms (the crowd row is deleted).
    await db.sql("delete from public.taps where meet_id = $1 and team_id = 'a'", [meet.id]);
    assert.equal(await recompute("a"), undefined);
  });
});
