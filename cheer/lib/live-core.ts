// The pure half of live mode: everything about the Judgey RPCs (docs/backend-spec.md
// §6, §8) that can be decided without a network, a timer or React. RPC JSON ↔
// domain types, snapshot merging and schedule versions, the server clock offset,
// the freshness chip, tap-outbox decisions, my_state cadence and friendly copy
// for every reason code. lib/sources/live.ts does the wiring.
// Relative .ts imports so node:test can load this file directly.

import { MINUTE, RULES, SECOND } from "../src/rules.ts";
import { formatClock } from "../src/format.ts";
import type { MeetBoard, Recap } from "../src/results.ts";
import type { Starts, TapRejection } from "../src/schedule.ts";
import { AWARDS, type Award, type Meet, type RoutineStatus, type Timestamp } from "../src/types.ts";
import { BALLOT_MESSAGES, ballotDeadline, type BallotError, type BallotReason } from "../src/voting.ts";

// --- RPC JSON (camelCase, times in epoch ms) --------------------------------

export interface MeetJson {
  id: string;
  name: string;
  venue: string;
  city: string;
  timeZone: string;
  startsAt: Timestamp;
  mats: string[];
  minTaps: number;
}
export interface RoutineJson {
  teamId: string;
  teamName: string;
  gym: string;
  division: string;
  mat: string;
  scheduledAt: Timestamp;
  status: RoutineStatus;
}
export interface ScheduleJson {
  meet: MeetJson;
  routines: RoutineJson[];
}
export interface StartJson {
  teamId: string;
  startedAt: Timestamp;
  source: "crowd" | "operator";
}
export interface SnapshotJson {
  serverNow: Timestamp;
  meetId: string;
  scheduleVersion: number;
  /** Only when the caller's p_have_version is stale. */
  schedule: ScheduleJson | null;
  starts: StartJson[];
  board: MeetBoard;
}
export interface FanJson {
  homeTeamIds: string[];
  everHomeTeamIds: string[];
}
export interface MyBallot {
  stars: number;
  awards: Award[];
}
export interface MyStateJson {
  serverNow: Timestamp;
  fan: FanJson | null;
  tappedTeamIds: string[];
  ballots: Array<MyBallot & { teamId: string }>;
  recaps: Recap[];
  isOperator: boolean;
}
export type CheckInReason = "too-many" | "unknown-team" | "unknown-meet";
export type CheckInResult =
  | { ok: true; fan: FanJson; removedBallotTeamIds: string[] }
  | { ok: false; reason: CheckInReason };
export type TapReason = TapRejection | "already-confirmed";
export interface TapResult {
  ok: boolean;
  reason?: TapReason;
  confirmed: boolean;
  startedAt?: Timestamp;
}
export interface BallotResult {
  ok: boolean;
  reason?: BallotReason;
}
export type OperatorReason = "bad-code" | "locked" | "unknown-meet" | "not-operator" | "unknown-team" | "invalid";
export interface OperatorResult {
  ok: boolean;
  reason?: OperatorReason;
}

// --- Parsing (network responses and the localStorage cache are untrusted) ---

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isInt = (x: unknown): x is number => Number.isSafeInteger(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr);

class BadJson extends Error {}
function need<T>(ok: boolean, value: T, what: string): T {
  if (!ok) throw new BadJson(`bad ${what}`);
  return value;
}
const str = (o: Json, k: string) => need(isStr(o[k]), o[k] as string, k);
const int = (o: Json, k: string) => need(isInt(o[k]), o[k] as number, k);
const strs = (o: Json, k: string) => need(isStrArr(o[k]), [...(o[k] as string[])], k);
const obj = (x: unknown, what: string) => need(isObj(x), x as Json, what);
const arr = (x: unknown, what: string) => need(Array.isArray(x), x as unknown[], what);

function parseAwards(x: unknown): Award[] {
  return arr(x, "awards").filter((a): a is Award => (AWARDS as readonly unknown[]).includes(a));
}

