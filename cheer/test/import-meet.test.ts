// The meet importer's pure parts (scripts/import-meet-lib.ts). No database here;
// test/db/import.test.ts applies the emitted SQL to a real one.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emitSql,
  generateOperatorCode,
  matLabel,
  MIN_OPERATOR_CODE,
  operatorCodeWeakness,
  parseCsv,
  parseDate,
  parseIsoWithOffset,
  parseTime,
  planFromCsv,
  planFromDemo,
  slugify,
  toCsv,
  tzOffset,
  uniqueId,
  zonedTimeToUtc,
} from "../scripts/import-meet-lib.ts";
import { DEMO_MEET } from "../src/demo/meet.ts";

const HOUR = 3_600_000;
const MEET = { id: "winter-classic-2026", name: "Winter Classic", timeZone: "America/New_York" };

test("parseCsv: quotes, escaped quotes, commas and newlines inside quotes, CRLF, BOM, blank rows", () => {
  const text = '﻿mat,time,gym,team,division\r\n1,9:04 AM,"Liberty Elite, Inc.","The ""Bombs""",Youth 2\r\n\r\n,,,,\r\n2, 09:10 ,"Multi\r\nLine",  Riot  ,"  Senior 4  "\r\n';
  const csv = parseCsv(text);
  assert.equal(csv.bom, true);
  assert.equal(csv.eol, "\r\n");
  assert.deepEqual(csv.rows, [
    ["mat", "time", "gym", "team", "division"],
    ["1", "9:04 AM", "Liberty Elite, Inc.", 'The "Bombs"', "Youth 2"],
    ["2", "09:10", "Multi\r\nLine", "Riot", "  Senior 4  "],
  ]);
  assert.deepEqual(csv.lines, [1, 2, 5]);
});

test("parseCsv: LF, no trailing newline, empty quoted field, spaces after a closing quote", () => {
  const csv = parseCsv('a,b,c\n"x" ,"",z');
  assert.equal(csv.bom, false);
  assert.equal(csv.eol, "\n");
  assert.deepEqual(csv.rows, [
    ["a", "b", "c"],
    ["x", "", "z"],
  ]);
});

test("toCsv round-trips through parseCsv", () => {
  const rows = [
    ["mat", "team", "team_id"],
    ["1", 'Say "hi", ok', "a-b"],
    ["2", "two\nlines", " padded "],
  ];
  for (const eol of ["\n", "\r\n"]) {
    const text = toCsv(rows, { bom: true, eol });
    assert.ok(text.startsWith("﻿"));
    assert.deepEqual(parseCsv(text).rows, rows);
  }
});

test("parseTime: 12-hour and 24-hour forms → minutes after midnight", () => {
  const cases: Array<[string, number | null]> = [
    ["9:04 AM", 9 * 60 + 4],
    ["9:04am", 9 * 60 + 4],
    ["9:04 a.m.", 9 * 60 + 4],
    ["12:30 PM", 12 * 60 + 30],
    ["12:05 AM", 5],
    ["1:15 pm", 13 * 60 + 15],
    ["9 AM", 9 * 60],
    ["09:04", 9 * 60 + 4],
    ["21:59", 21 * 60 + 59],
    ["9:04:00", 9 * 60 + 4],
    [" 7:45 PM ", 19 * 60 + 45],
    ["13:00 PM", null],
    ["0:30 AM", null],
    ["24:00", null],
    ["9:60", null],
    ["9", null],
    ["noon", null],
    ["9:4", null],
    ["", null],
  ];
  for (const [text, minutes] of cases) assert.equal(parseTime(text), minutes, JSON.stringify(text));
});

test("parseDate accepts only real calendar dates", () => {
  assert.deepEqual(parseDate("2026-12-05"), [2026, 12, 5]);
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("12/05/2026"), null);
});

