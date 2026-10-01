// meet_snapshot (schedule versions, effective starts, the public board with
// its half rule, integer ordering, tenths and division reveal), my_state with
// recaps, and touch buckets.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, seedMeet, setStart, setTally, user, type TestDb } from "./harness.ts";

const snapshot = (db: TestDb, meet: unknown, have: unknown = 0) =>
  db.rpc("anon", "meet_snapshot", { p_meet: meet, p_have_version: have });

const NO_AWARDS = { stunts: null, tumbling: null, spirit: null, dance: null };

dbSuite("meet_snapshot", (ctx) => {
  test("unknown or null meet → null", async () => {
    assert.equal(await snapshot(ctx.db, "no-such-meet"), null);
    assert.equal(await snapshot(ctx.db, null, null), null);
  });

  test("schedule is included only when the caller's version differs", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "b", at: 4, mat: "2", division: "Youth 2" },
      { team: "a", at: 0, mat: "1", division: "Youth 2" },
      { team: "s", at: 8, mat: "1", division: "Junior 3", status: "scratched" },
    ]);
    const full = await snapshot(db, meet.id, 0);
    assert.equal(typeof full.serverNow, "number");
    assert.ok(Math.abs(full.serverNow - (await db.nowMs())) < 5000);
    assert.equal(full.meetId, meet.id);
    assert.equal(full.scheduleVersion, 1);
    assert.deepEqual(full.schedule, {
      meet: {
        id: meet.id,
        name: "Test Meet",
        venue: "",
        city: "",
        timeZone: "America/New_York",
        startsAt: meet.t0,
        mats: ["2", "1"], // the meet's own order
        minTaps: 2,
      },
      routines: [
        { teamId: "a", teamName: "A", gym: "Test Gym", division: "Youth 2", mat: "1", scheduledAt: meet.scheduled.a, status: "scheduled" },
        { teamId: "b", teamName: "B", gym: "Test Gym", division: "Youth 2", mat: "2", scheduledAt: meet.scheduled.b, status: "scheduled" },
        { teamId: "s", teamName: "S", gym: "Test Gym", division: "Junior 3", mat: "1", scheduledAt: meet.scheduled.s, status: "scratched" },
      ],
    });
    assert.deepEqual(full.starts, []);
    assert.deepEqual(full.board, {
      top: [],
      awards: NO_AWARDS,
      revealedDivisions: ["Junior 3"], // only a scratched routine: nothing to wait for
      pendingDivisions: ["Youth 2"],
    });
    assert.equal((await snapshot(db, meet.id, 1)).schedule, null);
    assert.notEqual((await snapshot(db, meet.id, null)).schedule, null, "null version → 0");
    assert.notEqual((await snapshot(db, meet.id, 7)).schedule, null);
    await db.sql("update public.meets set schedule_version = 2 where id = $1", [meet.id]);
    const bumped = await snapshot(db, meet.id, 1);
    assert.equal(bumped.scheduleVersion, 2);
    assert.notEqual(bumped.schedule, null);
  });

  test("starts: crowd and operator, scratched routines left out", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "a", at: -20 },
      { team: "b", at: -16 },
      { team: "c", at: -12, status: "scratched" },
    ]);
    await setStart(db, meet.id, "b", meet.t0 - 9 * MINUTE, "operator");
    await setStart(db, meet.id, "a", meet.t0 - 15 * MINUTE);
    await setStart(db, meet.id, "c", meet.t0 - 5 * MINUTE);
    assert.deepEqual((await snapshot(db, meet.id)).starts, [
      { teamId: "a", startedAt: meet.t0 - 15 * MINUTE, source: "crowd" },
      { teamId: "b", startedAt: meet.t0 - 9 * MINUTE, source: "operator" },
    ]);
  });

  test("board: half rule, topN, minVotes, integer order, half-up tenths, C-order ties", async () => {
    const { db } = ctx;
    const teams = ["a-b", "ab", "c", "d", "e", "f", "g", "h", "i", "j", "k", "few"];
    const meet = await seedMeet(
      db,
      teams.map((team, i) => ({ team, at: -60 + i * 2, division: "Open" })),
    );
    for (const team of teams) await setStart(db, meet.id, team, meet.t0 - 30 * MINUTE);
    // 80/20 = 4.0 for both a-b and ab (votes tie → id "a-b" < "ab" in C order), and
    // c: 160/40 = 4.0 with more votes → first. d: 75/20 = 3.75 → 3.8 (half-up).
    await setTally(db, meet.id, "c", { votes: 30, starSum: 125 });
    await setTally(db, meet.id, "ab", { votes: 10, starSum: 45 });
    await setTally(db, meet.id, "a-b", { votes: 10, starSum: 45 });
    await setTally(db, meet.id, "d", { votes: 10, starSum: 40 });
    await setTally(db, meet.id, "e", { votes: 7, starSum: 30 }); // 65/17 = 3.82 → 3.8
    await setTally(db, meet.id, "few", { votes: 4, starSum: 20 }); // below minVotes
    let board = (await snapshot(db, meet.id)).board;
    // 5 qualifying → floor(5 / 2) = 2 shown
    assert.deepEqual(board.top, [
      { teamId: "c", votes: 30, rating: 4 },
      { teamId: "a-b", votes: 10, rating: 4 },
    ]);
    assert.deepEqual(board.revealedDivisions, ["Open"]);
    assert.deepEqual(board.pendingDivisions, []);

    await setTally(db, meet.id, "f", { votes: 5, starSum: 5 });
    board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(
      board.top.map((e: { teamId: string }) => e.teamId),
      ["c", "a-b", "ab"],
      "6 qualifying → 3",
    );
    for (const team of ["g", "h", "i", "j", "k"]) await setTally(db, meet.id, team, { votes: 5, starSum: 6 });
    board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(board.top, [
      { teamId: "c", votes: 30, rating: 4 },
      { teamId: "a-b", votes: 10, rating: 4 },
      { teamId: "ab", votes: 10, rating: 4 },
      { teamId: "e", votes: 7, rating: 3.8 },
      { teamId: "d", votes: 10, rating: 3.8 },
    ]);
  });

  test("awards: share of voters (cross-multiplied), then votes, then id; qualifying teams only", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      { team: "x", at: -40, division: "Open" },
      { team: "y", at: -36, division: "Open" },
      { team: "z", at: -32, division: "Open" },
      { team: "tiny", at: -28, division: "Open" },
      { team: "late", at: -1, mat: "2", division: "Later" },
    ]);
    for (const team of ["x", "y", "z", "tiny"]) await setStart(db, meet.id, team, meet.t0 - 25 * MINUTE);
    await setStart(db, meet.id, "late", meet.t0 - MINUTE);
    await setTally(db, meet.id, "x", { votes: 10, starSum: 40, stunts: 5, tumbling: 3, spirit: 1 });
    await setTally(db, meet.id, "y", { votes: 20, starSum: 80, stunts: 10, tumbling: 7 });
    await setTally(db, meet.id, "z", { votes: 6, starSum: 24, spirit: 1, tumbling: 1 });
    await setTally(db, meet.id, "tiny", { votes: 4, starSum: 20, dance: 4, spirit: 4 }); // not qualifying
    await setTally(db, meet.id, "late", { votes: 50, starSum: 250, dance: 50 }); // pending division
    const board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(board.awards, {
      stunts: "y", // 5/10 = 10/20 → more votes
      tumbling: "y", // 7/20 = .35 > 3/10
      spirit: "z", // 1/6 > 1/10
      dance: null,
    });
    assert.deepEqual(board.pendingDivisions, ["Later"]);
    assert.ok(!board.top.some((e: { teamId: string }) => e.teamId === "late"));
  });

  test("division reveal: closed, skipped-then-passed, fallback, pending; C order", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [
      // mat 1: "Youth 2" all closed
      { team: "y1", at: -60, division: "Youth 2" },
      { team: "y2", at: -56, division: "Youth 2" },
      // mat 2: s1 never tapped but s2 after it is closed → "junior 3" revealed
      { team: "s1", at: -60, mat: "2", division: "junior 3" },
      { team: "s2", at: -56, mat: "2", division: "junior 3" },
      // mat 3: k1 skipped, but the later confirmed k2 is still open → pending
      { team: "k1", at: -30, mat: "3", division: "Mid" },
      { team: "k2", at: -26, mat: "3", division: "Mid" },
      // mat 4: nobody tapped anything, last routine 91 min ago → fallback
      { team: "f1", at: -95, mat: "4", division: "Fallback" },
      { team: "f2", at: -91, mat: "4", division: "Fallback" },
      // mat 5: an untapped routine 89 min ago → still pending
      { team: "g1", at: -89, mat: "5", division: "Grace" },
    ]);
    await setStart(db, meet.id, "y1", meet.t0 - 30 * MINUTE);
    await setStart(db, meet.id, "y2", meet.t0 - 20 * MINUTE);
    await setStart(db, meet.id, "s2", meet.t0 - 12 * MINUTE);
    await setStart(db, meet.id, "k2", meet.t0 - 5 * MINUTE);
    let board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(board.revealedDivisions, ["Fallback", "Youth 2", "junior 3"]);
    assert.deepEqual(board.pendingDivisions, ["Grace", "Mid"]);
    // Close k2 (11 min 1 s ago is past window + grace).
    await setStart(db, meet.id, "k2", meet.t0 - (11 * MINUTE + 1000));
    board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(board.revealedDivisions, ["Fallback", "Mid", "Youth 2", "junior 3"]);
    // A start in the future is not closed: y2 holds "Youth 2" back again.
    await setStart(db, meet.id, "y2", (await db.nowMs()) + MINUTE);
    board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(board.pendingDivisions, ["Grace", "Youth 2"]);
  });

  test("the hot path never touches ballots or taps", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -30 }]);
    await setStart(db, meet.id, "a", meet.t0 - 20 * MINUTE);
    await setTally(db, meet.id, "a", { votes: 5, starSum: 20 });
    const locker = await db.connect();
    try {
      await locker.query("begin");
      await locker.query("lock table public.ballots, public.taps, public.fans in access exclusive mode");
      const snap = await db.as("anon", async (c) => {
        await c.query("set local lock_timeout = '1s'");
        return (await c.query("select public.meet_snapshot($1, 0) as s", [meet.id])).rows[0].s;
      });
      assert.equal(snap.meetId, meet.id);
    } finally {
      await locker.query("rollback");
      locker.release();
    }
  });
});

