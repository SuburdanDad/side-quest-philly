// The operator path (claim_operator, op_set_start, op_set_status) and the
// retention purge.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, pgCode, seedMeet, setStart, storedTallies, user, type TestDb } from "./harness.ts";

const CODE = "glitter-bomb-4417";

const claim = (db: TestDb, me: string, meet: unknown, code: unknown) =>
  db.rpc(me, "claim_operator", { p_meet: meet, p_code: code });

async function operator(db: TestDb, meet: string): Promise<string> {
  const me = user();
  assert.deepEqual(await claim(db, me, meet, CODE), { ok: true });
  return me;
}

dbSuite("operator path", (ctx) => {
  test("all operator RPCs require a session", async () => {
    const meet = await seedMeet(ctx.db, [{ team: "a", at: 0 }], { operatorCode: CODE });
    await assert.rejects(claim(ctx.db, "no-sub", meet.id, CODE), pgCode("28000"));
    await assert.rejects(
      ctx.db.rpc("no-sub", "op_set_start", { p_meet: meet.id, p_team: "a", p_started_at_ms: 1 }),
      pgCode("28000"),
    );
    await assert.rejects(
      ctx.db.rpc("no-sub", "op_set_status", { p_meet: meet.id, p_team: "a", p_status: "scratched" }),
      pgCode("28000"),
    );
  });

  test("claim_operator: unknown-meet, bad-code, 10 failures → locked, success is per meet", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }], { operatorCode: CODE });
    const other = await seedMeet(db, [{ team: "a", at: 0 }], { operatorCode: "another-code" });
    const noCode = await seedMeet(db, [{ team: "a", at: 0 }]);
    const me = user();
    assert.deepEqual(await claim(db, me, "no-such-meet", CODE), { ok: false, reason: "unknown-meet" });
    assert.deepEqual(await claim(db, me, null, CODE), { ok: false, reason: "unknown-meet" });
    assert.deepEqual(await claim(db, me, noCode.id, CODE), { ok: false, reason: "bad-code" });
    assert.deepEqual(await claim(db, me, noCode.id, null), { ok: false, reason: "bad-code" });

    const brute = user();
    for (let i = 0; i < 10; i++) {
      const guess = i === 9 ? null : `guess-${i}`;
      assert.deepEqual(await claim(db, brute, meet.id, guess), { ok: false, reason: "bad-code" }, `attempt ${i + 1}`);
    }
    assert.deepEqual(await claim(db, brute, meet.id, CODE), { ok: false, reason: "locked" });
    assert.equal((await db.rpc(brute, "my_state", { p_meet: meet.id })).isOperator, false);

    const op = user();
    assert.deepEqual(await claim(db, op, meet.id, CODE), { ok: true });
    assert.deepEqual(await claim(db, op, meet.id, CODE), { ok: true }, "idempotent");
    assert.equal((await db.rpc(op, "my_state", { p_meet: meet.id })).isOperator, true);
    assert.equal((await db.rpc(op, "my_state", { p_meet: other.id })).isOperator, false);
    assert.deepEqual(
      await db.rpc(op, "op_set_start", { p_meet: other.id, p_team: "a", p_started_at_ms: meet.t0 }),
      { ok: false, reason: "not-operator" },
    );
    const hash = await db.one("select code_hash from judgey_private.operator_codes where meet_id = $1", [meet.id]);
    assert.notEqual(hash.code_hash, CODE, "only a bcrypt hash is stored");
    assert.match(hash.code_hash, /^\$2a\$/);
  });

  test("op_set_start: not-operator, unknown-team, set overrides the crowd, null clears start and taps", async () => {
    const { db } = ctx;
    const meet = await seedMeet(
      db,
      [
        { team: "a", at: -6 },
        { team: "b", at: -2 },
      ],
      { operatorCode: CODE },
    );
    const fan = user();
    const set = (who: string, team: unknown, at: unknown) =>
      db.rpc(who, "op_set_start", { p_meet: meet.id, p_team: team, p_started_at_ms: at });
    assert.deepEqual(await set(fan, "a", meet.t0), { ok: false, reason: "not-operator" });
    const op = await operator(db, meet.id);
    assert.deepEqual(await set(op, "nope", meet.t0), { ok: false, reason: "unknown-team" });
    assert.deepEqual(await set(op, null, meet.t0), { ok: false, reason: "unknown-team" });

    // The crowd confirms a; the operator corrects it to an exact ms.
    await db.rpc(user(), "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
    await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
    assert.equal((await db.sql("select * from public.routine_starts where meet_id = $1", [meet.id])).length, 1);
    const exact = meet.t0 - 4 * MINUTE + 123;
    assert.deepEqual(await set(op, "a", exact), { ok: true });
    let snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id });
    assert.deepEqual(snap.starts, [{ teamId: "a", startedAt: exact, source: "operator" }]);
    // Crowd taps can no longer move it.
    assert.deepEqual((await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" })).reason, "already-confirmed");

    // A ballot for a, then "Clear": start and taps go, the ballot and tallies stay.
    const voter = user();
    await db.rpc(voter, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    assert.deepEqual(await db.rpc(voter, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 5 }), { ok: true });
    assert.deepEqual(await set(op, "a", null), { ok: true });
    snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id });
    assert.deepEqual(snap.starts, []);
    assert.deepEqual(await db.sql("select * from public.taps where meet_id = $1 and team_id = 'a'", [meet.id]), []);
    assert.equal((await db.sql("select * from public.ballots where meet_id = $1", [meet.id])).length, 1);
    assert.deepEqual(await storedTallies(db, meet.id), [
      { team_id: "a", votes: 1, star_sum: 5, stunts: 0, tumbling: 0, spirit: 0, dance: 0 },
    ]);
    // The crowd can re-confirm cleanly.
    await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
    const again = await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" });
    assert.equal(again.confirmed, true);
    // Clearing a routine that has no start is fine.
    assert.deepEqual(await set(op, "b", null), { ok: true });
  });

  test("op_set_status: not-operator, invalid, unknown-team; changes bump schedule_version", async () => {
    const { db } = ctx;
    const meet = await seedMeet(
      db,
      [
        { team: "a", at: 0 },
        { team: "b", at: 4 },
      ],
      { operatorCode: CODE },
    );
    const status = (who: string, team: unknown, s: unknown) =>
      db.rpc(who, "op_set_status", { p_meet: meet.id, p_team: team, p_status: s });
    const version = async () =>
      (await db.one("select schedule_version as v from public.meets where id = $1", [meet.id])).v;
    assert.deepEqual(await status(user(), "a", "scratched"), { ok: false, reason: "not-operator" });
    const op = await operator(db, meet.id);
    assert.deepEqual(await status(op, "a", "gone"), { ok: false, reason: "invalid" });
    assert.deepEqual(await status(op, "a", null), { ok: false, reason: "invalid" });
    assert.deepEqual(await status(op, "nope", "scratched"), { ok: false, reason: "unknown-team" });
    assert.equal(await version(), 1);

    assert.deepEqual(await status(op, "a", "scratched"), { ok: true });
    assert.equal(await version(), 2);
    const snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id, p_have_version: 1 });
    assert.equal(snap.scheduleVersion, 2);
    assert.equal(snap.schedule.routines.find((r: { teamId: string }) => r.teamId === "a").status, "scratched");
    assert.deepEqual((await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a" })).reason, "scratched");
    assert.deepEqual(await db.rpc(user(), "check_in", { p_meet: meet.id, p_home_team_ids: ["a"] }), {
      ok: false,
      reason: "unknown-team",
    });

    assert.deepEqual(await status(op, "a", "scratched"), { ok: true });
    assert.equal(await version(), 2, "no change, no bump");
    assert.deepEqual(await status(op, "a", "scheduled"), { ok: true });
    assert.equal(await version(), 3);
  });
});