test("zonedTimeToUtc uses the zone's offset on that date (DST both ways)", () => {
  const ny = "America/New_York";
  // Winter (EST, UTC-5) and summer (EDT, UTC-4).
  assert.equal(zonedTimeToUtc(2026, 12, 5, 9 * 60, ny), Date.UTC(2026, 11, 5, 14, 0));
  assert.equal(zonedTimeToUtc(2026, 7, 4, 9 * 60, ny), Date.UTC(2026, 6, 4, 13, 0));
  // Spring-forward day: 9:00 AM is already EDT.
  assert.equal(zonedTimeToUtc(2026, 3, 8, 9 * 60, ny), Date.UTC(2026, 2, 8, 13, 0));
  assert.equal(zonedTimeToUtc(2026, 3, 8, 60 + 59, ny), Date.UTC(2026, 2, 8, 6, 59)); // 1:59 AM EST
  // 2:30 AM does not exist that day.
  assert.throws(() => zonedTimeToUtc(2026, 3, 8, 2 * 60 + 30, ny), /does not exist/);
  // Fall-back day: 9:00 AM is EST again; 1:30 AM happens twice → the earlier (EDT) one.
  assert.equal(zonedTimeToUtc(2026, 11, 1, 9 * 60, ny), Date.UTC(2026, 10, 1, 14, 0));
  assert.equal(zonedTimeToUtc(2026, 11, 1, 90, ny), Date.UTC(2026, 10, 1, 5, 30));
  // Other zones, including a half-hour offset and no DST.
  assert.equal(zonedTimeToUtc(2026, 12, 5, 9 * 60, "America/Los_Angeles"), Date.UTC(2026, 11, 5, 17, 0));
  assert.equal(zonedTimeToUtc(2026, 12, 5, 9 * 60, "America/Phoenix"), Date.UTC(2026, 11, 5, 16, 0));
  assert.equal(zonedTimeToUtc(2026, 12, 5, 9 * 60, "Asia/Kolkata"), Date.UTC(2026, 11, 5, 3, 30));
  assert.equal(tzOffset(Date.UTC(2026, 11, 5, 14), ny), -5 * HOUR);
});

test("parseIsoWithOffset requires an explicit offset", () => {
  assert.equal(parseIsoWithOffset("2026-11-15T09:00-05:00"), Date.UTC(2026, 10, 15, 14, 0));
  assert.equal(parseIsoWithOffset("2026-11-15T09:00:30.5+0100"), Date.UTC(2026, 10, 15, 8, 0, 30, 500));
  assert.equal(parseIsoWithOffset("2026-11-15T14:00Z"), Date.UTC(2026, 10, 15, 14, 0));
  assert.equal(parseIsoWithOffset("2026-11-15T09:00"), null);
  assert.equal(parseIsoWithOffset("2026-11-15T09:00:00"), null);
  assert.equal(parseIsoWithOffset("2026-11-15"), null);
  assert.equal(parseIsoWithOffset("Nov 15 2026 9:00 AM"), null);
  assert.equal(parseIsoWithOffset("2026-02-30T09:00Z"), null);
});

test("slugify and uniqueId: stable, ascii, at most 80 chars, deduped", () => {
  assert.equal(slugify("Liberty Élite Sapphire"), "liberty-elite-sapphire");
  assert.equal(slugify("  Keystone Cheer Co. -- Royals!! "), "keystone-cheer-co-royals");
  assert.equal(slugify("***"), "team");
  assert.equal(slugify("x".repeat(100)).length, 80);
  const taken = new Set(["a", "a-2"]);
  assert.equal(uniqueId("a", taken), "a-3");
  assert.equal(uniqueId("b", taken), "b");
  const long = "y".repeat(80);
  assert.equal(uniqueId(long, new Set([long])), `${"y".repeat(78)}-2`);
});

