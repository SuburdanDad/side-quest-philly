// NULL for every parameter of every RPC: never an exception (other than a
// missing session), always a defined answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, pgCode, seedMeet, setStart, user, type Json } from "./harness.ts";

dbSuite("NULL inputs", (ctx) => {
  test("each parameter null on its own, then all of them", async () => {
    const { db } = ctx;
    const meet = await seedMeet(
      db,
      [
        { team: "a", at: -10 },
        { team: "b", at: -6 },
      ],
      { operatorCode: "null-safe-code" },
    );
    await setStart(db, meet.id, "a", meet.t0 - 3 * MINUTE);
    const fan = user();
    const op = user();
    await db.rpc(fan, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    assert.deepEqual(await db.rpc(op, "claim_operator", { p_meet: meet.id, p_code: "null-safe-code" }), { ok: true });

    type Case = [caller: string, fn: string, args: Record<string, unknown>, check: (r: Json) => void];
    const cases: Case[] = [
      ["anon", "meet_snapshot", { p_meet: null, p_have_version: 0 }, (r) => assert.equal(r, null)],
      ["anon", "meet_snapshot", { p_meet: meet.id, p_have_version: null }, (r) => assert.notEqual(r.schedule, null)],
      [fan, "my_state", { p_meet: null }, (r) => assert.equal(r.fan, null)],
      [fan, "check_in", { p_meet: null, p_home_team_ids: ["a"] }, (r) => assert.deepEqual(r, { ok: false, reason: "unknown-meet" })],
      [fan, "check_in", { p_meet: meet.id, p_home_team_ids: null }, (r) => assert.equal(r.ok, true)],
      [fan, "tap_mat", { p_meet: null, p_team: "b", p_age_ms: 0 }, (r) => assert.equal(r.reason, "unknown-team")],
      [fan, "tap_mat", { p_meet: meet.id, p_team: null, p_age_ms: 0 }, (r) => assert.equal(r.reason, "unknown-team")],
      [fan, "tap_mat", { p_meet: meet.id, p_team: "b", p_age_ms: null }, (r) => assert.equal(r.ok, true)],
      [fan, "cast_ballot", { p_meet: null, p_team: "a", p_stars: 4, p_awards: [] }, (r) => assert.equal(r.reason, "not-checked-in")],
      [fan, "cast_ballot", { p_meet: meet.id, p_team: null, p_stars: 4, p_awards: [] }, (r) => assert.equal(r.reason, "window-closed")],
      [fan, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: null, p_awards: [] }, (r) => assert.equal(r.reason, "invalid")],
      [fan, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 4, p_awards: null }, (r) => assert.equal(r.reason, "invalid")],
      [fan, "touch", { p_meet: null, p_src: "qr" }, () => {}],
      [fan, "touch", { p_meet: meet.id, p_src: null }, () => {}],
      [fan, "claim_operator", { p_meet: null, p_code: "x" }, (r) => assert.equal(r.reason, "unknown-meet")],
      [fan, "claim_operator", { p_meet: meet.id, p_code: null }, (r) => assert.equal(r.reason, "bad-code")],
      [op, "op_set_start", { p_meet: null, p_team: "a", p_started_at_ms: meet.t0 }, (r) => assert.equal(r.reason, "not-operator")],
      [op, "op_set_start", { p_meet: meet.id, p_team: null, p_started_at_ms: meet.t0 }, (r) => assert.equal(r.reason, "unknown-team")],
      [op, "op_set_start", { p_meet: meet.id, p_team: "b", p_started_at_ms: null }, (r) => assert.deepEqual(r, { ok: true })],
      [op, "op_set_status", { p_meet: null, p_team: "a", p_status: "scratched" }, (r) => assert.equal(r.reason, "not-operator")],
      [op, "op_set_status", { p_meet: meet.id, p_team: null, p_status: "scratched" }, (r) => assert.equal(r.reason, "unknown-team")],
      [op, "op_set_status", { p_meet: meet.id, p_team: "a", p_status: null }, (r) => assert.equal(r.reason, "invalid")],
    ];
    for (const [caller, fn, args, check] of cases) {
      const result = await db.rpc(caller, fn, args);
      try {
        check(result);
      } catch (err) {
        throw new Error(`${fn}(${JSON.stringify(args)}) → ${JSON.stringify(result)}: ${(err as Error).message}`);
      }
    }
    // The null src touch still counted the visit (with no src).
    const visits = await db.sql("select src from public.visits where meet_id = $1 and user_id = $2", [meet.id, fan]);
    assert.deepEqual(visits, [{ src: null }]);

    // Every parameter null at once.
    const allNull: Array<[string, string, string[]]> = [
      ["anon", "meet_snapshot", ["p_meet", "p_have_version"]],
      [fan, "my_state", ["p_meet"]],
      [fan, "check_in", ["p_meet", "p_home_team_ids"]],
      [fan, "tap_mat", ["p_meet", "p_team", "p_age_ms"]],
      [fan, "cast_ballot", ["p_meet", "p_team", "p_stars", "p_awards"]],
      [fan, "touch", ["p_meet", "p_src"]],
      [fan, "claim_operator", ["p_meet", "p_code"]],
      [op, "op_set_start", ["p_meet", "p_team", "p_started_at_ms"]],
      [op, "op_set_status", ["p_meet", "p_team", "p_status"]],
    ];
    for (const [caller, fn, params] of allNull) {
      const args = Object.fromEntries(params.map((p) => [p, null]));
      await db.rpc(caller, fn, args); // must not throw
    }
  });

  test("a session without a sub is 'not-authenticated' (28000) everywhere but meet_snapshot", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }]);
    const calls: Array<[string, Record<string, unknown>]> = [
      ["my_state", { p_meet: meet.id }],
      ["check_in", { p_meet: meet.id, p_home_team_ids: [] }],
      ["tap_mat", { p_meet: meet.id, p_team: "a" }],
      ["cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 4 }],
      ["touch", { p_meet: meet.id }],
      ["claim_operator", { p_meet: meet.id, p_code: "x" }],
      ["op_set_start", { p_meet: meet.id, p_team: "a", p_started_at_ms: null }],
      ["op_set_status", { p_meet: meet.id, p_team: "a", p_status: "scheduled" }],
    ];
    for (const [fn, args] of calls) {
      await assert.rejects(db.rpc("no-sub", fn, args), pgCode("28000"), fn);
    }
    assert.equal((await db.rpc("no-sub", "meet_snapshot", { p_meet: meet.id })).meetId, meet.id);
  });
});
