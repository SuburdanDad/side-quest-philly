// DB test harness. Every suite gets its own throwaway database per mode:
//   fresh:  no default privileges for anon/authenticated
//   legacy: Supabase's legacy default grants (all on tables/sequences/functions)
// Each database loads supabase/tests/bootstrap.sql (twice, since it must be
// idempotent), then every migration in name order, and is dropped afterwards.
// Callers are simulated the way PostgREST does it: a transaction with
// `set local role` and request.jwt.claims, then `select public.fn(p_x => …)`.
// Without JUDGEY_TEST_DATABASE_URL every suite is skipped with a message.

import { after, before, describe } from "node:test";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

pg.types.setTypeParser(20, (v: string) => Number(v)); // int8 → number (epoch ms fit easily)

export const DB_URL = process.env.JUDGEY_TEST_DATABASE_URL;
export const MODES = ["fresh", "legacy"] as const;
export type Mode = (typeof MODES)[number];

const SUPABASE = new URL("../../supabase/", import.meta.url);
const LEGACY_DEFAULTS = `
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export const MINUTE = 60_000;
export const SECOND = 1_000;

/** A parsed JSON RPC result. Tests poke at its fields, so it stays loosely typed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

/** Who is calling: a signed-in user id, 'anon', or a session without a sub. */
export type Caller = string | "anon" | "no-sub";

export function migrationFiles(): string[] {
  const dir = new URL("migrations/", SUPABASE);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(new URL(f, dir), "utf8"));
}

function claimsFor(caller: Caller): { role: string; claims: string } {
  if (caller === "anon") return { role: "anon", claims: JSON.stringify({ role: "anon", is_anonymous: false }) };
  if (caller === "no-sub") return { role: "authenticated", claims: JSON.stringify({ role: "authenticated" }) };
  return {
    role: "authenticated",
    claims: JSON.stringify({ sub: caller, role: "authenticated", is_anonymous: true }),
  };
}

/** `select public.fn(p_a => $1, …)` exactly as PostgREST builds it. */
function rpcSql(fn: string, args: Record<string, unknown>): { text: string; values: unknown[] } {
  const names = Object.keys(args);
  const list = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
  return { text: `select public.${fn}(${list}) as result`, values: names.map((n) => args[n]) };
}

export class TestDb {
  readonly pool: pg.Pool;
  readonly name: string;
  readonly mode: Mode;
  readonly url: string;
  private seq = 0;

  constructor(name: string, url: string, mode: Mode) {
    this.name = name;
    this.url = url;
    this.mode = mode;
    this.pool = new pg.Pool({ connectionString: url, max: 6 });
  }

  /** Superuser query. */
  async sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(text, values)).rows;
  }

  async one<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T> {
    const rows = await this.sql<T>(text, values);
    if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}: ${text}`);
    return rows[0];
  }

  /** Database clock in epoch ms (what now() says right now). */
  async nowMs(): Promise<number> {
    return (await this.one<{ ms: number }>("select judgey_private.ms(date_trunc('milliseconds', clock_timestamp())) as ms")).ms;
  }

  /** A fresh dedicated connection (close it with release()). */
  async connect(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  /** Run fn inside one PostgREST-style transaction as `caller`; commits unless fn throws. */
  async as<T>(caller: Caller, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await begin(client, caller);
      const out = await fn(client);
      await client.query("commit");
      return out;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** One RPC in its own transaction; resolves to the function's (parsed JSON) result. */
  async rpc<T = Json>(caller: Caller, fn: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.as(caller, (client) => callRpc<T>(client, fn, args));
  }

  /** Like rpc(), plus that transaction's now() in epoch ms: the instant the RPC judged against. */
  async rpcAt<T = Json>(
    caller: Caller,
    fn: string,
    args: Record<string, unknown> = {},
  ): Promise<{ result: T; now: number }> {
    return this.as(caller, async (client) => {
      const { text, values } = rpcSql(fn, args);
      const now = "(extract(epoch from date_trunc('milliseconds', now())) * 1000)::bigint as now";
      const row = (await client.query(`${text}, ${now}`, values)).rows[0];
      return { result: row.result as T, now: row.now as number };
    });
  }

  /** A unique, valid meet id for this database. */
  meetId(prefix = "meet"): string {
    return `${prefix}-${++this.seq}-${randomUUID().slice(0, 6)}`;
  }

  async drop(): Promise<void> {
    await this.pool.end();
    const admin = new pg.Client({ connectionString: DB_URL });
    await admin.connect();
    try {
      await admin.query(`drop database if exists ${this.name} with (force)`);
    } finally {
      await admin.end();
    }
  }
}

/** Open a PostgREST-style transaction on an existing connection. */
export async function begin(client: pg.ClientBase, caller: Caller): Promise<void> {
  const { role, claims } = claimsFor(caller);
  await client.query("begin");
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
}

export async function callRpc<T = Json>(
  client: pg.ClientBase,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { text, values } = rpcSql(fn, args);
  return (await client.query(text, values)).rows[0].result as T;
}

export async function createTestDb(mode: Mode): Promise<TestDb> {
  if (!DB_URL) throw new Error("JUDGEY_TEST_DATABASE_URL is not set");
  const name = `judgey_t_${mode}_${process.pid}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const admin = new pg.Client({ connectionString: DB_URL });
  await admin.connect();
  try {
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(DB_URL);
  url.pathname = `/${name}`;
  const db = new TestDb(name, url.toString(), mode);
  try {
    const bootstrap = readFileSync(new URL("tests/bootstrap.sql", SUPABASE), "utf8");
    await db.pool.query(bootstrap);
    await db.pool.query(bootstrap);
    if (mode === "legacy") await db.pool.query(LEGACY_DEFAULTS);
    // A multi-statement simple query runs as one transaction, like `psql -1 -f`.
    for (const migration of migrationFiles()) await db.pool.query(migration);
  } catch (err) {
    await db.drop().catch(() => {});
    throw err;
  }
  return db;
}

export interface Ctx {
  db: TestDb;
  mode: Mode;
}

/** Declare a suite that runs once per mode against its own throwaway database. */
export function dbSuite(name: string, body: (ctx: Ctx) => void): void {
  if (!DB_URL) {
    describe(name, { skip: "JUDGEY_TEST_DATABASE_URL is not set; skipping DB tests" }, () => {});
    return;
  }
  for (const mode of MODES) {
    describe(`${name} [${mode}]`, () => {
      const ctx = { mode } as Ctx;
      before(async () => {
        ctx.db = await createTestDb(mode);
      });
      after(async () => {
        await ctx.db?.drop();
      });
      body(ctx);
    });
  }
}

export const user = (): string => randomUUID();

// ---------------------------------------------------------------------------
// Fixtures (inserted as the superuser, the way the import script would)

export interface RoutineSpec {
  team: string;
  /** Minutes from "now" (the database clock when seeding). */
  at: number;
  mat?: string;
  division?: string;
  status?: "scheduled" | "scratched";
}

export interface SeededMeet {
  id: string;
  /** Database clock when seeded; every RoutineSpec.at is relative to it. */
  t0: number;
  scheduled: Record<string, number>;
}

export async function seedMeet(
  db: TestDb,
  routines: RoutineSpec[],
  { minTaps = 2, operatorCode }: { minTaps?: number; operatorCode?: string } = {},
): Promise<SeededMeet> {
  const id = db.meetId();
  const t0 = await db.nowMs();
  const mats = [...new Set(routines.map((r) => r.mat ?? "1"))];
  await db.sql(
    `insert into public.meets (id, name, time_zone, starts_at, mats, min_taps)
     values ($1, 'Test Meet', 'America/New_York', judgey_private.from_ms($2), $3, $4)`,
    [id, t0, mats, minTaps],
  );
  const scheduled: Record<string, number> = {};
  for (const r of routines) {
    const at = t0 + Math.round(r.at * MINUTE);
    scheduled[r.team] = at;
    await db.sql(
      `insert into public.routines (meet_id, team_id, team_name, gym, division, mat, scheduled_at, status)
       values ($1, $2, $3, 'Test Gym', $4, $5, judgey_private.from_ms($6), $7)`,
      [id, r.team, r.team.toUpperCase(), r.division ?? "Div", r.mat ?? "1", at, r.status ?? "scheduled"],
    );
  }
  if (operatorCode !== undefined) {
    await db.sql(
      `insert into judgey_private.operator_codes (meet_id, code_hash)
       values ($1, extensions.crypt($2, extensions.gen_salt('bf')))`,
      [id, operatorCode],
    );
  }
  return { id, t0, scheduled };
}

/** Place a start directly (as the superuser) to put "now" where a test needs it. */
export async function setStart(
  db: TestDb,
  meet: string,
  team: string,
  startedAt: number,
  source: "crowd" | "operator" = "crowd",
  confirmedAt: number | null = source === "crowd" ? startedAt : null,
): Promise<void> {
  await db.sql(
    `insert into public.routine_starts (meet_id, team_id, started_at, source, confirmed_at, confirmations)
     values ($1, $2, judgey_private.from_ms($3), $4, judgey_private.from_ms($5), 2)
     on conflict (meet_id, team_id) do update
       set started_at = excluded.started_at, source = excluded.source, confirmed_at = excluded.confirmed_at`,
    [meet, team, startedAt, source, confirmedAt],
  );
}

/** Set a team's tallies directly (as the superuser). */
export async function setTally(
  db: TestDb,
  meet: string,
  team: string,
  t: { votes: number; starSum: number; stunts?: number; tumbling?: number; spirit?: number; dance?: number },
): Promise<void> {
  await db.sql(
    `insert into judgey_private.team_tallies (meet_id, team_id, votes, star_sum, stunts, tumbling, spirit, dance)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (meet_id, team_id) do update
       set votes = excluded.votes, star_sum = excluded.star_sum, stunts = excluded.stunts,
           tumbling = excluded.tumbling, spirit = excluded.spirit, dance = excluded.dance`,
    [meet, team, t.votes, t.starSum, t.stunts ?? 0, t.tumbling ?? 0, t.spirit ?? 0, t.dance ?? 0],
  );
}

/** Tallies recomputed from the ballots table, for invariant checks. */
export async function talliesFromBallots(db: TestDb, meet: string) {
  return db.sql(
    `select team_id, count(*)::int as votes, sum(stars)::int as star_sum,
            count(*) filter (where 'stunts' = any (awards))::int as stunts,
            count(*) filter (where 'tumbling' = any (awards))::int as tumbling,
            count(*) filter (where 'spirit' = any (awards))::int as spirit,
            count(*) filter (where 'dance' = any (awards))::int as dance
     from public.ballots where meet_id = $1 group by team_id order by team_id`,
    [meet],
  );
}

export async function storedTallies(db: TestDb, meet: string) {
  return db.sql(
    `select team_id, votes, star_sum, stunts, tumbling, spirit, dance
     from judgey_private.team_tallies where meet_id = $1 and votes > 0 order by team_id`,
    [meet],
  );
}

/** Wait until a backend is blocked on a lock (proves two transactions really overlap). */
export async function waitUntilBlocked(db: TestDb, pid: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await db.sql("select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'", [pid]);
    if (rows.length) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`backend ${pid} never blocked on a lock`);
}

/** pg error code of a rejected promise (assert.rejects helper). */
export const pgCode = (code: string) => (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === code;