const GOOD = [
  "mat,time,gym,team,division",
  "1,9:00 AM,Liberty Elite,Sapphire,Youth 2",
  "1,9:04 AM,Northeast Storm,Thunder,Youth 2",
  "2,9:10 AM,Liberty Elite,Sapphire,Senior 4",
  "10,9:12 AM,Ironbound,Steel,Senior 4",
  "2,9:14 AM,O'Hara's All Stars,Rock & Roll,Senior 4",
].join("\n");

test("planFromCsv: ids, natural mat order, UTC times, summary, --write-ids content", () => {
  const res = planFromCsv(GOOD, { meet: MEET, date: "2026-12-05" });
  assert.deepEqual(res.errors, []);
  const plan = res.plan!;
  assert.deepEqual(plan.mats, ["1", "2", "10"]);
  assert.equal(plan.startsAt, Date.UTC(2026, 11, 5, 14, 0));
  assert.deepEqual(
    plan.routines.map((r) => [r.teamId, r.mat, r.scheduledAt - plan.startsAt]),
    [
      ["liberty-elite-sapphire", "1", 0],
      ["northeast-storm-thunder", "1", 4 * 60_000],
      ["liberty-elite-sapphire-2", "2", 10 * 60_000],
      ["ironbound-steel", "10", 12 * 60_000],
      ["o-hara-s-all-stars-rock-roll", "2", 14 * 60_000],
    ],
  );
  assert.match(res.summary[0], /5 routines on 3 mat/);
  assert.ok(res.summary.some((l) => l.includes("Mat 1: 2 routines, 9:00 AM – 9:04 AM")));
  assert.ok(res.summary.some((l) => /Re-import note: .*scratched today/.test(l)));
  // Liberty Elite Sapphire is listed twice (two divisions): a warning, not an error.
  assert.deepEqual(res.warnings, [
    "line 4: Liberty Elite Sapphire is also on line 2 (fine if they compete twice; otherwise a duplicate row)",
    "5 team id(s) generated from gym + team; run with --write-ids to keep them stable across revisions",
  ]);
  const written = parseCsv(res.csvWithIds!).rows;
  assert.deepEqual(written[0], ["mat", "time", "gym", "team", "division", "team_id"]);
  assert.deepEqual(
    written.slice(1).map((r) => r[5]),
    plan.routines.map((r) => r.teamId),
  );
  // Re-importing the written CSV keeps every id and needs no more writing.
  const again = planFromCsv(res.csvWithIds!, { meet: MEET, date: "2026-12-05" });
  assert.deepEqual(
    again.plan!.routines.map((r) => r.teamId),
    plan.routines.map((r) => r.teamId),
  );
  assert.equal(again.csvWithIds, undefined);
  assert.equal(again.warnings.length, 1);
  assert.match(again.warnings[0], /also on line 2/);
});

test("planFromCsv: given team_ids win, and generated ids never collide with them", () => {
  const csv = [
    "Mat,Time,Gym,Team,Division,Team ID",
    "1,9:00,Liberty Elite,Sapphire,Youth 2,",
    "1,9:04,Other,Team,Youth 2,liberty-elite-sapphire",
  ].join("\n");
  const res = planFromCsv(csv, { meet: MEET, date: "2026-12-05" });
  assert.deepEqual(res.errors, []);
  assert.deepEqual(
    res.plan!.routines.map((r) => r.teamId),
    ["liberty-elite-sapphire-2", "liberty-elite-sapphire"],
  );
});