dbSuite("my_state and recaps", (ctx) => {
  test("shape before and after check-in; unknown meet", async () => {
    const { db } = ctx;
    const me = user();
    const unknown = await db.rpc(me, "my_state", { p_meet: "no-such-meet" });
    assert.equal(typeof unknown.serverNow, "number");
    assert.deepEqual({ ...unknown, serverNow: 0 }, {
      serverNow: 0,
      fan: null,
      tappedTeamIds: [],
      ballots: [],
      recaps: [],
      isOperator: false,
    });
    const nullMeet = await db.rpc(me, "my_state", { p_meet: null });
    assert.equal(nullMeet.fan, null);

    const meet = await seedMeet(db, [
      { team: "a", at: -10 },
      { team: "b", at: -1 },
    ]);
    await setStart(db, meet.id, "a", meet.t0 - 5 * MINUTE);
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: ["a"] });
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    await db.rpc(me, "tap_mat", { p_meet: meet.id, p_team: "b" });
    const state = await db.rpc(me, "my_state", { p_meet: meet.id });
    assert.deepEqual(
      { ...state, serverNow: 0 },
      {
        serverNow: 0,
        fan: { homeTeamIds: [], everHomeTeamIds: ["a"] },
        tappedTeamIds: ["b"],
        ballots: [],
        recaps: [],
        isOperator: false,
      },
    );
  });

  test("recaps: closed home teams only, small counts hidden, non-zero awards, board rank", async () => {
    const { db } = ctx;
    const ids = ["r1", "r2", "r3", "r4", "r5", "r6"];
    const meet = await seedMeet(db, [
      ...ids.map((team, i) => ({ team, at: -60 + i * 4, division: "Open" })),
      { team: "open", at: -2, mat: "2", division: "Other" },
      { team: "none", at: -50, mat: "3", division: "Other" },
    ]);
    for (const team of ids) await setStart(db, meet.id, team, meet.t0 - 30 * MINUTE);
    await setStart(db, meet.id, "open", meet.t0 - MINUTE);
    await setStart(db, meet.id, "none", meet.t0 - 40 * MINUTE);
    await setTally(db, meet.id, "r1", { votes: 12, starSum: 60, stunts: 3, dance: 1 }); // rank 1
    await setTally(db, meet.id, "r2", { votes: 9, starSum: 36, spirit: 2 }); // votes hidden
    await setTally(db, meet.id, "r3", { votes: 10, starSum: 30 });
    await setTally(db, meet.id, "r4", { votes: 10, starSum: 30 });
    await setTally(db, meet.id, "r5", { votes: 5, starSum: 15 });
    await setTally(db, meet.id, "open", { votes: 30, starSum: 150 });
    const me = user();
    await db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: ["open", "r2", "none", "r1", "r3"] });
    const state = await db.rpc(me, "my_state", { p_meet: meet.id });
    const board = (await snapshot(db, meet.id)).board;
    assert.deepEqual(
      board.top.map((e: { teamId: string }) => e.teamId),
      ["r1", "r2"],
    );
    assert.deepEqual(state.recaps, [
      { teamId: "r2", votes: null, awards: { spirit: 2 }, rank: 2 },
      { teamId: "none", votes: null, awards: {}, rank: null },
      { teamId: "r1", votes: 12, awards: { stunts: 3, dance: 1 }, rank: 1 },
      { teamId: "r3", votes: 10, awards: {}, rank: null },
    ]);
  });
});