const EMPTY_AWARDS = () => Object.fromEntries(AWARDS.map((a) => [a, null])) as Record<Award, string | null>;

export const EMPTY_BOARD: MeetBoard = {
  top: [],
  awards: EMPTY_AWARDS(),
  revealedDivisions: [],
  pendingDivisions: [],
};

export function parseBoard(x: unknown): MeetBoard {
  const b = obj(x, "board");
  const awards = EMPTY_AWARDS();
  const raw = isObj(b.awards) ? b.awards : {};
  for (const a of AWARDS) if (isStr(raw[a])) awards[a] = raw[a];
  return {
    top: arr(b.top, "top").map((e) => {
      const o = obj(e, "entry");
      const rating = need(typeof o.rating === "number", o.rating as number, "rating");
      return { teamId: str(o, "teamId"), votes: int(o, "votes"), rating };
    }),
    awards,
    revealedDivisions: strs(b, "revealedDivisions"),
    pendingDivisions: strs(b, "pendingDivisions"),
  };
}

function parseRecap(x: unknown): Recap {
  const o = obj(x, "recap");
  const awards: Partial<Record<Award, number>> = {};
  const raw = isObj(o.awards) ? o.awards : {};
  for (const a of AWARDS) if (isInt(raw[a]) && (raw[a] as number) > 0) awards[a] = raw[a] as number;
  return {
    teamId: str(o, "teamId"),
    votes: o.votes === null || o.votes === undefined ? null : int(o, "votes"),
    awards,
    rank: o.rank === null || o.rank === undefined ? null : int(o, "rank"),
  };
}

function parseSchedule(x: unknown): ScheduleJson {
  const s = obj(x, "schedule");
  const m = obj(s.meet, "meet");
  return {
    meet: {
      id: str(m, "id"),
      name: str(m, "name"),
      venue: str(m, "venue"),
      city: str(m, "city"),
      timeZone: str(m, "timeZone"),
      startsAt: int(m, "startsAt"),
      mats: strs(m, "mats"),
      minTaps: isInt(m.minTaps) ? m.minTaps : RULES.minTaps,
    },
    routines: arr(s.routines, "routines").map((x) => {
      const r = obj(x, "routine");
      return {
        teamId: str(r, "teamId"),
        teamName: str(r, "teamName"),
        gym: str(r, "gym"),
        division: str(r, "division"),
        mat: str(r, "mat"),
        scheduledAt: int(r, "scheduledAt"),
        status: r.status === "scratched" ? "scratched" : "scheduled",
      };
    }),
  };
}

/** meet_snapshot → typed JSON. null = unknown meet. Throws on a malformed payload. */
export function parseSnapshot(x: unknown): SnapshotJson | null {
  if (x === null) return null;
  const o = obj(x, "snapshot");
  return {
    serverNow: int(o, "serverNow"),
    meetId: str(o, "meetId"),
    scheduleVersion: int(o, "scheduleVersion"),
    schedule: o.schedule === null || o.schedule === undefined ? null : parseSchedule(o.schedule),
    starts: arr(o.starts, "starts").map((x) => {
      const s = obj(x, "start");
      const source = s.source === "operator" ? "operator" : "crowd";
      return { teamId: str(s, "teamId"), startedAt: int(s, "startedAt"), source };
    }),
    board: parseBoard(o.board),
  };
}

function parseFan(x: unknown): FanJson | null {
  if (x === null || x === undefined) return null;
  const f = obj(x, "fan");
  return { homeTeamIds: strs(f, "homeTeamIds"), everHomeTeamIds: strs(f, "everHomeTeamIds") };
}

export function parseMyState(x: unknown): MyStateJson {
  const o = obj(x, "my_state");
  return {
    serverNow: int(o, "serverNow"),
    fan: parseFan(o.fan),
    tappedTeamIds: strs(o, "tappedTeamIds"),
    ballots: arr(o.ballots, "ballots").map((x) => {
      const b = obj(x, "ballot");
      return { teamId: str(b, "teamId"), stars: int(b, "stars"), awards: parseAwards(b.awards) };
    }),
    recaps: arr(o.recaps, "recaps").map(parseRecap),
    isOperator: o.isOperator === true,
  };
}