test("planFromCsv: every validation error is reported, and none means no plan", () => {
  const csv = [
    "mat,time,gym,team,division,team_id",
    "1,9:00 AM,Gym,A,Youth,dup",
    "1,9:00 AM,Gym,B,Youth,dup", // duplicate id; time not increasing
    "1,8:59 AM,Gym,C,Youth,", // goes backwards
    "2,5:30 AM,Gym,D,Youth,", // too early
    "2,10:30 PM,Gym,E,Youth,", // too late
    "2,25:00,Gym,F,Youth,", // bad time
    "2,9:00 AM,,G,Youth,", // empty gym
    "2,9:05 AM,Gym,H,Youth,Bad_Id",
    "2,9:06 AM,Gym,I,Youth,ok,extra",
  ].join("\n");
  const res = planFromCsv(csv, { meet: MEET, date: "2026-12-05" });
  assert.equal(res.plan, undefined);
  const text = res.errors.join("\n");
  for (const pattern of [
    /line 3: duplicate team_id "dup" \(also line 2\)/,
    /line 3: mat 1 time 9:00 AM is not after line 2/,
    /line 4: mat 1 time 8:59 AM is not after line 3/,
    /line 5: 5:30 AM is outside/,
    /line 6: 10:30 PM is outside/,
    /line 7: time "25:00"/,
    /line 8: empty gym/,
    /line 9: team_id "Bad_Id"/,
    /line 10: 7 fields but the header has 6/,
  ]) {
    assert.match(text, pattern);
  }
});

test("planFromCsv: bad arguments and headers", () => {
  const bad = planFromCsv(GOOD, {
    meet: { id: "X", name: " ", timeZone: "Mars/Olympus", minTaps: 7 },
    date: "2026-13-01",
    operatorCode: "short-code-1234",
  });
  const text = bad.errors.join("\n");
  for (const pattern of [/--meet "X"/, /--name/, /--tz "Mars\/Olympus"/, /--min-taps/, /--operator-code/, /--date/]) {
    assert.match(text, pattern);
  }
  assert.match(planFromCsv("team,time\nA,9:00", { meet: MEET, date: "2026-12-05" }).errors[0], /missing mat, gym, division/);
  assert.match(planFromCsv("", { meet: MEET, date: "2026-12-05" }).errors[0], /empty/);
  assert.match(planFromCsv("mat,time,gym,team,division\n", { meet: MEET, date: "2026-12-05" }).errors[0], /no routines/);
  // A time in the spring-forward gap is an error, not a silent shift.
  const gap = planFromCsv("mat,time,gym,team,division\n1,2:30 AM,G,T,D", { meet: MEET, date: "2026-03-08" });
  assert.match(gap.errors.join("\n"), /does not exist/);
});

test("emitSql: one idempotent transaction; quoting; scratch-on-missing; operator code; optional fields", () => {
  const res = planFromCsv(GOOD, {
    meet: { ...MEET, venue: "Hall B", minTaps: 3 },
    date: "2026-12-05",
    operatorCode: "it's-a-secret-code-9xq",
  });
  const sql = emitSql(res.plan!, new Date(0));
  assert.match(sql, /^-- Generated by scripts\/import-meet\.ts at 1970-01-01T00:00:00\.000Z/);
  assert.match(sql, /\nbegin;\nset local standard_conforming_strings = on;\n/);
  assert.match(sql, /\ncommit;\n$/);
  assert.match(sql, /'O''Hara''s All Stars', 'Senior 4', '2', timestamptz '2026-12-05T14:14:00\.000Z', 'scheduled'\)/);
  assert.match(sql, /schedule_version = public\.meets\.schedule_version \+ 1;/);
  assert.match(sql, /venue = excluded\.venue,\n {2}min_taps = excluded\.min_taps,/);
  assert.doesNotMatch(sql, /city/, "city not given → not overwritten");
  assert.match(sql, /team_id <> all \(array\['liberty-elite-sapphire', .*'o-hara-s-all-stars-rock-roll'\]::text\[\]\);/);
  assert.match(sql, /extensions\.crypt\('it''s-a-secret-code-9xq', extensions\.gen_salt\('bf'\)\)/);
  assert.equal((sql.match(/\binsert into/g) ?? []).length, 3);
  assert.doesNotMatch(emitSql(planFromCsv(GOOD, { meet: MEET, date: "2026-12-05" }).plan!), /operator_codes/);
});

