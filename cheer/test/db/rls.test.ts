// Row-level security: each identity sees only its own fans/taps/ballots/visits
// rows; anon sees none of them; the schedule tables are public.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, pgCode, seedMeet, setStart, user } from "./harness.ts";

const OWN_TABLES = ["fans", "taps", "ballots", "visits"];

dbSuite("RLS isolation", (ctx) => {
  test("users see only their own rows; anon sees none; schedule is public", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -10 },
      { team: "b", at: -1 },
    ]);
    await setStart(db, meet.id, "a", meet.t0 - 5 * MINUTE);
    const [alice, bob] = [user(), user()];
    for (const me of [alice, bob]) {
      assert.equal((await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] })).ok, true);
      assert.equal((await db.rpc(me, "tap_mat", { p_meet: meet.id, p_team: "b", p_age_ms: 0 })).ok, true);
      assert.equal((await db.rpc(me, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 5 })).ok, true);
      await db.rpc(me, "touch", { p_meet: meet.id, p_src: "qr" });
    }
    // Sanity: both identities really wrote rows.
    for (const table of OWN_TABLES) {
      const rows = await db.sql(`select user_id from public.${table} where meet_id = $1`, [meet.id]);
      assert.equal(rows.length, 2, table);
    }

    for (const me of [alice, bob]) {
      for (const table of OWN_TABLES) {
        const rows = await db.as(me, async (c) => (await c.query(`select user_id from public.${table}`)).rows);
        assert.deepEqual(
          rows.map((r) => r.user_id),
          [me],
          `${table} as ${me === alice ? "alice" : "bob"}`,
        );
      }
    }

    // A session without a sub matches no rows.
    for (const table of OWN_TABLES) {
      const rows = await db.as("no-sub", async (c) => (await c.query(`select * from public.${table}`)).rows);
      assert.deepEqual(rows, [], `${table} without sub`);
    }

    // anon has no privilege at all on the private-per-user tables.
    for (const table of OWN_TABLES) {
      await assert.rejects(
        db.as("anon", (c) => c.query(`select * from public.${table}`)),
        pgCode("42501"),
        `anon ${table}`,
      );
    }

    // Schedule tables: readable by anon and authenticated.
    for (const caller of ["anon", alice]) {
      const meets = await db.as(caller, async (c) => (await c.query("select id from public.meets where id = $1", [meet.id])).rows);
      assert.equal(meets.length, 1);
      const routines = await db.as(caller, async (c) =>
        (await c.query("select team_id from public.routines where meet_id = $1 order by team_id", [meet.id])).rows,
      );
      assert.deepEqual(routines.map((r) => r.team_id), ["a", "b"]);
      const starts = await db.as(caller, async (c) =>
        (await c.query("select team_id from public.routine_starts where meet_id = $1 order by team_id", [meet.id])).rows,
      );
      assert.deepEqual(starts.map((r) => r.team_id), ["a", "b"]);
    }
  });
});
