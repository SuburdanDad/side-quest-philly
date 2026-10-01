// Exact privileges (§5) for every table and function in public and
// judgey_private, in both modes, plus the behaviour those ACLs promise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dbSuite, pgCode, seedMeet, user } from "./harness.ts";

const ROLES = ["anon", "authenticated"] as const;
const TABLE_PRIVS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

/** table → roles with SELECT (and nothing else). */
const TABLES: Record<string, string[]> = {
  "public.meets": ["anon", "authenticated"],
  "public.routines": ["anon", "authenticated"],
  "public.routine_starts": ["anon", "authenticated"],
  "public.fans": ["authenticated"],
  "public.taps": ["authenticated"],
  "public.ballots": ["authenticated"],
  "public.visits": ["authenticated"],
  "judgey_private.team_tallies": [],
  "judgey_private.operator_codes": [],
  "judgey_private.meet_operators": [],
  "judgey_private.operator_attempts": [],
  "judgey_private.operator_failures": [],
};

/** RPC → roles with EXECUTE, and its volatility. */
const RPCS: Record<string, { roles: string[]; volatility: "s" | "v" }> = {
  "public.meet_snapshot(text, integer)": { roles: ["anon", "authenticated"], volatility: "s" },
  "public.my_state(text)": { roles: ["authenticated"], volatility: "s" },
  "public.check_in(text, text[])": { roles: ["authenticated"], volatility: "v" },
  "public.tap_mat(text, text, integer)": { roles: ["authenticated"], volatility: "v" },
  "public.cast_ballot(text, text, numeric, text[])": { roles: ["authenticated"], volatility: "v" },
  "public.touch(text, text)": { roles: ["authenticated"], volatility: "v" },
  "public.claim_operator(text, text)": { roles: ["authenticated"], volatility: "v" },
  "public.op_set_start(text, text, bigint)": { roles: ["authenticated"], volatility: "v" },
  "public.op_set_status(text, text, text)": { roles: ["authenticated"], volatility: "v" },
};

const POLICIES = [
  "ballots|ballots_own_rows|SELECT|{authenticated}",
  "fans|fans_own_rows|SELECT|{authenticated}",
  "meets|meets_public_read|SELECT|{anon,authenticated}",
  "routine_starts|routine_starts_public_read|SELECT|{anon,authenticated}",
  "routines|routines_public_read|SELECT|{anon,authenticated}",
  "taps|taps_own_rows|SELECT|{authenticated}",
  "visits|visits_own_rows|SELECT|{authenticated}",
];