test("planFromDemo: refuses a --start without an offset; shifts the roster", () => {
  const refused = planFromDemo(DEMO_MEET, "2026-11-15T09:00", { meet: {} });
  assert.equal(refused.plan, undefined);
  assert.match(refused.errors[0], /explicit offset/);

  const res = planFromDemo(DEMO_MEET, "2026-11-15T09:00-05:00", { meet: { id: "practice-1115", name: "Practice" } });
  assert.deepEqual(res.errors, []);
  const plan = res.plan!;
  const shift = Date.UTC(2026, 10, 15, 14, 0) - Math.min(...DEMO_MEET.slots.map((s) => s.scheduledAt));
  assert.equal(plan.meet.id, "practice-1115");
  assert.equal(plan.meet.name, "Practice");
  assert.equal(plan.meet.timeZone, DEMO_MEET.timeZone);
  assert.equal(plan.startsAt, Date.UTC(2026, 10, 15, 14, 0));
  assert.equal(plan.routines.length, DEMO_MEET.slots.length);
  for (const [k, slot] of DEMO_MEET.slots.entries()) {
    assert.equal(plan.routines[k].teamId, slot.teamId);
    assert.equal(plan.routines[k].scheduledAt, slot.scheduledAt + shift);
  }
  assert.deepEqual(res.warnings, []);
  // A late-night practice is allowed, with a warning.
  assert.match(planFromDemo(DEMO_MEET, "2026-11-15T23:00-05:00", { meet: {} }).warnings[0], /outside/);
});

test("parseCsv: an unterminated quote is an error naming the line where it opened", () => {
  const text = 'mat,time,gym,team,division\n1,9:00 AM,Liberty,Sapphire,"Senior Coed 5\n1,9:03 AM,Keystone,Royals,Senior Coed 5\n2,9:00 AM,Philly,Storm,Youth 2\n';
  assert.match(parseCsv(text).error ?? "", /^line 2: unterminated quote/);
  const res = planFromCsv(text, { meet: MEET, date: "2026-12-05" });
  assert.equal(res.plan, undefined);
  assert.equal(res.csvWithIds, undefined, "--write-ids must not rewrite a broken file");
  assert.match(res.errors.join("\n"), /line 2: unterminated quote/);
  // A properly closed quote with a newline inside is still valid CSV...
  assert.equal(parseCsv('a\n"x\ny"\n').error, undefined);
});

test("planFromCsv: line breaks inside mat/time/gym/team/division are rejected", () => {
  const res = planFromCsv('mat,time,gym,team,division\n1,9:00 AM,"Liberty\nElite",Sapphire,Youth 2\n', { meet: MEET, date: "2026-12-05" });
  assert.equal(res.plan, undefined);
  assert.match(res.errors.join("\n"), /line 2: gym must not contain a line break/);
});

test("planFromCsv: mat labels are normalized; whitespace collapsed; case variants are errors", () => {
  assert.equal(matLabel("Mat 1"), "1");
  assert.equal(matLabel("  MAT   2 "), "2");
  assert.equal(matLabel("mat1"), "1");
  assert.equal(matLabel("Mat A"), "A");
  assert.equal(matLabel("Matrix"), "Matrix");
  assert.equal(matLabel("10"), "10");

  const ok = planFromCsv(
    [
      "mat,time,gym,team,division",
      "Mat 1,9:00 AM,Liberty  Elite,Sapphire,Senior  Coed 5",
      "1,9:04 AM,Keystone, Royals ,Senior Coed 5",
      "MAT 2,9:10 AM,Philly,Storm,Youth 2",
    ].join("\n"),
    { meet: MEET, date: "2026-12-05" },
  );
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.plan!.mats, ["1", "2"]);
  assert.deepEqual(
    ok.plan!.routines.map((r) => [r.mat, r.gym, r.teamName, r.division]),
    [
      ["1", "Liberty Elite", "Sapphire", "Senior Coed 5"],
      ["1", "Keystone", "Royals", "Senior Coed 5"],
      ["2", "Philly", "Storm", "Youth 2"],
    ],
  );

  const bad = planFromCsv(
    [
      "mat,time,gym,team,division",
      "1,9:00 AM,G,A,Senior Coed 5",
      "1,9:04 AM,G,B,senior coed 5",
      "A,9:00 AM,G,C,Youth 2",
      "a,9:05 AM,G,D,Youth 2",
      "Mat,9:06 AM,G,E,Youth 2",
    ].join("\n"),
    { meet: MEET, date: "2026-12-05" },
  );
  assert.equal(bad.plan, undefined);
  const text = bad.errors.join("\n");
  assert.match(text, /line 3: division "senior coed 5" differs only in case\/spacing from "Senior Coed 5" \(line 2\)/);
  assert.match(text, /line 5: mat "a" differs only in case\/spacing from "A" \(line 4\)/);
  assert.match(text, /line 6: mat "Mat" has no label/);
});