const reasonOf = <R extends string>(o: Json, known: readonly R[], fallback: R): R =>
  (known as readonly unknown[]).includes(o.reason) ? (o.reason as R) : fallback;

const CHECK_IN_REASONS = ["too-many", "unknown-team", "unknown-meet"] as const;
const TAP_REASONS = ["unknown-team", "scratched", "too-early", "not-next", "too-soon", "already-confirmed"] as const;
const BALLOT_REASONS = ["not-checked-in", "own-team", "window-closed", "already-voted", "invalid"] as const;
const OPERATOR_REASONS = ["bad-code", "locked", "unknown-meet", "not-operator", "unknown-team", "invalid"] as const;

export function parseCheckIn(x: unknown): CheckInResult {
  const o = obj(x, "check_in");
  if (o.ok !== true) return { ok: false, reason: reasonOf(o, CHECK_IN_REASONS, "unknown-team") };
  const fan = parseFan(o.fan) ?? { homeTeamIds: [], everHomeTeamIds: [] };
  return { ok: true, fan, removedBallotTeamIds: strs(o, "removedBallotTeamIds") };
}

export function parseTap(x: unknown): TapResult {
  const o = obj(x, "tap_mat");
  return {
    ok: o.ok === true,
    reason: o.ok === true ? undefined : reasonOf(o, TAP_REASONS, "not-next"),
    confirmed: o.confirmed === true,
    startedAt: isInt(o.startedAt) ? o.startedAt : undefined,
  };
}

export function parseBallot(x: unknown): BallotResult {
  const o = obj(x, "cast_ballot");
  return o.ok === true ? { ok: true } : { ok: false, reason: reasonOf(o, BALLOT_REASONS, "invalid") };
}

export function parseOperator(x: unknown): OperatorResult {
  const o = obj(x, "operator");
  return o.ok === true ? { ok: true } : { ok: false, reason: reasonOf(o, OPERATOR_REASONS, "invalid") };
}

// --- RPC JSON → domain --------------------------------------------------------

export function meetFromSchedule({ meet, routines }: ScheduleJson): Meet {
  return {
    id: meet.id,
    name: meet.name,
    venue: meet.venue,
    city: meet.city,
    timeZone: meet.timeZone,
    startsAt: meet.startsAt,
    mats: [...meet.mats],
    minTaps: meet.minTaps,
    teams: routines.map((r) => ({ id: r.teamId, name: r.teamName, gym: r.gym, division: r.division })),
    slots: routines.map((r) => ({ teamId: r.teamId, mat: r.mat, scheduledAt: r.scheduledAt, status: r.status })),
  };
}

export const startsFromJson = (list: StartJson[]): Starts => new Map(list.map((s) => [s.teamId, s.startedAt]));

// --- Live data: snapshot + my state, merged ---------------------------------

/** What this device knows about the caller at this meet (from my_state, plus optimistic updates). */
export interface MyState {
  fan: FanJson | null;
  tappedTeamIds: string[];
  ballots: Array<MyBallot & { teamId: string }>;
  recaps: Recap[];
  isOperator: boolean;
}

export interface LiveData {
  meetId: string;
  /** schedule_version of `meet`; 0 = no schedule yet. */
  scheduleVersion: number;
  meet: Meet | null;
  starts: Starts;
  board: MeetBoard;
  /** serverNow of the snapshot applied last: older responses are ignored. */
  asOf: Timestamp;
  /** Device time of the last successful snapshot (0 = never). */
  fetchedAt: Timestamp;
  my: MyState | null;
  myAsOf: Timestamp;
  /** Server clock − device clock, ms. */
  offset: number;
}