dbSuite("retention", (ctx) => {
  test("purge_meet deletes identity-linked rows and keeps the aggregates", async () => {
    const { db } = ctx;
    const meet = await seedMeet(
      db,
      [
        { team: "a", at: -10 },
        { team: "b", at: -1 },
      ],
      { operatorCode: CODE },
    );
    const keep = await seedMeet(db, [{ team: "a", at: -10 }]);
    await setStart(db, meet.id, "a", meet.t0 - 5 * MINUTE);
    await setStart(db, keep.id, "a", keep.t0 - 5 * MINUTE);
    for (const m of [meet.id, keep.id]) {
      const me = user();
      await db.rpc(me, "check_in", { p_meet: m, p_home_team_ids: [] });
      await db.rpc(me, "cast_ballot", { p_meet: m, p_team: "a", p_stars: 4 });
      await db.rpc(me, "touch", { p_meet: m });
    }
    await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "b" });
    await operator(db, meet.id);
    const purged = await db.one("select judgey_private.purge_meet($1) as r", [meet.id]);
    assert.deepEqual(purged.r, { fans: 1, taps: 1, ballots: 1, visits: 1 });
    for (const table of ["public.fans", "public.taps", "public.ballots", "public.visits", "judgey_private.meet_operators", "judgey_private.operator_attempts", "judgey_private.operator_codes"]) {
      assert.deepEqual(await db.sql(`select * from ${table} where meet_id = $1`, [meet.id]), [], table);
    }
    assert.equal((await db.sql("select * from public.routines where meet_id = $1", [meet.id])).length, 2);
    assert.equal((await db.sql("select * from public.routine_starts where meet_id = $1", [meet.id])).length, 1);
    assert.deepEqual(await storedTallies(db, meet.id), [
      { team_id: "a", votes: 1, star_sum: 4, stunts: 0, tumbling: 0, spirit: 0, dance: 0 },
    ]);
    // Other meets are untouched.
    assert.equal((await db.sql("select * from public.ballots where meet_id = $1", [keep.id])).length, 1);
    assert.equal((await db.sql("select * from public.fans where meet_id = $1", [keep.id])).length, 1);
  });
});
