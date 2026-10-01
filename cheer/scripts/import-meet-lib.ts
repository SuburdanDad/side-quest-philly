// Pure parts of the meet importer (docs/backend-spec.md §7): CSV parsing,
// wall-clock → UTC with an Intl offset lookup, validation, slug ids, and the
// idempotent SQL. No I/O here; scripts/import-meet.ts does the files and exit codes.

import { randomBytes } from "node:crypto";
import type { Meet } from "../src/types.ts";

const MINUTE = 60_000;
const DAY = 86_400_000;
const MEET_ID = /^[a-z0-9-]{3,64}$/;
const TEAM_ID = /^[a-z0-9-]{1,80}$/;
const REQUIRED = ["mat", "time", "gym", "team", "division"] as const;
/** Routines outside this local window are almost always an AM/PM typo. */
const EARLIEST = 6 * 60;
const LATEST = 22 * 60;
/** Column lengths the database and UI expect (mat chips are tiny). */
const MAX_MAT = 16;
const MAX_TEXT = 80;
/** Operator codes are claimable by anyone with a fresh anonymous identity, so they must be unguessable. */
export const MIN_OPERATOR_CODE = 16;

// ---------------------------------------------------------------------------
// CSV (RFC 4180: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM)

export interface Csv {
  rows: string[][];
  /** 1-based source line where each row starts (for error messages). */
  lines: number[];
  bom: boolean;
  eol: "\r\n" | "\n";
  /** Set when the text is not valid CSV (e.g. a quote that is never closed). */
  error?: string;
}

export function parseCsv(text: string): Csv {
  const bom = text.startsWith("﻿");
  const src = bom ? text.slice(1) : text;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false; // inside a quoted field
  let wasQuoted = false; // this field had quotes (keep its spaces)
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1; // where the open quoted field started

  const endField = () => {
    row.push(wasQuoted ? field : field.trim());
    field = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    // Skip blank lines and spreadsheet filler rows like ",,,,".
    if (row.some((f) => f !== "")) {
      rows.push(row);
      lines.push(rowLine);
    }
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"' && field.trim() === "") {
      quoted = true;
      wasQuoted = true;
      quoteLine = line;
      field = "";
    } else if (wasQuoted && (ch === " " || ch === "\t")) {
      // spaces between a closing quote and the next comma
    } else if (ch === ",") {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += ch;
    }
  }
  if (quoted) {
    // Everything after the open quote would silently become one field: refuse instead.
    return {
      rows,
      lines,
      bom,
      eol,
      error: `line ${quoteLine}: unterminated quote (") — every row after it would be swallowed into one field`,
    };
  }
  if (field !== "" || row.length > 0 || wasQuoted) endRow();
  return { rows, lines, bom, eol };
}

