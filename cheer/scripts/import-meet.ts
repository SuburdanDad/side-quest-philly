// Import a meet's running order: CSV (or the demo roster) → idempotent SQL on
// stdout, validation summary on stderr. Never hand-write rows.
// docs/backend-spec.md §7 and docs/meet-day-runbook.md.

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DEMO_MEET } from "../src/demo/meet.ts";
import { MIN_OPERATOR_CODE, emitSql, generateOperatorCode, planFromCsv, planFromDemo, type PlanResult } from "./import-meet-lib.ts";

const USAGE = `Usage:
  npm run import:meet -- --meet <id> --name "<name>" --date 2026-12-05 --tz America/New_York \\
    [--venue <venue>] [--city <city>] [--min-taps 3] [--operator | --operator-code <code>] [--write-ids] \\
    running-order.csv > meet.sql
  npm run import:meet -- --demo --start 2026-11-15T09:00-05:00 [--meet <id>] [--name "<name>"] \\
    [--operator | --operator-code <code>] > practice.sql

--operator        generate a random operator code (printed to stderr) and set it
--operator-code   set this code instead: ${MIN_OPERATOR_CODE}+ characters, not guessable
CSV columns: mat,time,gym,team,division[,team_id]   (time is local, like 9:04 AM or 09:04;
             mat is the label only, like 1 or A: a leading "Mat" is dropped)
Exit codes: 0 ok, 1 validation errors (no SQL written), 2 usage errors.`;

function main(argv: string[]): number {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        meet: { type: "string" },
        name: { type: "string" },
        date: { type: "string" },
        tz: { type: "string" },
        venue: { type: "string" },
        city: { type: "string" },
        "min-taps": { type: "string" },
        "operator-code": { type: "string" },
        operator: { type: "boolean" },
        "write-ids": { type: "boolean" },
        demo: { type: "boolean" },
        start: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values: v, positionals } = args;
  if (v.help) {
    console.error(USAGE);
    return 0;
  }
  const usage = (msg: string) => {
    console.error(`${msg}\n\n${USAGE}`);
    return 2;
  };
  const minTaps = v["min-taps"] === undefined ? undefined : Number(v["min-taps"]);
  const generatedCode = v.operator && v["operator-code"] === undefined;
  const operatorCode = generatedCode ? generateOperatorCode() : v["operator-code"];

  let result: PlanResult;
  let csvPath: string | undefined;
  if (v.demo) {
    if (positionals.length) return usage("--demo takes no CSV file");
    if (v["write-ids"]) return usage("--write-ids needs a CSV file");
    if (!v.start) return usage("--demo needs --start <ISO time with offset>");
    result = planFromDemo(DEMO_MEET, v.start, {
      meet: { id: v.meet, name: v.name, timeZone: v.tz, venue: v.venue, city: v.city, minTaps },
      operatorCode,
    });
  } else {
    if (positionals.length !== 1) return usage("pass exactly one running-order CSV file");
    if (!v.meet || !v.name || !v.date || !v.tz) return usage("--meet, --name, --date and --tz are required");
    if (v.start) return usage("--start only goes with --demo");
    csvPath = positionals[0];
    let text: string;
    try {
      text = readFileSync(csvPath, "utf8");
    } catch (err) {
      console.error(`can't read ${csvPath}: ${(err as Error).message}`);
      return 2;
    }
    result = planFromCsv(text, {
      meet: { id: v.meet, name: v.name, timeZone: v.tz, venue: v.venue, city: v.city, minTaps },
      date: v.date,
      operatorCode,
    });
  }

  for (const line of result.summary) console.error(line);
  for (const w of result.warnings) console.error(`warning: ${w}`);
  for (const e of result.errors) console.error(`error: ${e}`);
  if (result.errors.length || !result.plan) {
    console.error(`\n${result.errors.length} error(s); no SQL written.`);
    return 1;
  }

  if (v["write-ids"] && csvPath && result.csvWithIds) {
    writeFileSync(csvPath, result.csvWithIds);
    console.error(`wrote team_id values back into ${csvPath}`);
  }
  if (result.plan.operatorCode !== undefined) {
    if (generatedCode) console.error(`operator code (generated): ${result.plan.operatorCode}`);
    console.error("note: the SQL contains the operator code. Apply it, then delete it; never commit it.");
  }
  process.stdout.write(emitSql(result.plan));
  return 0;
}

process.exitCode = main(process.argv.slice(2));