export const emptyData = (meetId: string): LiveData => ({
  meetId,
  scheduleVersion: 0,
  meet: null,
  starts: new Map(),
  board: EMPTY_BOARD,
  asOf: 0,
  fetchedAt: 0,
  my: null,
  myAsOf: 0,
  offset: 0,
});

/** p_have_version for the next meet_snapshot: 0 asks for the schedule. */
export const haveVersion = (data: LiveData): number => (data.meet ? data.scheduleVersion : 0);

/**
 * Merge one meet_snapshot. Out-of-order (older) responses are dropped. The
 * schedule is replaced when it comes along; when the server's version moved
 * but no schedule came with it, keep the old one and ask again with version 0.
 */
export function applySnapshot(
  prev: LiveData,
  snap: SnapshotJson,
  receivedAt: Timestamp,
): { data: LiveData; needsSchedule: boolean } {
  if (snap.meetId !== prev.meetId || snap.serverNow < prev.asOf) return { data: prev, needsSchedule: false };
  const fresh = snap.schedule !== null;
  const data: LiveData = {
    ...prev,
    meet: fresh ? meetFromSchedule(snap.schedule!) : prev.meet,
    scheduleVersion: fresh ? snap.scheduleVersion : prev.scheduleVersion,
    starts: startsFromJson(snap.starts),
    board: snap.board,
    asOf: snap.serverNow,
    fetchedAt: receivedAt,
  };
  return { data, needsSchedule: !fresh && (!prev.meet || prev.scheduleVersion !== snap.scheduleVersion) };
}

const myFromJson = (j: MyStateJson): MyState => ({
  fan: j.fan,
  tappedTeamIds: j.tappedTeamIds,
  ballots: j.ballots,
  recaps: j.recaps,
  isOperator: j.isOperator,
});

export function applyMyState(prev: LiveData, my: MyStateJson): LiveData {
  if (my.serverNow < prev.myAsOf) return prev;
  return { ...prev, my: myFromJson(my), myAsOf: my.serverNow };
}

const EMPTY_MY: MyState = { fan: null, tappedTeamIds: [], ballots: [], recaps: [], isOperator: false };

/** Optimistic: a ballot the server just accepted. */
export function withBallot(prev: LiveData, teamId: string, ballot: MyBallot): LiveData {
  const my = prev.my ?? EMPTY_MY;
  if (my.ballots.some((b) => b.teamId === teamId)) return prev;
  return { ...prev, my: { ...my, ballots: [...my.ballots, { teamId, ...ballot }] } };
}

/** Optimistic: a tap the server just accepted. */
export function withTap(prev: LiveData, teamId: string): LiveData {
  const my = prev.my ?? EMPTY_MY;
  if (my.tappedTeamIds.includes(teamId)) return prev;
  return { ...prev, my: { ...my, tappedTeamIds: [...my.tappedTeamIds, teamId] } };
}

/** check_in succeeded: new fan row; ballots for newly followed teams are gone. */
export function withCheckIn(prev: LiveData, fan: FanJson, removedBallotTeamIds: string[]): LiveData {
  const my = prev.my ?? EMPTY_MY;
  const gone = new Set(removedBallotTeamIds);
  return { ...prev, my: { ...my, fan, ballots: my.ballots.filter((b) => !gone.has(b.teamId)) } };
}

// --- localStorage cache: judgey_live_<meetId> --------------------------------

export const cacheKey = (meetId: string) => `judgey_live_${meetId}`;
const CACHE_VERSION = 1;

export function serializeCache(data: LiveData): string {
  return JSON.stringify({ v: CACHE_VERSION, ...data, starts: [...data.starts] });
}