test("planFromCsv: enforces the database lengths (mat <= 16, gym/team/division <= 80)", () => {
  const long = "x".repeat(81);
  const res = planFromCsv(
    ["mat,time,gym,team,division", `${"9".repeat(17)},9:00 AM,${long},${long},${long}`].join("\n"),
    { meet: MEET, date: "2026-12-05" },
  );
  assert.equal(res.plan, undefined);
  const text = res.errors.join("\n");
  assert.match(text, /line 2: mat "9{17}" is longer than 16 characters/);
  for (const name of ["gym", "team", "division"]) assert.match(text, new RegExp(`line 2: ${name} is longer than 80 characters`));
  const edge = planFromCsv(
    ["mat,time,gym,team,division", `${"9".repeat(16)},9:00 AM,${"y".repeat(80)},T,D`].join("\n"),
    { meet: MEET, date: "2026-12-05" },
  );
  assert.deepEqual(edge.errors, []);
});

test("operator codes: generated ones are long and random; weak supplied ones are refused", () => {
  const a = generateOperatorCode();
  const b = generateOperatorCode();
  assert.match(a, /^[a-km-np-z2-9]{5}(-[a-km-np-z2-9]{5}){3}$/);
  assert.notEqual(a, b);
  assert.equal(operatorCodeWeakness(a, MEET), null);
  // Deterministic: every byte maps into the 32-symbol alphabet.
  assert.equal(generateOperatorCode(() => new Uint8Array(20).fill(255)), "99999-99999-99999-99999");

  assert.equal(MIN_OPERATOR_CODE, 16);
  assert.match(operatorCodeWeakness("Zq7xP2mLk9Rt", MEET)!, /at least 16/);
  assert.match(operatorCodeWeakness("aaaaaaaaaaaaaaaaaaaa", MEET)!, /repetitive/);
  assert.match(operatorCodeWeakness("my-password-is-long", MEET)!, /password/);
  assert.match(operatorCodeWeakness("winter-classic-2026!", MEET)!, /meet id or name/);
  assert.match(operatorCodeWeakness("has a space in it ok", MEET)!, /spaces/);
  assert.equal(operatorCodeWeakness("practice-code-123", MEET), null);

  const res = planFromDemo(DEMO_MEET, "2026-11-15T09:00-05:00", { meet: {}, operatorCode: "12345678" });
  assert.match(res.errors.join("\n"), /--operator-code must be at least 16 characters.*--operator/);
});

test("emitSql: a re-import raises a NOTICE naming scratched routines it will un-scratch", () => {
  const res = planFromCsv(GOOD, { meet: MEET, date: "2026-12-05" });
  const sql = emitSql(res.plan!);
  const notice = sql.indexOf("raise notice 'Re-import UN-SCRATCHES");
  assert.ok(notice > 0);
  assert.ok(notice < sql.indexOf("insert into public.routines"), "the notice must run before the upsert resets status");
  assert.match(sql, /where meet_id = 'winter-classic-2026' and status = 'scratched'\n {4}and team_id = any \(array\['liberty-elite-sapphire', /);
});