const csvField = (f: string) => (/[",\r\n]|^\s|\s$/.test(f) ? `"${f.replace(/"/g, '""')}"` : f);

export function toCsv(rows: string[][], { bom = false, eol = "\n" }: { bom?: boolean; eol?: string } = {}): string {
  return (bom ? "﻿" : "") + rows.map((r) => r.map(csvField).join(",")).join(eol) + eol;
}

// ---------------------------------------------------------------------------
// Times

/** "9:04 AM", "9:04am", "9:04 a.m.", "9 AM", "09:04", "21:04", "9:04:00" → minutes after midnight. */
export function parseTime(text: string): number | null {
  const s = text.trim().toLowerCase();
  const twelve = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/.exec(s);
  if (twelve) {
    const [h, m, sec] = [Number(twelve[1]), Number(twelve[2] ?? 0), Number(twelve[3] ?? 0)];
    if (h < 1 || h > 12 || m > 59 || sec > 59) return null;
    return ((h % 12) + (twelve[4] === "p" ? 12 : 0)) * 60 + m;
  }
  const day = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (day) {
    const [h, m, sec] = [Number(day[1]), Number(day[2]), Number(day[3] ?? 0)];
    if (h > 23 || m > 59 || sec > 59) return null;
    return h * 60 + m;
  }
  return null;
}

/** "2026-12-05" → [2026, 12, 5], or null if it isn't a real calendar date. */
export function parseDate(text: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? [y, mo, d] : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock in `timeZone` at instant `utc`, expressed as if it were UTC ms. */
function wallClock(utc: number, timeZone: string): number {
  const p: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(utc))) p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) + (utc - Math.floor(utc / 1000) * 1000);
}

/** UTC offset (ms) of `timeZone` at instant `utc`: local = utc + offset. */
export function tzOffset(utc: number, timeZone: string): number {
  return wallClock(utc, timeZone) - utc;
}

/**
 * A local wall-clock time in `timeZone` → epoch ms, via the zone's offsets
 * just before and after (handles DST). A time skipped by a spring-forward jump
 * throws; a repeated fall-back time resolves to the earlier instant.
 */
export function zonedTimeToUtc(y: number, mo: number, d: number, minutes: number, timeZone: string): number {
  const wall = Date.UTC(y, mo - 1, d) + minutes * MINUTE;
  const candidates = [tzOffset(wall - DAY, timeZone), tzOffset(wall + DAY, timeZone)]
    .map((offset) => wall - offset)
    .filter((utc) => wallClock(utc, timeZone) === wall)
    .sort((a, b) => a - b);
  if (candidates.length === 0) {
    throw new RangeError(`${formatWall(minutes)} does not exist on ${y}-${pad(mo)}-${pad(d)} in ${timeZone} (DST)`);
  }
  return candidates[0];
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatWall = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** "h:mm AM" in the meet's zone, for the summary. */
export function localTime(utc: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(utc);
}

/** An ISO-8601 timestamp WITH an explicit offset ("Z" or ±hh:mm) → epoch ms; anything else → null. */
export function parseIsoWithOffset(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})$/.exec(text.trim());
  if (!m) return null;
  const date = parseDate(`${m[1]}-${m[2]}-${m[3]}`);
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (!date || h > 23 || mi > 59 || s > 59) return null;
  const ms = Number((m[7] ?? "0").padEnd(3, "0"));
  let offset = 0;
  if (m[8] !== "Z") {
    const digits = m[8].replace(":", "");
    const [oh, om] = [Number(digits.slice(1, 3)), Number(digits.slice(3, 5))];
    if (oh > 14 || om > 59) return null;
    offset = (digits[0] === "-" ? -1 : 1) * (oh * 60 + om) * MINUTE;
  }
  return Date.UTC(date[0], date[1] - 1, date[2], h, mi, s, ms) - offset;
}

// ---------------------------------------------------------------------------
// Ids

/** "Liberty Élite" + "Sapphire" → "liberty-elite-sapphire" (a-z, 0-9, '-'; at most 80 chars). */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "team";
}

/** slug, slug-2, slug-3, … whichever is free (still at most 80 chars). */
export function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = `${base.slice(0, 80 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(id)) return id;
  }
}

// ---------------------------------------------------------------------------
// Plans

export interface MeetInfo {
  id: string;
  name: string;
  timeZone: string;
  /** Optional on re-import: only set when given. */
  venue?: string;
  city?: string;
  minTaps?: number;
}

export interface PlannedRoutine {
  teamId: string;
  teamName: string;
  gym: string;
  division: string;
  mat: string;
  scheduledAt: number;
  status: "scheduled" | "scratched";
}

export interface ImportPlan {
  meet: MeetInfo;
  mats: string[];
  startsAt: number;
  routines: PlannedRoutine[];
  operatorCode?: string;
}

export interface PlanResult {
  plan?: ImportPlan;
  errors: string[];
  warnings: string[];
  summary: string[];
  /** The CSV with every team_id filled in (for --write-ids). */
  csvWithIds?: string;
}

export interface CsvOptions {
  meet: MeetInfo;
  date: string;
  operatorCode?: string;
}

/** Mats in natural order: "1" < "2" < "10". */
const natural = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const sortMats = (mats: Iterable<string>) => [...new Set(mats)].sort((a, b) => natural.compare(a, b) || (a < b ? -1 : 1));

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 32 symbols, no l/o/0/1
const WEAK_PARTS = ["password", "passw0rd", "qwerty", "letmein", "123456", "abcdef", "judgey", "cheer"];

/**
 * A fresh operator code: 20 random base32 symbols (100 bits) in groups of five,
 * e.g. "k7m2q-xh9ra-4tpwz-c3ndv". Brute force is hopeless no matter how many
 * anonymous identities an attacker mints (claim_operator's 10-try cap is per identity).
 */
export function generateOperatorCode(bytes: (n: number) => Uint8Array = randomBytes): string {
  const raw = bytes(20);
  let code = "";
  for (let i = 0; i < 20; i++) code += (i > 0 && i % 5 === 0 ? "-" : "") + CODE_ALPHABET[raw[i] & 31];
  return code;
}

/** Why a supplied operator code is too weak to protect a meet, or null if it is fine. */
export function operatorCodeWeakness(code: string, meet?: Pick<MeetInfo, "id" | "name">): string | null {
  if (code.length < MIN_OPERATOR_CODE) {
    return `must be at least ${MIN_OPERATOR_CODE} characters (anyone with throwaway identities can guess a short one)`;
  }
  if (/\s/.test(code)) return "must not contain spaces (it goes in a URL)";
  const lower = code.toLowerCase();
  if (new Set(lower).size < 8) return "is too repetitive (fewer than 8 different characters)";
  const part = WEAK_PARTS.find((w) => lower.includes(w));
  if (part) return `contains the guessable "${part}"`;
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const meetWords = [meet?.id ?? "", meet?.name ?? ""].map(squash).filter((w) => w.length >= 4);
  if (meetWords.some((w) => squash(code).includes(w))) return "contains the meet id or name";
  return null;
}

function checkMeet(meet: MeetInfo, operatorCode: string | undefined, errors: string[]): void {
  if (!MEET_ID.test(meet.id)) errors.push(`--meet "${meet.id}" must match ${MEET_ID} (lowercase letters, digits, '-')`);
  if (!meet.name.trim()) errors.push("--name is required");
  if (!isValidTimeZone(meet.timeZone)) errors.push(`--tz "${meet.timeZone}" is not an IANA time zone`);
  if (meet.minTaps !== undefined && !(Number.isInteger(meet.minTaps) && meet.minTaps >= 2 && meet.minTaps <= 5)) {
    errors.push("--min-taps must be an integer from 2 to 5");
  }
  if (operatorCode !== undefined) {
    const weak = operatorCodeWeakness(operatorCode, meet);
    if (weak) errors.push(`--operator-code ${weak}; omit it and pass --operator to generate a strong one`);
  }
  const text = [meet.id, meet.name, meet.venue ?? "", meet.city ?? "", operatorCode ?? ""].join("");
  if (text.includes("\u0000")) errors.push("arguments must not contain NUL characters");
}

function summarize(plan: ImportPlan, extra: string[] = []): string[] {
  const { meet, routines } = plan;
  const live = routines.filter((r) => r.status === "scheduled");
  const out = [
    `Meet ${meet.id} "${meet.name}" (${meet.timeZone}): ${live.length} routines on ${plan.mats.length} mat(s)` +
      (meet.minTaps ? `, min taps ${meet.minTaps}` : ""),
  ];
  for (const mat of plan.mats) {
    const onMat = live.filter((r) => r.mat === mat).sort((a, b) => a.scheduledAt - b.scheduledAt);
    if (onMat.length === 0) continue;
    const [first, last] = [onMat[0], onMat[onMat.length - 1]];
    out.push(
      `  Mat ${mat}: ${onMat.length} routines, ${localTime(first.scheduledAt, meet.timeZone)} – ${localTime(last.scheduledAt, meet.timeZone)}`,
    );
  }
  const divisions = new Map<string, number>();
  for (const r of live) divisions.set(r.division, (divisions.get(r.division) ?? 0) + 1);
  out.push(`  Divisions: ${[...divisions].map(([d, n]) => `${d} (${n})`).join(", ")}`);
  out.push(
    "  Re-import note: every routine listed here becomes 'scheduled' again, even one an operator scratched today. " +
      "psql prints a NOTICE naming them; re-scratch them in the app or remove them from the CSV first.",
  );
  return out.concat(extra);
}

interface Seen {
  text: string;
  line: number;
}
/** Trim and collapse runs of whitespace (incl. NBSP) to one space. */
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
/** Case- and spacing-insensitive key for spotting near-duplicate spellings. */
const fold = (s: string) => collapse(s).toLowerCase();
/** "Mat 1" / "MAT  1" / "mat1" → "1" (the app prints "Mat" itself). */
export const matLabel = (s: string) => collapse(s).replace(/^mat(?![a-z])\s*/i, "");

/** Running-order CSV (mat,time,gym,team,division[,team_id]) → validated plan. */
export function planFromCsv(text: string, opts: CsvOptions): PlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  checkMeet(opts.meet, opts.operatorCode, errors);
  const date = parseDate(opts.date);
  if (!date) errors.push(`--date "${opts.date}" must be a real date like 2026-12-05`);
  if (text.includes("\u0000")) errors.push("the CSV contains NUL characters");

  const csv = parseCsv(text);
  if (csv.error) return { errors: [...errors, csv.error], warnings, summary: [] };
  if (csv.rows.length === 0) return { errors: [...errors, "the CSV is empty"], warnings, summary: [] };
  const header = csv.rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (name: string) => header.indexOf(name);
  const missing = REQUIRED.filter((name) => col(name) < 0);
  if (missing.length) {
    errors.push(`line ${csv.lines[0]}: header must name the columns mat,time,gym,team,division[,team_id]; missing ${missing.join(", ")}`);
    return { errors, warnings, summary: [] };
  }
  if (errors.length && (!date || !isValidTimeZone(opts.meet.timeZone))) return { errors, warnings, summary: [] };

  const idCol = col("team_id");
  const body = csv.rows.slice(1);
  const given = new Map<string, number>(); // id → line
  for (const [k, row] of body.entries()) {
    const id = idCol >= 0 ? (row[idCol] ?? "") : "";
    if (id === "") continue;
    const line = csv.lines[k + 1];
    if (!TEAM_ID.test(id)) errors.push(`line ${line}: team_id "${id}" must match ${TEAM_ID}`);
    else if (given.has(id)) errors.push(`line ${line}: duplicate team_id "${id}" (also line ${given.get(id)})`);
    else given.set(id, line);
  }

  const taken = new Set(given.keys());
  const routines: PlannedRoutine[] = [];
  const ids: string[] = [];
  const lastOnMat = new Map<string, { at: number; line: number }>();
  const spellings = { mat: new Map<string, Seen>(), division: new Map<string, Seen>() };
  const teamsSeen = new Map<string, Seen>();
  let generated = 0;
  for (const [k, row] of body.entries()) {
    const line = csv.lines[k + 1];
    if (row.length > header.length && row.slice(header.length).some((f) => f !== "")) {
      errors.push(`line ${line}: ${row.length} fields but the header has ${header.length}`);
      ids.push("");
      continue;
    }
    const raw = (name: string) => row[col(name)] ?? "";
    const multiline = REQUIRED.filter((name) => /[\r\n]/.test(raw(name)));
    if (multiline.length) {
      errors.push(`line ${line}: ${multiline.join(", ")} must not contain a line break (a stray quote?)`);
      ids.push("");
      continue;
    }
    const time = raw("time").trim();
    const [gym, team, division] = (["gym", "team", "division"] as const).map((name) => collapse(raw(name)));
    const mat = matLabel(raw("mat"));
    const blank = REQUIRED.filter((name) => collapse(raw(name)) === "");
    if (blank.length) {
      errors.push(`line ${line}: empty ${blank.join(", ")}`);
      ids.push("");
      continue;
    }
    if (mat === "") errors.push(`line ${line}: mat "${collapse(raw("mat"))}" has no label after dropping "Mat" (use 1, 2, A…)`);
    if (mat.length > MAX_MAT) errors.push(`line ${line}: mat "${mat}" is longer than ${MAX_MAT} characters`);
    for (const [name, value] of [["gym", gym], ["team", team], ["division", division]] as const) {
      if (value.length > MAX_TEXT) errors.push(`line ${line}: ${name} is longer than ${MAX_TEXT} characters ("${value.slice(0, 24)}…")`);
    }
    for (const [name, value] of [["mat", mat], ["division", division]] as const) {
      if (value === "") continue;
      const key = fold(value);
      const seen = spellings[name].get(key);
      if (!seen) spellings[name].set(key, { text: value, line });
      else if (seen.text !== value) {
        errors.push(`line ${line}: ${name} "${value}" differs only in case/spacing from "${seen.text}" (line ${seen.line}); pick one spelling`);
      }
    }
    const teamKey = `${fold(gym)}\u0000${fold(team)}`;
    const dup = teamsSeen.get(teamKey);
    if (dup) warnings.push(`line ${line}: ${gym} ${team} is also on line ${dup.line} (fine if they compete twice; otherwise a duplicate row)`);
    else teamsSeen.set(teamKey, { text: team, line });
    let teamId = idCol >= 0 ? (row[idCol] ?? "").trim() : "";
    if (teamId === "") {
      teamId = uniqueId(slugify(`${gym} ${team}`), taken);
      taken.add(teamId);
      generated++;
    }
    ids.push(teamId);

    const minutes = parseTime(time);
    if (minutes === null) {
      errors.push(`line ${line}: time "${time}" is not like 9:04 AM or 09:04`);
      continue;
    }
    if (minutes < EARLIEST || minutes > LATEST) {
      errors.push(`line ${line}: ${time} is outside 6:00 AM – 10:00 PM (AM/PM typo?)`);
    }
    if (!date) continue;
    let scheduledAt: number;
    try {
      scheduledAt = zonedTimeToUtc(date[0], date[1], date[2], minutes, opts.meet.timeZone);
    } catch (err) {
      errors.push(`line ${line}: ${(err as Error).message}`);
      continue;
    }
    const prev = lastOnMat.get(mat);
    if (prev && scheduledAt <= prev.at) {
      errors.push(`line ${line}: mat ${mat} time ${time} is not after line ${prev.line} (times must increase within a mat)`);
    }
    lastOnMat.set(mat, { at: scheduledAt, line });
    routines.push({ teamId, teamName: team, gym, division, mat, scheduledAt, status: "scheduled" });
  }
  if (body.length === 0) errors.push("the CSV has a header but no routines");

  let csvWithIds: string | undefined;
  if (generated > 0) {
    warnings.push(`${generated} team id(s) generated from gym + team; run with --write-ids to keep them stable across revisions`);
    const out = csv.rows.map((r) => [...r]);
    const at = idCol >= 0 ? idCol : header.length;
    if (idCol < 0) out[0][at] = "team_id";
    body.forEach((_, k) => {
      const r = out[k + 1];
      while (r.length < at) r.push("");
      r[at] = ids[k] ?? "";
    });
    csvWithIds = toCsv(out, { bom: csv.bom, eol: csv.eol });
  }

  if (errors.length) return { errors, warnings, summary: [] };
  const plan: ImportPlan = {
    meet: opts.meet,
    mats: sortMats(routines.map((r) => r.mat)),
    startsAt: Math.min(...routines.map((r) => r.scheduledAt)),
    routines,
    operatorCode: opts.operatorCode,
  };
  return { plan, errors, warnings, summary: summarize(plan), csvWithIds };
}

/** The demo roster (src/demo/meet.ts) shifted so its first routine is at `startIso`. */
export function planFromDemo(
  demo: Meet,
  startIso: string,
  opts: { meet: Partial<MeetInfo>; operatorCode?: string },
): PlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const start = parseIsoWithOffset(startIso);
  if (start === null) {
    errors.push(
      `--start "${startIso}" needs a full ISO time WITH an explicit offset, like 2026-11-15T09:00-05:00 or 2026-11-15T14:00Z (refusing to guess a time zone)`,
    );
  }
  const meet: MeetInfo = {
    id: opts.meet.id ?? demo.id,
    name: opts.meet.name ?? demo.name,
    timeZone: opts.meet.timeZone ?? demo.timeZone,
    venue: opts.meet.venue ?? demo.venue,
    city: opts.meet.city ?? demo.city,
    minTaps: opts.meet.minTaps ?? demo.minTaps,
  };
  checkMeet(meet, opts.operatorCode, errors);
  if (errors.length || start === null) return { errors, warnings, summary: [] };

  const shift = start - Math.min(...demo.slots.map((s) => s.scheduledAt));
  const team = new Map(demo.teams.map((t) => [t.id, t]));
  const routines: PlannedRoutine[] = demo.slots.map((s) => {
    const t = team.get(s.teamId)!;
    return {
      teamId: s.teamId,
      teamName: t.name,
      gym: t.gym,
      division: t.division,
      mat: s.mat,
      scheduledAt: s.scheduledAt + shift,
      status: s.status ?? "scheduled",
    };
  });
  const parts = partsFormatter(meet.timeZone);
  for (const r of routines) {
    const p = Object.fromEntries(parts.formatToParts(r.scheduledAt).map((x) => [x.type, Number(x.value)]));
    const minutes = p.hour * 60 + p.minute;
    if (minutes < EARLIEST || minutes > LATEST) {
      warnings.push(`practice meet runs outside 6:00 AM – 10:00 PM ${meet.timeZone} (fine for a demo)`);
      break;
    }
  }
  const plan: ImportPlan = {
    meet,
    mats: sortMats(demo.mats.concat(routines.map((r) => r.mat))),
    startsAt: start,
    routines,
    operatorCode: opts.operatorCode,
  };
  return { plan, errors, warnings, summary: summarize(plan) };
}

// ---------------------------------------------------------------------------
// SQL

/** A SQL string literal (standard_conforming_strings is forced on below). */
export const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sqlTime = (ms: number) => `timestamptz ${sqlString(new Date(ms).toISOString())}`;
const sqlArray = (xs: string[]) => `array[${xs.map(sqlString).join(", ")}]::text[]`;

/**
 * Idempotent SQL for a plan, in one transaction: upsert the meet (bumping
 * schedule_version so phones refetch), upsert every routine, scratch (never
 * delete) routines that are no longer listed, and optionally set the operator code.
 */
export function emitSql(plan: ImportPlan, generatedAt = new Date()): string {
  const { meet } = plan;
  const id = sqlString(meet.id);
  const cols = ["id", "name", "time_zone", "starts_at", "mats"];
  const vals = [id, sqlString(meet.name), sqlString(meet.timeZone), sqlTime(plan.startsAt), sqlArray(plan.mats)];
  const updates = ["name", "time_zone", "starts_at", "mats"];
  const optional: Array<[string, string | undefined]> = [
    ["venue", meet.venue === undefined ? undefined : sqlString(meet.venue)],
    ["city", meet.city === undefined ? undefined : sqlString(meet.city)],
    ["min_taps", meet.minTaps === undefined ? undefined : String(meet.minTaps)],
  ];
  for (const [col, val] of optional) {
    if (val === undefined) continue;
    cols.push(col);
    vals.push(val);
    updates.push(col);
  }
  const routines = plan.routines.map(
    (r) =>
      `  (${[id, sqlString(r.teamId), sqlString(r.teamName), sqlString(r.gym), sqlString(r.division), sqlString(r.mat), sqlTime(r.scheduledAt), sqlString(r.status)].join(", ")})`,
  );
  const out = [
    `-- Generated by scripts/import-meet.ts at ${generatedAt.toISOString()}. Do not edit: re-run the import.`,
    `-- Meet ${meet.id}: ${plan.routines.length} routines on mats ${plan.mats.join(", ")}. Safe to apply more than once.`,
    "begin;",
    "set local standard_conforming_strings = on;",
    "",
    `insert into public.meets (${cols.join(", ")})`,
    `values (${vals.join(", ")})`,
    "on conflict (id) do update set",
    ...updates.map((c) => `  ${c} = excluded.${c},`),
    "  schedule_version = public.meets.schedule_version + 1;",
    "",
    "-- CSV is the truth: a listed routine becomes 'scheduled' again, even one an operator",
    "-- scratched today. Name those out loud so the producer can re-scratch them.",
    "do $judgey$",
    "declare t text;",
    "begin",
    "  select string_agg(team_id, ', ' order by team_id) into t from public.routines",
    `  where meet_id = ${id} and status = 'scratched'`,
    `    and team_id = any (${sqlArray(plan.routines.filter((r) => r.status === "scheduled").map((r) => r.teamId))});`,
    "  if t is not null then",
    "    raise notice 'Re-import UN-SCRATCHES: % (scratch them again in the app, or remove them from the CSV and re-import)', t;",
    "  end if;",
    "end",
    "$judgey$;",
    "",
    "insert into public.routines (meet_id, team_id, team_name, gym, division, mat, scheduled_at, status) values",
    routines.join(",\n"),
    "on conflict (meet_id, team_id) do update set",
    "  team_name = excluded.team_name, gym = excluded.gym, division = excluded.division,",
    "  mat = excluded.mat, scheduled_at = excluded.scheduled_at, status = excluded.status;",
    "",
    "-- Routines no longer on the running order are scratched, never deleted (their taps and ballots stay).",
    "update public.routines set status = 'scratched'",
    `where meet_id = ${id} and status <> 'scratched'`,
    `  and team_id <> all (${sqlArray(plan.routines.map((r) => r.teamId))});`,
  ];
  if (plan.operatorCode !== undefined) {
    out.push(
      "",
      "-- Operator code: only a bcrypt hash is stored. Don't commit or share this file.",
      "insert into judgey_private.operator_codes (meet_id, code_hash)",
      `values (${id}, extensions.crypt(${sqlString(plan.operatorCode)}, extensions.gen_salt('bf')))`,
      "on conflict (meet_id) do update set code_hash = excluded.code_hash;",
    );
  }
  out.push("", "commit;", "");
  return out.join("\n");
}