/** The cached LiveData for this meet, or null if missing, foreign or corrupt. */
export function parseCache(raw: string | null, meetId: string): LiveData | null {
  if (!raw) return null;
  try {
    const o = obj(JSON.parse(raw), "cache");
    if (o.v !== CACHE_VERSION || o.meetId !== meetId) return null;
    const starts = arr(o.starts, "starts").map((e) => {
      const pair = arr(e, "start");
      return need(isStr(pair[0]) && isInt(pair[1]), [pair[0], pair[1]] as [string, number], "start");
    });
    const meet = o.meet === null ? null : (obj(o.meet, "meet") as unknown as Meet);
    if (meet && !(Array.isArray(meet.slots) && Array.isArray(meet.teams) && Array.isArray(meet.mats))) return null;
    const my =
      o.my === null || o.my === undefined ? null : myFromJson(parseMyState({ ...obj(o.my, "my"), serverNow: 0 }));
    return {
      meetId,
      scheduleVersion: meet ? int(o, "scheduleVersion") : 0,
      meet,
      starts: new Map(starts),
      board: parseBoard(o.board),
      asOf: int(o, "asOf"),
      fetchedAt: int(o, "fetchedAt"),
      my,
      myAsOf: int(o, "myAsOf"),
      offset: int(o, "offset"),
    };
  } catch {
    return null;
  }
}

// --- Server clock --------------------------------------------------------------

export interface ClockSample {
  offset: number;
  rtt: number;
}

/** offset = serverNow − (sent + received) / 2, i.e. assume the server answered mid-flight. */
export function clockSample(serverNow: Timestamp, sentAt: Timestamp, receivedAt: Timestamp): ClockSample {
  return { offset: Math.round(serverNow - (sentAt + receivedAt) / 2), rtt: Math.max(0, receivedAt - sentAt) };
}

/** Keep the last few samples; the one with the shortest round trip is the most trustworthy. */
export function addClockSample(samples: ClockSample[], sample: ClockSample, keep = 5): ClockSample[] {
  return [...samples, sample].slice(-keep);
}

export function clockOffset(samples: ClockSample[], fallback: number): number {
  if (samples.length === 0) return fallback;
  return samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
}

// --- Freshness chip -----------------------------------------------------------

export const LIVE_FRESH_MS = 30 * SECOND;

export type Freshness =
  | { kind: "demo" }
  | { kind: "connecting" }
  | { kind: "live" }
  | { kind: "updated"; at: Timestamp }
  | { kind: "offline"; at: Timestamp | null };

/**
 * "Live" while the last good snapshot is under 30 s old; after that "Updated
 * h:mm", or "Offline" if the latest attempt failed. Times are device time.
 */
export function freshness(lastSuccessAt: Timestamp, lastFailureAt: Timestamp, realNow: Timestamp): Freshness {
  if (lastSuccessAt > 0 && realNow - lastSuccessAt < LIVE_FRESH_MS) return { kind: "live" };
  if (lastFailureAt > lastSuccessAt) return { kind: "offline", at: lastSuccessAt || null };
  if (lastSuccessAt === 0) return { kind: "connecting" };
  return { kind: "updated", at: lastSuccessAt };
}

export function freshnessLabel(f: Freshness, timeZone: string, offset = 0): string {
  switch (f.kind) {
    case "demo":
      return "Demo";
    case "connecting":
      return "Connecting…";
    case "live":
      return "Live";
    case "updated":
      return `Updated ${formatClock(f.at + offset, timeZone)}`;
    case "offline":
      return "Offline · last known times";
  }
}

// --- Polling and backoff ------------------------------------------------------

export const POLL_MS = 15 * SECOND;
export const POLL_JITTER_MS = 3 * SECOND;
export const MY_STATE_EVERY_MS = 60 * SECOND;

/** 15 s ± 3 s, so 500 phones don't poll in lockstep. `random` ∈ [0, 1). */
export const pollDelay = (random: number): number => POLL_MS + Math.round((2 * random - 1) * POLL_JITTER_MS);

/** Exponential backoff with jitter: half the step fixed, half random, capped. */
export function backoffDelay(attempt: number, random: number, baseMs = SECOND, capMs = 30 * SECOND): number {
  const step = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(step / 2 + random * (step / 2));
}

