// The importer's SQL applied to a real migrated database: clean apply,
// idempotent re-apply, revisions that scratch (never delete) dropped routines,
// and a working operator code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitSql, planFromCsv, planFromDemo } from "../../scripts/import-meet-lib.ts";
import { DEMO_MEET } from "../../src/demo/meet.ts";
import { dbSuite, user } from "./harness.ts";

const csv = (rows: string[]) => ["mat,time,gym,team,division,team_id", ...rows].join("\r\n");

/** `npm run import:meet -- …`, for real: exit status, SQL on stdout, summary on stderr. */
function importMeet(args: string[]) {
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const node = ["--experimental-strip-types", "--no-warnings", "scripts/import-meet.ts"];
  const res = spawnSync(process.execPath, [...node, ...args], { cwd, encoding: "utf8" });
  return { status: res.status, sql: res.stdout, log: res.stderr };
}

dbSuite("import SQL", (ctx) => {
  test("--demo output applies cleanly, twice, and its operator code works", async () => {
    const { db } = ctx;
    const res = planFromDemo(DEMO_MEET, "2026-12-05T09:00-05:00", {
      meet: { id: db.meetId("demo") },
      operatorCode: "practice-code-123",
    });
    assert.deepEqual(res.errors, []);
    const sql = emitSql(res.plan!);
    await db.sql(sql);
    await db.sql(sql);
    const id = res.plan!.meet.id;
    const snap = await db.rpc("anon", "meet_snapshot", { p_meet: id, p_have_version: 0 });
    assert.equal(snap.scheduleVersion, 2);
    assert.equal(snap.schedule.meet.name, DEMO_MEET.name);
    assert.equal(snap.schedule.meet.startsAt, Date.UTC(2026, 11, 5, 14, 0));
    assert.equal(snap.schedule.routines.length, DEMO_MEET.slots.length);
    const byId = new Map(snap.schedule.routines.map((r: { teamId: string }) => [r.teamId, r]));
    const shift = Date.UTC(2026, 11, 5, 14, 0) - Math.min(...DEMO_MEET.slots.map((s) => s.scheduledAt));
    for (const slot of DEMO_MEET.slots) {
      const row = byId.get(slot.teamId) as { scheduledAt: number; mat: string; status: string };
      assert.equal(row.scheduledAt, slot.scheduledAt + shift);
      assert.equal(row.mat, slot.mat);
      assert.equal(row.status, slot.status ?? "scheduled");
    }
    assert.deepEqual(await db.rpc(user(), "claim_operator", { p_meet: id, p_code: "practice-code-123" }), { ok: true });
  });

  test("a revised CSV updates, adds and scratches routines without losing ballots", async () => {
    const { db } = ctx;
    const meet = { id: db.meetId("csv"), name: "Riverside Invitational", timeZone: "America/New_York" };
    const v1 = planFromCsv(
      csv([
        "1,9:00 AM,Gym A,Comets,Youth 2,a-comets",
        '1,9:04 AM,"Gym B, Inc.",Bolts,Youth 2,b-bolts',
        "2,9:10 AM,Gym C,Stars,Senior 4,c-stars",
      ]),
      { meet: { ...meet, venue: "Hall 1" }, date: "2026-12-05" },
    );
    assert.deepEqual(v1.errors, []);
    await db.sql(emitSql(v1.plan!));
    // A ballot on b-bolts (as the superuser, standing in for meet day).
    await db.sql(
      `insert into public.ballots (meet_id, team_id, user_id, stars, cast_at) values ($1, 'b-bolts', $2, 5, now())`,
      [meet.id, user()],
    );

    const v2 = planFromCsv(
      csv([
        "1,9:00 AM,Gym A,Comets,Youth 2,a-comets",
        "2,9:12 AM,Gym C,Stars,Senior 4,c-stars",
        "2,9:20 AM,Gym D,Novas,Senior 4,d-novas",
      ]),
      { meet: { ...meet, minTaps: 3 }, date: "2026-12-05" },
    );
    await db.sql(emitSql(v2.plan!));
    const rows = await db.sql(
      `select team_id, team_name, gym, mat, status, judgey_private.ms(scheduled_at) as at
       from public.routines where meet_id = $1 order by team_id`,
      [meet.id],
    );
    assert.deepEqual(rows, [
      { team_id: "a-comets", team_name: "Comets", gym: "Gym A", mat: "1", status: "scheduled", at: Date.UTC(2026, 11, 5, 14, 0) },
      { team_id: "b-bolts", team_name: "Bolts", gym: "Gym B, Inc.", mat: "1", status: "scratched", at: Date.UTC(2026, 11, 5, 14, 4) },
      { team_id: "c-stars", team_name: "Stars", gym: "Gym C", mat: "2", status: "scheduled", at: Date.UTC(2026, 11, 5, 14, 12) },
      { team_id: "d-novas", team_name: "Novas", gym: "Gym D", mat: "2", status: "scheduled", at: Date.UTC(2026, 11, 5, 14, 20) },
    ]);
    assert.equal((await db.sql("select * from public.ballots where meet_id = $1", [meet.id])).length, 1);
    const m = await db.one("select schedule_version, venue, min_taps, mats from public.meets where id = $1", [meet.id]);
    assert.deepEqual(m, { schedule_version: 2, venue: "Hall 1", min_taps: 3, mats: ["1", "2"] });

    // Putting the team back unscratches it.
    const v3 = planFromCsv(
      csv(["1,9:00 AM,Gym A,Comets,Youth 2,a-comets", "1,9:04 AM,Gym B,Bolts,Youth 2,b-bolts"]),
      { meet, date: "2026-12-05" },
    );
    await db.sql(emitSql(v3.plan!));
    const back = await db.sql("select team_id, status from public.routines where meet_id = $1 order by team_id", [meet.id]);
    assert.deepEqual(
      back.map((r) => `${r.team_id}:${r.status}`),
      ["a-comets:scheduled", "b-bolts:scheduled", "c-stars:scratched", "d-novas:scratched"],
    );
  });

  test("the CLI's SQL (--demo, and CSVs on DST change days) applies cleanly and meet_snapshot returns the schedule", async () => {
    const { db } = ctx;
    const snapshot = (id: string) => db.rpc("anon", "meet_snapshot", { p_meet: id, p_have_version: 0 });

    const demoId = db.meetId("cli-demo");
    const code = "practice-code-123";
    const demo = importMeet(["--demo", "--start", "2026-12-05T09:00-05:00", "--meet", demoId, "--operator-code", code]);
    assert.equal(demo.status, 0, demo.log);
    await db.sql(demo.sql);
    await db.sql(demo.sql);
    let snap = await snapshot(demoId);
    assert.equal(snap.scheduleVersion, 2);
    const shift = Date.UTC(2026, 11, 5, 14, 0) - Math.min(...DEMO_MEET.slots.map((s) => s.scheduledAt));
    assert.deepEqual(
      snap.schedule.routines
        .map((r: { teamId: string; mat: string; scheduledAt: number }) => [r.teamId, r.mat, r.scheduledAt])
        .sort(),
      DEMO_MEET.slots.map((s) => [s.teamId, s.mat, s.scheduledAt + shift]).sort(),
    );
    assert.deepEqual(await db.rpc(user(), "claim_operator", { p_meet: demoId, p_code: code }), { ok: true });

    const dir = mkdtempSync(join(tmpdir(), "judgey-import-"));
    try {
      // US fall-back day: the 2 AM change makes every routine EST (UTC-5), not the morning's EDT.
      const fallback = join(dir, "fallback.csv");
      writeFileSync(
        fallback,
        [
          "mat,time,gym,team,division",
          '1,8:00 AM,"Liberty Elite, Inc.",Sapphire,Youth 2',
          "1,8:04 AM,Northeast Storm,Thunder,Youth 2",
          "2,9:00,Keystone Cheer Co.,Royals,Senior 4",
          "",
        ].join("\r\n"),
      );
      const id = db.meetId("cli-dst");
      const meetArgs = ["--meet", id, "--name", "Fall Back Classic", "--date", "2026-11-01", "--tz", "America/New_York"];
      const out = importMeet([...meetArgs, "--min-taps", "3", "--write-ids", fallback]);
      assert.equal(out.status, 0, out.log);
      assert.match(out.log, /3 routines on 2 mat\(s\), min taps 3/);
      assert.match(
        readFileSync(fallback, "utf8"),
        /^mat,time,gym,team,division,team_id\r\n1,8:00 AM,"Liberty Elite, Inc.",Sapphire,Youth 2,liberty-elite-inc-sapphire\r\n/,
      );
      await db.sql(out.sql);
      snap = await snapshot(id);
      assert.equal(snap.schedule.meet.minTaps, 3);
      assert.equal(snap.schedule.meet.timeZone, "America/New_York");
      const routine = (teamId: string, teamName: string, gym: string, division: string, mat: string, utc: number) => ({
        teamId,
        teamName,
        gym,
        division,
        mat,
        scheduledAt: utc,
        status: "scheduled",
      });
      assert.deepEqual(snap.schedule.routines, [
        routine("liberty-elite-inc-sapphire", "Sapphire", "Liberty Elite, Inc.", "Youth 2", "1", Date.UTC(2026, 10, 1, 13, 0)),
        routine("northeast-storm-thunder", "Thunder", "Northeast Storm", "Youth 2", "1", Date.UTC(2026, 10, 1, 13, 4)),
        routine("keystone-cheer-co-royals", "Royals", "Keystone Cheer Co.", "Senior 4", "2", Date.UTC(2026, 10, 1, 14, 0)),
      ]);
      // Re-importing the CSV with its written-back ids changes nothing but the version.
      const again = importMeet([...meetArgs, fallback]);
      assert.equal(again.status, 0, again.log);
      await db.sql(again.sql);
      const snap2 = await snapshot(id);
      assert.equal(snap2.scheduleVersion, 2);
      assert.deepEqual(snap2.schedule.routines, snap.schedule.routines);
      assert.equal(snap2.schedule.meet.minTaps, 3, "--min-taps only overwrites when given");

      // Sydney's spring-forward day: AEDT (UTC+11) from 2 AM on.
      const sydney = join(dir, "sydney.csv");
      writeFileSync(sydney, "mat,time,gym,team,division\n1,9:00 AM,Harbour Cheer,Waves,Open\n");
      const syd = db.meetId("cli-syd");
      const res = importMeet([
        ...["--meet", syd, "--name", "Spring Forward Cup", "--date", "2026-10-04", "--tz", "Australia/Sydney"],
        sydney,
      ]);
      assert.equal(res.status, 0, res.log);
      await db.sql(res.sql);
      assert.equal((await snapshot(syd)).schedule.routines[0].scheduledAt, Date.UTC(2026, 9, 3, 22, 0));

      // A bad file: errors on stderr, exit 1, and no SQL at all.
      const bad = join(dir, "bad.csv");
      writeFileSync(bad, "mat,time,gym,team,division\n1,9:04 AM,G,A,Open\n1,9:00 AM,G,B,Open\n");
      const refused = importMeet([
        ...["--meet", db.meetId("cli-bad"), "--name", "Bad", "--date", "2026-12-05", "--tz", "America/New_York"],
        bad,
      ]);
      assert.equal(refused.status, 1);
      assert.equal(refused.sql, "");
      assert.match(refused.log, /times must increase within a mat/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