dbSuite("touch", (ctx) => {
  test("one row per 15-minute bucket; first valid src wins; unknown meet is a no-op", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }]);
    const [me, other, third] = [user(), user(), user()];
    await db.rpc(me, "touch", { p_meet: meet.id, p_src: "share" });
    await db.rpc(me, "touch", { p_meet: meet.id, p_src: "qr" });
    await db.rpc(other, "touch", { p_meet: meet.id, p_src: "Bad Src!" });
    await db.rpc(third, "touch", { p_meet: meet.id });
    await db.rpc(me, "touch", { p_meet: "no-such-meet", p_src: "qr" });
    await db.rpc(me, "touch", { p_meet: null, p_src: null });
    const rows = await db.sql<{ user_id: string; src: string | null; aligned: boolean }>(
      `select user_id, src,
              bucket = date_bin('15 minutes', bucket, timestamptz '2000-01-01 00:00:00+00')
              and bucket <= now() and bucket > now() - interval '30 minutes' as aligned
       from public.visits where meet_id = $1`,
      [meet.id],
    );
    const byUser = new Map(rows.map((r) => [r.user_id, r]));
    assert.equal(rows.length, 3);
    assert.deepEqual(byUser.get(me), { user_id: me, src: "share", aligned: true });
    assert.equal(byUser.get(other)!.src, null);
    assert.equal(byUser.get(third)!.src, null);
    assert.equal((await db.sql("select * from public.visits where meet_id <> $1", [meet.id])).length, 0);
  });
});