dbSuite("ACLs", (ctx) => {
  test("exactly the expected tables exist, with no sequences", async () => {
    const rows = await ctx.db.sql<{ name: string }>(
      `select n.nspname || '.' || c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'judgey_private') and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
       order by 1`,
    );
    assert.deepEqual(rows.map((r) => r.name), Object.keys(TABLES).sort());
  });

  test("table privileges are exact for anon and authenticated (TRUNCATE included)", async () => {
    const pg17 = (await ctx.db.one<{ v: number }>("select current_setting('server_version_num')::int as v")).v >= 170000;
    const privs = pg17 ? [...TABLE_PRIVS, "MAINTAIN"] : TABLE_PRIVS;
    for (const [table, readers] of Object.entries(TABLES)) {
      for (const role of ROLES) {
        for (const priv of privs) {
          const { ok } = await ctx.db.one<{ ok: boolean }>("select has_table_privilege($1, $2, $3) as ok", [
            role,
            table,
            priv,
          ]);
          assert.equal(ok, priv === "SELECT" && readers.includes(role), `${role} ${priv} on ${table}`);
        }
        const { cols } = await ctx.db.one<{ cols: boolean }>(
          "select has_any_column_privilege($1, $2, 'INSERT') or has_any_column_privilege($1, $2, 'UPDATE') as cols",
          [role, table],
        );
        assert.equal(cols, false, `${role} column writes on ${table}`);
      }
    }
  });

  test("RLS is on for every public table, with select-only policies", async () => {
    const rls = await ctx.db.sql<{ name: string; on: boolean }>(
      `select n.nspname || '.' || c.relname as name, c.relrowsecurity as on from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    assert.equal(rls.length, 7);
    for (const r of rls) assert.equal(r.on, true, `RLS on ${r.name}`);
    const policies = await ctx.db.sql<{ p: string }>(
      `select tablename || '|' || policyname || '|' || cmd || '|' || roles::text as p
       from pg_policies where schemaname in ('public', 'judgey_private') order by 1`,
    );
    assert.deepEqual(
      policies.map((r) => r.p),
      POLICIES,
    );
  });

  test("public functions are exactly the RPCs, with exact EXECUTE grants", async () => {
    const fns = await ctx.db.sql<{ sig: string; vol: string }>(
      `select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as sig, p.provolatile as vol
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`,
    );
    assert.deepEqual(fns.map((f) => f.sig), Object.keys(RPCS).sort());
    for (const f of fns) {
      assert.equal(f.vol, RPCS[f.sig].volatility, `volatility of ${f.sig}`);
      for (const role of ROLES) {
        const { ok } = await ctx.db.one<{ ok: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') as ok", [
          role,
          f.sig,
        ]);
        assert.equal(ok, RPCS[f.sig].roles.includes(role), `${role} EXECUTE ${f.sig}`);
      }
    }
  });

  test("no judgey_private function is executable by anon, authenticated or PUBLIC", async () => {
    const fns = await ctx.db.sql<{ sig: string }>(
      `select p.oid::regprocedure::text as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'judgey_private'`,
    );
    assert.ok(fns.length >= 10, "helpers exist");
    for (const f of fns) {
      for (const role of ROLES) {
        const { ok } = await ctx.db.one<{ ok: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') as ok", [
          role,
          f.sig,
        ]);
        assert.equal(ok, false, `${role} EXECUTE ${f.sig}`);
      }
    }
    const publicGrants = await ctx.db.sql(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
              aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where n.nspname in ('public', 'judgey_private') and a.grantee = 0`,
    );
    assert.deepEqual(publicGrants, [], "nothing is executable by PUBLIC");
  });

  test("schema usage: public yes, judgey_private no", async () => {
    for (const role of ROLES) {
      const r = await ctx.db.one<{ pub: boolean; priv: boolean }>(
        `select has_schema_privilege($1, 'public', 'USAGE') as pub,
                has_schema_privilege($1, 'judgey_private', 'USAGE') or has_schema_privilege($1, 'judgey_private', 'CREATE') as priv`,
        [role],
      );
      assert.deepEqual(r, { pub: true, priv: false }, role);
    }
  });

  test("every function is security definer with an empty search_path", async () => {
    const fns = await ctx.db.sql<{ sig: string; secdef: boolean; config: string[] | null }>(
      `select p.oid::regprocedure::text as sig, p.prosecdef as secdef, p.proconfig as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'judgey_private')`,
    );
    for (const f of fns) {
      assert.equal(f.secdef, true, `${f.sig} is security definer`);
      assert.deepEqual(f.config, ['search_path=""'], `${f.sig} search_path`);
    }
  });

  test("anon cannot call write RPCs or my_state; nobody can call private helpers", async () => {
    const meet = await seedMeet(ctx.db, [{ team: "a", at: 0 }]);
    const writes: Array<[string, Record<string, unknown>]> = [
      ["my_state", { p_meet: meet.id }],
      ["check_in", { p_meet: meet.id, p_home_team_ids: [] }],
      ["tap_mat", { p_meet: meet.id, p_team: "a", p_age_ms: 0 }],
      ["cast_ballot", { p_meet: meet.id, p_team: "a", p_stars: 5, p_awards: [] }],
      ["touch", { p_meet: meet.id, p_src: "qr" }],
      ["claim_operator", { p_meet: meet.id, p_code: "x" }],
      ["op_set_start", { p_meet: meet.id, p_team: "a", p_started_at_ms: 1 }],
      ["op_set_status", { p_meet: meet.id, p_team: "a", p_status: "scratched" }],
    ];
    for (const [fn, args] of writes) {
      await assert.rejects(ctx.db.rpc("anon", fn, args), pgCode("42501"), `anon ${fn}`);
    }
    // anon can read the snapshot.
    const snap = await ctx.db.rpc("anon", "meet_snapshot", { p_meet: meet.id, p_have_version: 0 });
    assert.equal(snap.meetId, meet.id);

    for (const caller of ["anon", user()]) {
      await assert.rejects(
        ctx.db.as(caller, (c) => c.query("select judgey_private.board($1, 0)", [meet.id])),
        pgCode("42501"),
      );
      await assert.rejects(
        ctx.db.as(caller, (c) => c.query("select judgey_private.purge_meet($1)", [meet.id])),
        pgCode("42501"),
      );
      await assert.rejects(
        ctx.db.as(caller, (c) => c.query("select * from judgey_private.team_tallies")),
        pgCode("42501"),
      );
    }
  });

  test("clients cannot write tables directly (INSERT, UPDATE, DELETE, TRUNCATE)", async () => {
    const meet = await seedMeet(ctx.db, [{ team: "a", at: 0 }]);
    const me = user();
    await ctx.db.rpc(me, "check_in", { p_meet: meet.id, p_home_team_ids: [] });
    const attempts = [
      ["insert into public.fans (meet_id, user_id) values ($1, $2)", [meet.id, me]],
      ["update public.fans set home_team_ids = '{a}' where meet_id = $1", [meet.id]],
      ["delete from public.fans where meet_id = $1", [meet.id]],
      ["insert into public.taps values ($1, 'a', $2, now())", [meet.id, me]],
      ["insert into public.ballots values ($1, 'a', $2, 5, '{}', now())", [meet.id, me]],
      ["update public.routine_starts set started_at = now()", []],
      ["insert into public.meets (id, name, time_zone, starts_at, mats) values ('evil-meet', 'x', 'UTC', now(), '{1}')", []],
      ["update public.routines set status = 'scratched'", []],
      ["delete from public.visits", []],
      ["truncate public.ballots", []],
      ["truncate public.meets cascade", []],
    ] as const;
    for (const caller of ["anon", me]) {
      for (const [sql, values] of attempts) {
        await assert.rejects(
          ctx.db.as(caller, (c) => c.query(sql, [...values])),
          pgCode("42501"),
          `${caller === "anon" ? "anon" : "authenticated"}: ${sql}`,
        );
      }
    }
  });

  test("the mode is real: only legacy hands service_role the default grants", async () => {
    // The migrations only revoke from anon/authenticated, so service_role shows
    // whether Supabase's legacy defaults were in effect when they ran.
    const { ok } = await ctx.db.one<{ ok: boolean }>(
      "select has_table_privilege('service_role', 'public.ballots', 'INSERT') as ok",
    );
    assert.equal(ok, ctx.mode === "legacy");
  });

  test("bootstrap shims: auth.uid() reads request.jwt.claims", async () => {
    const me = user();
    const uid = await ctx.db.as(me, async (c) => (await c.query("select auth.uid() as uid")).rows[0].uid);
    assert.equal(uid, me);
  });
});