/** A 429 from Supabase Auth: the client's fetch rejects these so auth-js retries instead of dropping the session. */
export function isAuthRateLimit(url: string, status: number): boolean {
  if (status !== 429) return false;
  try {
    return new URL(url).pathname.includes("/auth/v1/");
  } catch {
    return false;
  }
}

/** Server time of the next moment one of these teams' voting closes for good (recaps change then). */
export function nextHomeClose(starts: Starts, homeTeamIds: string[], now: Timestamp): Timestamp | undefined {
  let next: Timestamp | undefined;
  for (const id of homeTeamIds) {
    const start = starts.get(id);
    if (start === undefined) continue;
    const closedAt = ballotDeadline(start) + 1; // closed once start + window + grace < now
    if (closedAt > now && (next === undefined || closedAt < next)) next = closedAt;
  }
  return next;
}

/** ms until my_state is due: every 60 s, and right after a home team's window closes (device time). */
export function myStateDelay(lastAt: Timestamp, realNow: Timestamp, closeAtReal?: Timestamp): number {
  const regular = lastAt + MY_STATE_EVERY_MS - realNow;
  const close = closeAtReal === undefined ? Infinity : closeAtReal + SECOND - realNow;
  return Math.max(0, Math.min(regular, close));
}

export const TOUCH_AFTER_HIDDEN_MS = 15 * MINUTE;

/** touch() again when the app comes back after more than 15 min hidden. */
export const shouldTouchOnVisible = (hiddenAt: Timestamp | null, realNow: Timestamp): boolean =>
  hiddenAt !== null && realNow - hiddenAt > TOUCH_AFTER_HIDDEN_MS;

// --- Check-in (local-first) ---------------------------------------------------

/** The device's own pick for one live meet; written first, synced with check_in in the background. */
export interface LocalCheckIn {
  homeTeamIds: string[];
  /** Device time of the pick. */
  at: Timestamp;
  /** check_in succeeded with exactly these homeTeamIds. */
  synced: boolean;
}

export const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** What check_in gets: deduped, capped at maxHomeTeams, and (once the schedule is known) only teams still on it. */
export function checkInPayload(meet: Meet | null, homeTeamIds: string[]): string[] {
  const ids = [...new Set(homeTeamIds)];
  const live = meet && new Set(meet.slots.filter((s) => s.status !== "scratched").map((s) => s.teamId));
  return (live ? ids.filter((id) => live.has(id)) : ids).slice(0, RULES.maxHomeTeams);
}

/**
 * Does the server need to hear about this device's check-in? `fan` is my_state's
 * row: undefined = not known yet, null = none (e.g. a brand-new anonymous identity).
 */
export function needsCheckInSync(
  local: LocalCheckIn | undefined,
  fan: FanJson | null | undefined,
  meet: Meet | null,
): boolean {
  if (!local) return false;
  if (!local.synced || fan === null) return true;
  return fan !== undefined && !sameIds(checkInPayload(meet, local.homeTeamIds), fan.homeTeamIds);
}

// --- Tap outbox -----------------------------------------------------------------

/** A tap waiting to reach the server. tappedAt is device time. At most one per routine. */
export interface OutboxEntry {
  meetId: string;
  teamId: string;
  tappedAt: Timestamp;
}

export const OUTBOX_RETRY_MS = 5 * SECOND;
/** The server clamps a tap's age to maxTapAgeSeconds, so older taps are dropped instead. */
export const OUTBOX_MAX_AGE_MS = RULES.maxTapAgeSeconds * SECOND;

/** Add a tap; a second tap on the same routine keeps the first one's time. */
export function enqueueTap(outbox: OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  const dup = outbox.some((e) => e.meetId === entry.meetId && e.teamId === entry.teamId);
  return dup ? outbox : [...outbox, entry];
}

/** p_age_ms for this attempt: how long ago the fan actually tapped. */
export const tapAgeMs = (entry: OutboxEntry, realNow: Timestamp): number =>
  Math.max(0, Math.round(realNow - entry.tappedAt));

