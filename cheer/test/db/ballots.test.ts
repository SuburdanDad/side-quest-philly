// check_in and cast_ballot: every reason code, NULLs, the voting window with
// grace, award normalization, the own-team block over everHomeTeamIds, and
// tallies that always equal the ballots behind them.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dbSuite,
  MINUTE,
  pgCode,
  SECOND,
  seedMeet,
  setStart,
  storedTallies,
  talliesFromBallots,
  user,
  type TestDb,
} from "./harness.ts";

/** A meet whose routines a..e have been on the mat for 2 minutes (voting open). */
async function openMeet(db: TestDb) {
  const meet = await seedMeet(db, [
    { team: "a", at: -30 },
    { team: "b", at: -26 },
    { team: "c", at: -22 },
    { team: "b-10", at: -18 },
    { team: "b-2", at: -14 },
    { team: "x", at: -10, status: "scratched" },
    { team: "later", at: 60 },
  ]);
  for (const team of ["a", "b", "c", "b-10", "b-2", "x"]) await setStart(db, meet.id, team, meet.t0 - 2 * MINUTE);
  return meet;
}

const checkIn = (db: TestDb, me: string, meet: unknown, ids: unknown) =>
  db.rpc(me, "check_in", { p_meet: meet, p_home_team_ids: ids });
const vote = (db: TestDb, me: string, meet: unknown, team: unknown, stars: unknown = 4, awards: unknown = []) =>
  db.rpc(me, "cast_ballot", { p_meet: meet, p_team: team, p_stars: stars, p_awards: awards });

