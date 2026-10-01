// Extensions the migrations remove (review fix): pg_graphql exposes every
// readable table on /graphql/v1 and trips advisor lints 0026/0027, and nothing
// uses it. On a plain Postgres it never existed, so the install-then-migrate
// check is skipped there; the "absent after migrations" check runs everywhere.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { DB_URL, dbSuite, migrationFiles } from "./harness.ts";

dbSuite("extensions", (ctx) => {
  test("pg_graphql is not installed after the migrations", async () => {
    assert.deepEqual(await ctx.db.sql("select extname from pg_extension where extname = 'pg_graphql'"), []);
  });
});

async function graphqlAvailable(): Promise<boolean> {
  if (!DB_URL) return false;
  const c = new pg.Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query("select 1 from pg_available_extensions where name = 'pg_graphql'")).rowCount === 1;
  } finally {
    await c.end();
  }
}

const available = await graphqlAvailable();
describe(
  "extensions: a Supabase database with pg_graphql",
  { skip: !DB_URL ? "JUDGEY_TEST_DATABASE_URL is not set" : !available ? "pg_graphql is not available on this server (plain Postgres)" : false },
  () => {
    test("the migrations drop pg_graphql", async () => {
      const name = `judgey_t_gql_${process.pid}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const admin = new pg.Client({ connectionString: DB_URL });
      await admin.connect();
      await admin.query(`create database ${name}`);
      const url = new URL(DB_URL!);
      url.pathname = `/${name}`;
      const db = new pg.Client({ connectionString: url.toString() });
      try {
        await db.connect();
        const bootstrap = readFileSync(new URL("../../supabase/tests/bootstrap.sql", import.meta.url), "utf8");
        await db.query(bootstrap);
        await db.query("create extension pg_graphql");
        assert.equal((await db.query("select 1 from pg_extension where extname = 'pg_graphql'")).rowCount, 1);
        for (const migration of migrationFiles()) await db.query(migration);
        assert.equal((await db.query("select 1 from pg_extension where extname = 'pg_graphql'")).rowCount, 0);
      } finally {
        await db.end().catch(() => {});
        await admin.query(`drop database if exists ${name} with (force)`);
        await admin.end();
      }
    });
  },
);