export const outboxAction = (entry: OutboxEntry, realNow: Timestamp): "send" | "drop" =>
  tapAgeMs(entry, realNow) > OUTBOX_MAX_AGE_MS ? "drop" : "send";

/** What the tap button shows for one routine. */
export type TapState = "sending" | "retrying" | "sent" | "failed";
export interface PendingTap {
  teamId: string;
  state: TapState;
  /** Why it failed (failed only). */
  message?: string;
  /** Device time of the last state change. */
  at: Timestamp;
}

/** Turn a tap_mat answer into a button state. A tap on an already-confirmed routine still counts as sent. */
export function tapOutcome(res: TapResult): { state: "sent" | "failed"; message?: string } {
  if (res.ok || res.reason === "already-confirmed") return { state: "sent" };
  return { state: "failed", message: TAP_MESSAGES[res.reason ?? "not-next"] };
}

// --- Friendly copy for every reason code ------------------------------------

export const OFFLINE_MESSAGE = "No signal right now. Try again in a moment.";
export const DROPPED_TAP_MESSAGE = "No signal for 2 minutes, so that tap was too old to count.";

export const TAP_MESSAGES: Record<TapReason, string> = {
  "unknown-team": "That team isn't on this running order.",
  scratched: "That routine was scratched.",
  "too-early": "Too early: that team isn't due on the mat for a while.",
  "not-next": "That team isn't up next on this mat.",
  "too-soon": "The last team only just started. Give it a moment.",
  "already-confirmed": "Already confirmed. Thanks!",
};

export const CHECK_IN_MESSAGES: Record<CheckInReason, string> = {
  "too-many": `Pick up to ${RULES.maxHomeTeams} teams.`,
  "unknown-team": "One of those teams isn't on the running order anymore.",
  "unknown-meet": "We couldn't find that meet.",
};

export const OPERATOR_MESSAGES: Record<OperatorReason, string> = {
  "bad-code": "That operator code didn't work.",
  locked: "Too many tries. Operator mode is locked on this phone.",
  "unknown-meet": "We couldn't find that meet.",
  "not-operator": "Operator mode isn't on for this phone.",
  "unknown-team": "That team isn't on this running order.",
  invalid: "That didn't work. Try again.",
};

export function ballotError(res: BallotResult): BallotError | null {
  if (res.ok) return null;
  const reason = res.reason ?? "invalid";
  return { reason, message: BALLOT_MESSAGES[reason] };
}

// --- Links ----------------------------------------------------------------------

const MEET_ID = /^[a-z0-9-]{3,64}$/;
const SRC = /^[a-z0-9-]{1,32}$/;

export const isMeetId = (s: string | null | undefined): s is string => !!s && MEET_ID.test(s);

/** First-touch src as the visits table accepts it, else null. */
export const cleanSrc = (s: string | null | undefined): string | null => (s && SRC.test(s) ? s : null);

/**
 * Which meet the check-in screen shows: a valid ?meet= wins (live meets need
 * live mode), then the meet this device picked before, then the demo.
 */
export function resolveMeetId(
  param: string | null,
  stored: string | null,
  liveEnabled: boolean,
  demoId: string,
): string {
  if (param === demoId) return demoId;
  if (isMeetId(param) && liveEnabled) return param;
  if (param !== null) return demoId;
  if (stored === demoId || (isMeetId(stored) && liveEnabled)) return stored;
  return demoId;
}

export const modeFor = (meetId: string | null, liveEnabled: boolean, demoId: string): "live" | "demo" =>
  liveEnabled && isMeetId(meetId) && meetId !== demoId ? "live" : "demo";

/** "Send to another parent": the same meet link, tagged so first-touch shows it was shared. */
export const shareUrl = (origin: string, meetId: string): string =>
  `${origin}/?meet=${encodeURIComponent(meetId)}&src=share`;
