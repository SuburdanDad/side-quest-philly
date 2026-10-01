// The table contract of docs/backend-spec.md §4: every CHECK, foreign key and
// cascade, `collate "C"` where SQL ordering must equal compareIds(), and the §2
// rule that every stored time is whole milliseconds, after real RPC traffic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, MINUTE, pgCode, seedMeet, user } from "./harness.ts";

const CODE = "schema-test-code";

dbSuite("schema", (ctx) => {
  test("CHECK constraints reject what §4 forbids and accept its edges", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: 0 }]);
    const fails = (sql: string, values: unknown[]) => assert.rejects(db.sql(sql, values), pgCode("23514"), sql);
    const meetSql = `insert into public.meets (id, name, time_zone, starts_at, mats, min_taps)
                     values ($1, 'M', 'America/New_York', now(), '{1}', $2)`;
    for (const id of ["ab", "Has-Upper", "has space", "under_score", "x".repeat(65)]) await fails(meetSql, [id, 2]);
    for (const minTaps of [1, 6]) await fails(meetSql, [db.meetId(), minTaps]);
    for (const [id, minTaps] of [
      ["abc", 2],
      ["x".repeat(64), 5],
    ] as const) {
      await db.sql(meetSql, [id, minTaps]);
    }

    const routineSql = `insert into public.routines (meet_id, team_id, team_name, gym, division, mat, scheduled_at, status)
                        values ($1, $2, 'T', 'G', 'D', '1', now(), $3)`;
    for (const team of ["", "Upper", "a_b", "a.b", "x".repeat(81)])
      await fails(routineSql, [meet.id, team, "scheduled"]);
    await fails(routineSql, [meet.id, "b", "done"]);
    await db.sql(routineSql, [meet.id, "x".repeat(80), "scratched"]);

    // Text columns (review fix): no CR/LF, mat 1-16 chars, team_name 1-80, gym and division at most 80.
    const textSql = `insert into public.routines (meet_id, team_id, team_name, gym, division, mat, scheduled_at)
                     values ($1, $2, $3, $4, $5, $6, now())`;
    const text = (o: { name?: string; gym?: string; division?: string; mat?: string }) => [
      meet.id,
      `txt-${Math.random().toString(36).slice(2, 10)}`,
      o.name ?? "Team",
      o.gym ?? "Gym",
      o.division ?? "Div",
      o.mat ?? "1",
    ];
    for (const bad of ["Mat\n1", "1\r", "", "x".repeat(17)]) await fails(textSql, text({ mat: bad }));
    for (const bad of ["Royals\nSenior", "Royals\r", "", "x".repeat(81)]) await fails(textSql, text({ name: bad }));
    for (const bad of ["Gym\r\nB", "x".repeat(81)]) await fails(textSql, text({ gym: bad }));
    for (const bad of ["Senior\nCoed 5", "x".repeat(81)]) await fails(textSql, text({ division: bad }));
    await db.sql(textSql, text({ mat: "x".repeat(16), name: "x".repeat(80), gym: "x".repeat(80), division: "x".repeat(80) }));
    await db.sql(textSql, text({ gym: "", division: "", name: "Élite\tTab ok" }));
    const unvalidated = await db.sql(
      `select conname from pg_constraint where conrelid = 'public.routines'::regclass and contype = 'c' and not convalidated`,
    );
    assert.deepEqual(unvalidated, [], "the shape constraints are validated on a clean database");
    // An update can't sneak a newline in either.
    await assert.rejects(
      db.sql("update public.routines set division = 'A' || chr(10) || 'B' where meet_id = $1 and team_id = 'a'", [meet.id]),
      pgCode("23514"),
    );

    await fails(
      `insert into public.routine_starts (meet_id, team_id, started_at, source) values ($1, 'a', now(), 'robot')`,
      [meet.id],
    );
    const ballotSql = `insert into public.ballots (meet_id, team_id, user_id, stars, awards, cast_at)
                       values ($1, 'a', $2, $3, $4, now())`;
    for (const stars of [0, 6]) await fails(ballotSql, [meet.id, user(), stars, []]);
    await fails(ballotSql, [meet.id, user(), 3, ["best-hair"]]);
    await fails(ballotSql, [meet.id, user(), 3, ["stunts", null]]);
    await db.sql(ballotSql, [meet.id, user(), 1, ["stunts", "tumbling", "spirit", "dance"]]);
    await db.sql(ballotSql, [meet.id, user(), 5, []]);

    const visitSql = `insert into public.visits (meet_id, user_id, bucket, src) values ($1, $2, now(), $3)`;
    for (const src of ["", "Has-Upper", "qr code", "x".repeat(33)]) await fails(visitSql, [meet.id, user(), src]);
    for (const src of [null, "qr", "x".repeat(32)]) await db.sql(visitSql, [meet.id, user(), src]);

    await fails(`insert into judgey_private.team_tallies (meet_id, team_id, votes) values ($1, 'a', -1)`, [meet.id]);
  });

  test("foreign keys hold, and deleting a meet cascades to every table", async () => {
    const { db } = ctx;
    const meet = await seedMeet(db, [{ team: "a", at: -3 }], { operatorCode: CODE });
    const fk = (sql: string, values: unknown[]) => assert.rejects(db.sql(sql, values), pgCode("23503"), sql);
    await fk("insert into public.taps values ($1, 'nope', $2, now())", [meet.id, user()]);
    await fk(
      "insert into public.ballots (meet_id, team_id, user_id, stars, cast_at) values ($1, 'nope', $2, 3, now())",
      [meet.id, user()],
    );
    await fk(
      "insert into public.routine_starts (meet_id, team_id, started_at, source) values ($1, 'nope', now(), 'crowd')",
      [meet.id],
    );
    await fk("insert into public.fans (meet_id, user_id) values ('no-such-meet', $1)", [user()]);
    await fk("insert into public.visits (meet_id, user_id, bucket) values ('no-such-meet', $1, now())", [user()]);
    await fk("insert into judgey_private.team_tallies (meet_id, team_id) values ($1, 'nope')", [meet.id]);
    await fk("insert into judgey_private.operator_codes values ('no-such-meet', 'x')", []);

    // One row everywhere, written through the RPCs.
    const [a, b, op] = [user(), user(), user()];
    assert.deepEqual(await db.rpc(op, "claim_operator", { p_meet: meet.id, p_code: CODE }), { ok: true });
    await db.rpc(user(), "claim_operator", { p_meet: meet.id, p_code: "wrong-code" });
    for (const [who, age] of [
      [a, 30_000],
      [b, 20_000],
    ] as const) {
      assert.equal((await db.rpc(who, "tap_mat", { p_meet: meet.id, p_team: "a", p_age_ms: age })).ok, true);
    }
    const voter = user();
    await db.rpc(voter, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    assert.deepEqual(await db.rpc(voter, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 4 }), { ok: true });
    await db.rpc(voter, "touch", { p_meet: meet.id, p_src: "qr" });

    const tables = [
      "public.routines",
      "public.routine_starts",
      "public.fans",
      "public.taps",
      "public.ballots",
      "public.visits",
      "judgey_private.team_tallies",
      "judgey_private.operator_codes",
      "judgey_private.meet_operators",
      "judgey_private.operator_attempts",
      "judgey_private.operator_failures",
    ];
    const counts = async (): Promise<Record<string, number>> =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (t) => [
            t,
            (await db.one<{ n: number }>(`select count(*)::int as n from ${t} where meet_id = $1`, [meet.id])).n,
          ]),
        ),
      );
    for (const [table, n] of Object.entries(await counts())) assert.ok(n > 0, `${table} has a row`);
    await db.sql("delete from public.meets where id = $1", [meet.id]);
    for (const [table, n] of Object.entries(await counts())) assert.equal(n, 0, `${table} cascaded`);
  });

  test('every team_id and division column is collate "C" (SQL order = compareIds)', async () => {
    const rows = await ctx.db.sql<{ col: string; collation: string | null }>(
      `select table_schema || '.' || table_name || '.' || column_name as col, collation_name as collation
       from information_schema.columns
       where table_schema in ('public', 'judgey_private') and column_name in ('team_id', 'division')
       order by 1`,
    );
    assert.deepEqual(
      rows.map((r) => r.col),
      [
        "judgey_private.team_tallies.team_id",
        "public.ballots.team_id",
        "public.routine_starts.team_id",
        "public.routines.division",
        "public.routines.team_id",
        "public.taps.team_id",
      ],
    );
    for (const r of rows) assert.equal(r.collation, "C", r.col);
  });

  test("every stored time is whole milliseconds after real RPC traffic (§2)", async () => {
    const { db } = ctx;
    const meet = await seedMeet(
      db,
      [
        { team: "a", at: -6 },
        { team: "b", at: -2 },
      ],
      { operatorCode: CODE },
    );
    const op = user();
    await db.rpc(op, "claim_operator", { p_meet: meet.id, p_code: CODE });
    // Odd ages so a sub-millisecond now() can't hide behind a round number.
    for (const age of [61_237, 60_001])
      await db.rpc(user(), "tap_mat", { p_meet: meet.id, p_team: "a", p_age_ms: age });
    const fans = [user(), user()];
    for (const fan of fans) {
      await db.rpc(fan, "check_in", { p_meet: meet.id, p_home_team_ids: ["b"] });
      await db.rpc(fan, "cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 5, p_awards: ["spirit"] });
      await db.rpc(fan, "touch", { p_meet: meet.id, p_src: "share" });
    }
    await db.rpc(op, "op_set_start", { p_meet: meet.id, p_team: "b", p_started_at_ms: meet.t0 - MINUTE });
    await db.rpc(op, "op_set_status", { p_meet: meet.id, p_team: "b", p_status: "scratched" });

    const columns = await db.sql<{ s: string; t: string; c: string }>(
      `select table_schema as s, table_name as t, column_name as c from information_schema.columns
       where table_schema in ('public', 'judgey_private') and data_type = 'timestamp with time zone'
       order by 1, 2, 3`,
    );
    assert.deepEqual(
      columns.map(({ s, t, c }) => `${s}.${t}.${c}`),
      [
        "public.ballots.cast_at",
        "public.fans.checked_in_at",
        "public.fans.updated_at",
        "public.meets.created_at",
        "public.meets.starts_at",
        "public.routine_starts.confirmed_at",
        "public.routine_starts.started_at",
        "public.routine_starts.updated_at",
        "public.routines.scheduled_at",
        "public.taps.at",
        "public.visits.bucket",
      ],
    );
    for (const { s, t, c } of columns) {
      const { n, bad } = await db.one<{ n: number; bad: number }>(
        `select count(${c})::int as n,
                count(*) filter (where ${c} <> date_trunc('milliseconds', ${c}))::int as bad
         from ${s}.${t} where ${t === "meets" ? "id" : "meet_id"} = $1`,
        [meet.id],
      );
      assert.ok(n > 0, `${s}.${t}.${c} has values to check`);
      assert.equal(bad, 0, `${s}.${t}.${c} keeps sub-millisecond digits`);
    }
  });
});