dbSuite("check_in", (ctx) => {
  test("requires a session", async () => {
    const meet = await openMeet(ctx.db);
    await assert.rejects(checkIn(ctx.db, "no-sub", meet.id, []), pgCode("28000"));
  });

  test("dedupes in first-seen order; null and empty mean 'just here to cheer'", async () => {
    const meet = await openMeet(ctx.db);
    const me = user();
    assert.deepEqual(await checkIn(ctx.db, me, meet.id, ["c", "a", "c"]), {
      ok: true,
      fan: { homeTeamIds: ["c", "a"], everHomeTeamIds: ["c", "a"] },
      removedBallotTeamIds: [],
    });
    assert.deepEqual(await checkIn(ctx.db, me, meet.id, null), {
      ok: true,
      fan: { homeTeamIds: [], everHomeTeamIds: ["c", "a"] },
      removedBallotTeamIds: [],
    });
    assert.deepEqual(await checkIn(ctx.db, me, meet.id, ["b", "a"]), {
      ok: true,
      fan: { homeTeamIds: ["b", "a"], everHomeTeamIds: ["c", "a", "b"] },
      removedBallotTeamIds: [],
    });
    const other = user();
    assert.deepEqual((await checkIn(ctx.db, other, meet.id, [])).fan, { homeTeamIds: [], everHomeTeamIds: [] });
    const rows = await ctx.db.sql("select home_team_ids, ever_home_team_ids from public.fans where user_id = $1", [me]);
    assert.deepEqual(rows, [{ home_team_ids: ["b", "a"], ever_home_team_ids: ["c", "a", "b"] }]);
  });

  test("reasons: unknown-meet, too-many, unknown-team (unknown, scratched, null id)", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      ...Array.from({ length: 11 }, (_, i) => ({ team: `t${i}`, at: i })),
      { team: "gone", at: 30, status: "scratched" },
    ]);
    const me = user();
    assert.deepEqual(await checkIn(db, me, "no-such-meet", ["t1"]), { ok: false, reason: "unknown-meet" });
    assert.deepEqual(await checkIn(db, me, null, ["t1"]), { ok: false, reason: "unknown-meet" });
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`);
    assert.deepEqual(await checkIn(db, me, meet.id, eleven), { ok: false, reason: "too-many" });
    // Duplicates count once: ten distinct teams are fine.
    assert.equal((await checkIn(db, me, meet.id, [...eleven.slice(0, 10), "t0", "t1"])).ok, true);
    assert.deepEqual(await checkIn(db, me, meet.id, ["t1", "nope"]), { ok: false, reason: "unknown-team" });
    assert.deepEqual(await checkIn(db, me, meet.id, ["gone"]), { ok: false, reason: "unknown-team" });
    assert.deepEqual(await checkIn(db, me, meet.id, ["t1", null]), { ok: false, reason: "unknown-team" });
    assert.deepEqual(await checkIn(db, user(), meet.id, ["Bad Id!"]), { ok: false, reason: "unknown-team" });
    // Rejections change nothing.
    const fan = await db.sql("select home_team_ids from public.fans where user_id = $1", [me]);
    assert.deepEqual(fan, [{ home_team_ids: eleven.slice(0, 10) }]);
  });
});

dbSuite("cast_ballot", (ctx) => {
  test("requires a session", async () => {
    const meet = await openMeet(ctx.db);
    await assert.rejects(vote(ctx.db, "no-sub", meet.id, "a"), pgCode("28000"));
  });

  test("reasons in order: not-checked-in, own-team, window-closed, already-voted, invalid", async () => {
    const { db } = ctx;
    const meet = await openMeet(db);
    const me = user();
    assert.deepEqual(await vote(db, me, meet.id, "a"), { ok: false, reason: "not-checked-in" });
    assert.deepEqual(await vote(db, me, "no-such-meet", "a"), { ok: false, reason: "not-checked-in" });
    await checkIn(db, me, meet.id, ["b"]);
    // own-team beats invalid stars and an open window
    assert.deepEqual(await vote(db, me, meet.id, "b", 9), { ok: false, reason: "own-team" });
    // window-closed beats invalid: no start yet / unknown team / null team / scratched team
    assert.deepEqual(await vote(db, me, meet.id, "later", 4.5), { ok: false, reason: "window-closed" });
    assert.deepEqual(await vote(db, me, meet.id, "nope"), { ok: false, reason: "window-closed" });
    assert.deepEqual(await vote(db, me, meet.id, null), { ok: false, reason: "window-closed" });
    assert.deepEqual(await vote(db, me, meet.id, "x"), { ok: false, reason: "window-closed" });
    // invalid
    for (const stars of [4.5, 0, 6, -1, null, "NaN", 1e9]) {
      assert.deepEqual(await vote(db, me, meet.id, "a", stars), { ok: false, reason: "invalid" }, `stars ${stars}`);
    }
    for (const awards of [null, ["stunts", null], ["best-hair"], ["STUNTS"]]) {
      assert.deepEqual(await vote(db, me, meet.id, "a", 3, awards), { ok: false, reason: "invalid" }, `awards ${awards}`);
    }
    assert.deepEqual(await ctx.db.sql("select * from public.ballots where user_id = $1", [me]), []);
    // ok, then already-voted (beats invalid)
    assert.deepEqual(await vote(db, me, meet.id, "a", 5.0), { ok: true });
    assert.deepEqual(await vote(db, me, meet.id, "a", 3), { ok: false, reason: "already-voted" });
    assert.deepEqual(await vote(db, me, meet.id, "a", 4.5), { ok: false, reason: "already-voted" });
  });

  test("awards are normalized (distinct, sorted) and counted once", async () => {
    const { db } = ctx;
    const meet = await openMeet(db);
    const me = user();
    await checkIn(db, me, meet.id, []);
    assert.deepEqual(await vote(db, me, meet.id, "a", 4, ["tumbling", "dance", "tumbling", "stunts"]), { ok: true });
    const state = await db.rpc(me, "my_state", { p_meet: meet.id });
    assert.deepEqual(state.ballots, [{ teamId: "a", stars: 4, awards: ["dance", "stunts", "tumbling"] }]);
    // default p_awards
    assert.deepEqual(await db.rpc(me, "cast_ballot", { p_meet: meet.id, p_team: "b", p_stars: 2 }), { ok: true });
    const tallies = await storedTallies(db, meet.id);
    assert.deepEqual(tallies, [
      { team_id: "a", votes: 1, star_sum: 4, stunts: 1, tumbling: 1, spirit: 0, dance: 1 },
      { team_id: "b", votes: 1, star_sum: 2, stunts: 0, tumbling: 0, spirit: 0, dance: 0 },
    ]);
  });

  test("voting window: [start, start + 10 min + 60 s grace]", async () => {
    const { db } = ctx;
    const meet = await openMeet(db);
    const me = user();
    await checkIn(db, me, meet.id, []);
    const now = await db.nowMs();
    // Grace: 10 min 30 s after the start is still accepted.
    await setStart(db, meet.id, "a", now - (10 * MINUTE + 30 * SECOND));
    assert.deepEqual(await vote(db, me, meet.id, "a"), { ok: true });
    // 10 min 90 s after: closed.
    await setStart(db, meet.id, "b", now - (10 * MINUTE + 90 * SECOND));
    assert.deepEqual(await vote(db, me, meet.id, "b"), { ok: false, reason: "window-closed" });
    // Start in the future (a wrong operator time): not open yet.
    await setStart(db, meet.id, "c", now + 2 * MINUTE);
    assert.deepEqual(await vote(db, me, meet.id, "c"), { ok: false, reason: "window-closed" });
    // Operator starts open the window too.
    await setStart(db, meet.id, "c", now - MINUTE, "operator");
    assert.deepEqual(await vote(db, me, meet.id, "c"), { ok: true });
  });

  test("un-follow, vote, re-follow is blocked by everHomeTeamIds", async () => {
    const { db } = ctx;
    const meet = await openMeet(db);
    const me = user();
    await checkIn(db, me, meet.id, ["a"]);
    await checkIn(db, me, meet.id, []); // un-follow
    assert.deepEqual(await vote(db, me, meet.id, "a"), { ok: false, reason: "own-team" });
    const again = await checkIn(db, me, meet.id, ["a"]);
    assert.deepEqual(again.removedBallotTeamIds, []);
    assert.deepEqual(await db.sql("select * from public.ballots where user_id = $1", [me]), []);
  });

  test("following a team you voted for deletes that ballot and un-counts it", async () => {
    const { db } = ctx;
    const meet = await openMeet(db);
    const me = user();
    const others = [user(), user()];
    await checkIn(db, me, meet.id, ["c"]);
    for (const o of others) await checkIn(db, o, meet.id, []);
    await vote(db, me, meet.id, "a", 5, ["stunts"]);
    await vote(db, me, meet.id, "b-2", 3, ["spirit", "dance"]);
    await vote(db, me, meet.id, "b-10", 4);
    for (const o of others) {
      await vote(db, o, meet.id, "b-2", 2, ["dance"]);
      await vote(db, o, meet.id, "a", 4, ["stunts"]);
    }
    const res = await checkIn(db, me, meet.id, ["c", "b-2", "b-10"]);
    assert.deepEqual(res, {
      ok: true,
      fan: { homeTeamIds: ["c", "b-2", "b-10"], everHomeTeamIds: ["c", "b-2", "b-10"] },
      removedBallotTeamIds: ["b-10", "b-2"], // collate "C" order
    });
    const mine = await db.sql("select team_id from public.ballots where meet_id = $1 and user_id = $2", [meet.id, me]);
    assert.deepEqual(mine, [{ team_id: "a" }]);
    assert.deepEqual(await storedTallies(db, meet.id), await talliesFromBallots(db, meet.id));
    assert.deepEqual(await storedTallies(db, meet.id), [
      { team_id: "a", votes: 3, star_sum: 13, stunts: 3, tumbling: 0, spirit: 0, dance: 0 },
      { team_id: "b-2", votes: 2, star_sum: 4, stunts: 0, tumbling: 0, spirit: 0, dance: 2 },
    ]);
    assert.deepEqual(await vote(db, me, meet.id, "b-2"), { ok: false, reason: "own-team" });
    // Re-checking in with the same teams removes nothing more.
    assert.deepEqual((await checkIn(db, me, meet.id, ["b-2"])).removedBallotTeamIds, []);
  });
});
