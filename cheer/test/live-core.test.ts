import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addClockSample,
  applyMyState,
  applySnapshot,
  backoffDelay,
  ballotError,
  cacheKey,
  checkInPayload,
  cleanSrc,
  clockOffset,
  clockSample,
  emptyData,
  enqueueTap,
  freshness,
  freshnessLabel,
  haveVersion,
  isAuthRateLimit,
  meetFromSchedule,
  modeFor,
  myStateDelay,
  needsCheckInSync,
  nextHomeClose,
  OPERATOR_MESSAGES,
  OUTBOX_MAX_AGE_MS,
  outboxAction,
  parseBallot,
  parseCache,
  parseCheckIn,
  parseMyState,
  parseOperator,
  parseSnapshot,
  parseTap,
  pollDelay,
  resolveMeetId,
  serializeCache,
  shareUrl,
  shouldTouchOnVisible,
  tapAgeMs,
  TAP_MESSAGES,
  tapOutcome,
  withBallot,
  withCheckIn,
  withTap,
  type LiveData,
  type LocalCheckIn,
  type SnapshotJson,
} from "../lib/live-core.ts";
import { RULES } from "../src/rules.ts";
import { BALLOT_MESSAGES, OWN_TEAM_MESSAGE } from "../src/voting.ts";
import { MIN, SEC, T0 } from "./fixtures.ts";

const MEET = "test-meet";

/** A meet_snapshot payload as the RPC returns it (§6). */
function snapshotJson(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    serverNow: T0 + 10 * MIN,
    meetId: MEET,
    scheduleVersion: 3,
    schedule: {
      meet: {
        id: MEET,
        name: "Test Classic",
        venue: "Hall A",
        city: "Philadelphia, PA",
        timeZone: "America/New_York",
        startsAt: T0,
        mats: ["1", "2"],
        minTaps: 3,
      },
      routines: [
        { teamId: "a", teamName: "Aces", gym: "Gym A", division: "Youth", mat: "1", scheduledAt: T0, status: "scheduled" },
        { teamId: "b", teamName: "Bees", gym: "Gym B", division: "Youth", mat: "1", scheduledAt: T0 + 4 * MIN, status: "scratched" },
        { teamId: "c", teamName: "Cats", gym: "Gym C", division: "Junior", mat: "2", scheduledAt: T0 + 2 * MIN, status: "scheduled" },
      ],
    },
    starts: [{ teamId: "a", startedAt: T0 + 90 * SEC, source: "crowd" }],
    board: {
      top: [{ teamId: "a", votes: 12, rating: 4.3 }],
      awards: { stunts: "a", tumbling: null, spirit: null, dance: null },
      revealedDivisions: ["Youth"],
      pendingDivisions: ["Junior"],
    },
    ...over,
  };
}

const snap = (over: Record<string, unknown> = {}) => parseSnapshot(snapshotJson(over)) as SnapshotJson;

function myStateJson(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    serverNow: T0 + 11 * MIN,
    fan: { homeTeamIds: ["c"], everHomeTeamIds: ["a", "c"] },
    tappedTeamIds: ["a"],
    ballots: [{ teamId: "a", stars: 5, awards: ["stunts", "bogus"] }],
    recaps: [{ teamId: "c", votes: null, awards: { spirit: 3 }, rank: null }],
    isOperator: false,
    ...over,
  };
}

// --- RPC JSON → domain --------------------------------------------------------

test("parseSnapshot maps the schedule to a domain Meet (teams, slots, status, minTaps)", () => {
  const s = snap();
  const meet = meetFromSchedule(s.schedule!);
  assert.equal(meet.id, MEET);
  assert.equal(meet.minTaps, 3);
  assert.deepEqual(meet.mats, ["1", "2"]);
  assert.deepEqual(meet.teams[0], { id: "a", name: "Aces", gym: "Gym A", division: "Youth" });
  assert.deepEqual(meet.slots[1], { teamId: "b", mat: "1", scheduledAt: T0 + 4 * MIN, status: "scratched" });
  assert.deepEqual(s.starts, [{ teamId: "a", startedAt: T0 + 90 * SEC, source: "crowd" }]);
  assert.equal(s.board.top[0].rating, 4.3);
  assert.deepEqual(s.board.awards, { stunts: "a", tumbling: null, spirit: null, dance: null });
});

test("parseSnapshot: null is an unknown meet, malformed payloads throw, missing award keys become null", () => {
  assert.equal(parseSnapshot(null), null);
  assert.throws(() => parseSnapshot({ serverNow: "soon" }));
  assert.throws(() => parseSnapshot(snapshotJson({ starts: [{ teamId: "a", startedAt: 1.5 }] })));
  const s = snap({ schedule: null, board: { top: [], awards: { dance: "c" }, revealedDivisions: [], pendingDivisions: [] } });
  assert.equal(s.schedule, null);
  assert.deepEqual(s.board.awards, { stunts: null, tumbling: null, spirit: null, dance: "c" });
});

test("parseMyState keeps known awards only and hidden recap counts as null", () => {
  const my = parseMyState(myStateJson());
  assert.deepEqual(my.fan, { homeTeamIds: ["c"], everHomeTeamIds: ["a", "c"] });
  assert.deepEqual(my.ballots, [{ teamId: "a", stars: 5, awards: ["stunts"] }]);
  assert.deepEqual(my.recaps, [{ teamId: "c", votes: null, awards: { spirit: 3 }, rank: null }]);
  assert.equal(parseMyState(myStateJson({ fan: null })).fan, null);
});

test("write RPC results: ok, reasons, and unknown reasons fall back safely", () => {
  assert.deepEqual(parseCheckIn({ ok: true, fan: { homeTeamIds: ["a"], everHomeTeamIds: ["a"] }, removedBallotTeamIds: ["a"] }), {
    ok: true,
    fan: { homeTeamIds: ["a"], everHomeTeamIds: ["a"] },
    removedBallotTeamIds: ["a"],
  });
  assert.deepEqual(parseCheckIn({ ok: false, reason: "too-many" }), { ok: false, reason: "too-many" });
  // tap_mat strips nulls: no reason / startedAt keys on success-without-confirmation.
  assert.deepEqual(parseTap({ ok: true, confirmed: false }), { ok: true, reason: undefined, confirmed: false, startedAt: undefined });
  assert.deepEqual(parseTap({ ok: false, reason: "too-soon", confirmed: true, startedAt: T0 }), {
    ok: false,
    reason: "too-soon",
    confirmed: true,
    startedAt: T0,
  });
  assert.deepEqual(parseBallot({ ok: false, reason: "own-team" }), { ok: false, reason: "own-team" });
  assert.deepEqual(parseBallot({ ok: false, reason: "martian" }), { ok: false, reason: "invalid" });
  assert.deepEqual(parseOperator({ ok: false, reason: "locked" }), { ok: false, reason: "locked" });
  assert.deepEqual(parseOperator({ ok: true }), { ok: true });
  assert.deepEqual(parseOperator({ ok: false, reason: "already-started" }), { ok: false, reason: "already-started" });
  assert.deepEqual(parseOperator({ ok: false, reason: "slow-down" }), { ok: false, reason: "slow-down" });
  assert.match(OPERATOR_MESSAGES["already-started"], /Clear it first/);
});

// --- Snapshot merging and schedule versions -----------------------------------

test("applySnapshot: first snapshot brings the schedule, starts, board and timestamps", () => {
  const { data, needsSchedule } = applySnapshot(emptyData(MEET), snap(), 5000);
  assert.equal(needsSchedule, false);
  assert.equal(data.scheduleVersion, 3);
  assert.equal(data.meet?.teams.length, 3);
  assert.equal(data.starts.get("a"), T0 + 90 * SEC);
  assert.equal(data.asOf, T0 + 10 * MIN);
  assert.equal(data.fetchedAt, 5000);
  assert.equal(haveVersion(emptyData(MEET)), 0, "no schedule yet: ask for it");
  assert.equal(haveVersion(data), 3);
});

test("applySnapshot: same version without schedule keeps the cached running order", () => {
  const first = applySnapshot(emptyData(MEET), snap(), 1).data;
  const later = snap({ serverNow: T0 + 20 * MIN, schedule: null, starts: [] });
  const { data, needsSchedule } = applySnapshot(first, later, 2);
  assert.equal(needsSchedule, false);
  assert.equal(data.meet, first.meet);
  assert.equal(data.starts.size, 0, "starts always come from the newest snapshot");
});

test("applySnapshot: a new version replaces the schedule; a version bump without one asks again", () => {
  const first = applySnapshot(emptyData(MEET), snap(), 1).data;
  const bumped = snapshotJson({ serverNow: T0 + 20 * MIN, scheduleVersion: 4 });
  (bumped.schedule as { routines: { status: string }[] }).routines[0].status = "scratched";
  const next = applySnapshot(first, parseSnapshot(bumped)!, 2);
  assert.equal(next.needsSchedule, false);
  assert.equal(next.data.scheduleVersion, 4);
  assert.equal(next.data.meet?.slots[0].status, "scratched");

  const raced = applySnapshot(first, snap({ serverNow: T0 + 20 * MIN, scheduleVersion: 5, schedule: null }), 2);
  assert.equal(raced.needsSchedule, true);
  assert.equal(raced.data.scheduleVersion, 3, "keeps the old version so the next ask is honest");
  assert.equal(raced.data.meet, first.meet, "never a blank screen while refetching");
  assert.equal(applySnapshot(emptyData(MEET), snap({ schedule: null }), 1).needsSchedule, true);
});

test("applySnapshot ignores out-of-order and foreign responses", () => {
  const newer = applySnapshot(emptyData(MEET), snap({ serverNow: T0 + 30 * MIN }), 1).data;
  assert.equal(applySnapshot(newer, snap({ serverNow: T0 + 29 * MIN }), 2).data, newer);
  assert.equal(applySnapshot(newer, snap({ serverNow: T0 + 31 * MIN, meetId: "other-meet" }), 2).data, newer);
});

test("applyMyState: newest wins; optimistic updates add ballots/taps and check-in drops removed ballots", () => {
  const base = applyMyState(emptyData(MEET), parseMyState(myStateJson()));
  assert.equal(base.myAsOf, T0 + 11 * MIN);
  assert.equal(applyMyState(base, parseMyState(myStateJson({ serverNow: T0, isOperator: true }))), base);

  const voted = withBallot(base, "b", { stars: 4, awards: ["dance"] });
  assert.deepEqual(voted.my?.ballots.map((b) => b.teamId), ["a", "b"]);
  assert.equal(withBallot(voted, "b", { stars: 1, awards: [] }), voted, "one ballot per routine");
  assert.deepEqual(withTap(emptyData(MEET), "a").my?.tappedTeamIds, ["a"]);

  const fan = { homeTeamIds: ["a"], everHomeTeamIds: ["a", "c"] };
  const checked = withCheckIn(voted, fan, ["a"]);
  assert.deepEqual(checked.my?.fan, fan);
  assert.deepEqual(checked.my?.ballots.map((b) => b.teamId), ["b"]);
});

// --- Cache --------------------------------------------------------------------

test("cache round-trips Maps and my state, and rejects foreign, old or corrupt entries", () => {
  let data: LiveData = applySnapshot(emptyData(MEET), snap(), 1234).data;
  data = { ...applyMyState(data, parseMyState(myStateJson())), offset: -250 };
  const raw = serializeCache(data);
  assert.equal(cacheKey(MEET), "judgey_live_test-meet");
  assert.deepEqual(parseCache(raw, MEET), data);
  assert.equal(parseCache(raw, "other-meet"), null);
  assert.equal(parseCache("{not json", MEET), null);
  assert.equal(parseCache(JSON.stringify({ ...JSON.parse(raw), v: 0 }), MEET), null);
  assert.equal(parseCache(null, MEET), null);
  assert.deepEqual(parseCache(serializeCache(emptyData(MEET)), MEET), emptyData(MEET));
});

// --- Clock offset and freshness -----------------------------------------------

test("clock offset = serverNow − (sent + received) / 2, preferring the fastest round trip", () => {
  assert.deepEqual(clockSample(10_500, 1_000, 1_200), { offset: 9_400, rtt: 200 });
  let samples = addClockSample([], { offset: 100, rtt: 800 });
  samples = addClockSample(samples, { offset: 40, rtt: 90 });
  samples = addClockSample(samples, { offset: 70, rtt: 300 });
  assert.equal(clockOffset(samples, 0), 40);
  assert.equal(clockOffset([], -5), -5, "no samples yet: the cached offset");
  for (let i = 0; i < 10; i++) samples = addClockSample(samples, { offset: i, rtt: 500 });
  assert.equal(samples.length, 5);
});

test("freshness: Live under 30 s, then Updated h:mm, Offline after a failure, Connecting before anything", () => {
  const t = T0;
  assert.deepEqual(freshness(0, 0, t), { kind: "connecting" });
  assert.deepEqual(freshness(t - 29 * SEC, 0, t), { kind: "live" });
  assert.deepEqual(freshness(t - 29 * SEC, t - 30 * SEC, t), { kind: "live" }, "an older failure doesn't matter");
  assert.deepEqual(
    freshness(t - 29 * SEC, t - SEC, t),
    { kind: "reconnecting" },
    "a failure newer than the last success is never 'Live'",
  );
  assert.deepEqual(freshness(t - 30 * SEC, 0, t), { kind: "updated", at: t - 30 * SEC });
  assert.deepEqual(freshness(t - 5 * MIN, t - SEC, t), { kind: "offline", at: t - 5 * MIN });
  assert.deepEqual(freshness(0, t - SEC, t), { kind: "offline", at: null });

  const tz = "America/New_York"; // T0 is 9:00 AM there
  assert.equal(freshnessLabel({ kind: "live" }, tz), "Live");
  assert.equal(freshnessLabel({ kind: "updated", at: T0 + 41 * MIN }, tz), "Updated 9:41 AM");
  assert.equal(freshnessLabel({ kind: "offline", at: null }, tz), "Offline · last known times");
  assert.equal(freshnessLabel({ kind: "reconnecting" }, tz), "Reconnecting…");
});

test("freshness times are server time: a phone 10 min fast still shows the server's clock", () => {
  const device = T0 + 10 * MIN; // the device clock runs 10 min fast
  const offset = -10 * MIN; // server − device
  const f = freshness(device - 40 * SEC, 0, device, offset);
  assert.deepEqual(f, { kind: "updated", at: T0 - 40 * SEC });
  assert.equal(freshnessLabel(f, "America/New_York"), "Updated 8:59 AM");
  assert.deepEqual(freshness(device - 5 * MIN, device - SEC, device, offset), { kind: "offline", at: T0 - 5 * MIN });
});

// --- Cadence ---------------------------------------------------------------------

test("polling is 15 s ± 3 s; backoff grows, jitters and caps", () => {
  assert.equal(pollDelay(0), 12_000);
  assert.equal(pollDelay(0.5), 15_000);
  assert.ok(pollDelay(0.9999) <= 18_000 && pollDelay(0.9999) > 17_900);
  assert.equal(backoffDelay(0, 0), 500);
  assert.equal(backoffDelay(0, 1), 1_000);
  assert.equal(backoffDelay(3, 0), 4_000);
  assert.equal(backoffDelay(30, 1), 30_000, "capped");
  assert.equal(backoffDelay(2, 0.5, 2_000, 60_000), 6_000);
});

test("my_state is due every 60 s and right after a home team's window closes", () => {
  const starts = new Map([
    ["a", T0],
    ["b", T0 + 5 * MIN],
  ]);
  const deadline = (s: number) => s + RULES.votingWindowMinutes * MIN + RULES.ballotGraceSeconds * SEC;
  assert.equal(nextHomeClose(starts, ["a", "b", "x"], T0 + MIN), deadline(T0) + 1);
  assert.equal(nextHomeClose(starts, ["a", "b"], deadline(T0) + 1), deadline(T0 + 5 * MIN) + 1);
  assert.equal(nextHomeClose(starts, ["a"], deadline(T0) + 2), undefined, "already closed");
  assert.equal(nextHomeClose(starts, [], T0), undefined);

  assert.equal(myStateDelay(0, 100_000), 0, "never fetched: now");
  assert.equal(myStateDelay(100_000, 130_000), 30_000);
  assert.equal(myStateDelay(100_000, 130_000, 135_000), 6_000, "window close + 1 s wins");
  assert.equal(myStateDelay(100_000, 130_000, 125_000), 0);
});

test("touch again only after more than 15 min hidden", () => {
  assert.equal(shouldTouchOnVisible(null, T0), false);
  assert.equal(shouldTouchOnVisible(T0, T0 + 15 * MIN), false);
  assert.equal(shouldTouchOnVisible(T0, T0 + 15 * MIN + 1), true);
});

test("auth 429s are recognized only on /auth/v1/*", () => {
  assert.equal(isAuthRateLimit("https://x.supabase.co/auth/v1/token?grant_type=refresh_token", 429), true);
  assert.equal(isAuthRateLimit("https://x.supabase.co/auth/v1/signup", 429), true);
  assert.equal(isAuthRateLimit("https://x.supabase.co/auth/v1/signup", 400), false);
  assert.equal(isAuthRateLimit("https://x.supabase.co/rest/v1/rpc/meet_snapshot", 429), false);
  assert.equal(isAuthRateLimit("not a url", 429), false);
});

// --- Check-in sync ------------------------------------------------------------------

test("needsCheckInSync: unsynced picks, a missing fan row (new identity) and drift all re-sync", () => {
  const meet = meetFromSchedule(snap().schedule!);
  const local = (homeTeamIds: string[], synced = true): LocalCheckIn => ({ homeTeamIds, at: T0, synced });
  const fan = (homeTeamIds: string[]) => ({ homeTeamIds, everHomeTeamIds: homeTeamIds });
  assert.equal(needsCheckInSync(undefined, null, meet), false, "nothing to sync");
  assert.equal(needsCheckInSync(local(["a"], false), undefined, meet), true);
  assert.equal(needsCheckInSync(local(["a"]), undefined, meet), false, "synced and nothing known yet");
  assert.equal(needsCheckInSync(local(["a"]), null, meet), true, "server lost our row");
  assert.equal(needsCheckInSync(local(["a"]), fan(["a"]), meet), false);
  assert.equal(needsCheckInSync(local(["a", "c"]), fan(["a"]), meet), true);
  // b is scratched: the payload drops it, so the server's ["a"] is in sync.
  assert.equal(needsCheckInSync(local(["a", "b"]), fan(["a"]), meet), false);
  assert.equal(needsCheckInSync(local([]), fan([]), meet), false, "just here to cheer");
});

test("checkInPayload dedupes, drops scratched/unknown teams once the schedule is known, and caps", () => {
  const meet = meetFromSchedule(snap().schedule!);
  assert.deepEqual(checkInPayload(meet, ["c", "a", "c", "b", "zzz"]), ["c", "a"]);
  assert.deepEqual(checkInPayload(null, ["c", "a", "c", "b"]), ["c", "a", "b"]);
  const many = Array.from({ length: 12 }, (_, i) => `t${i}`);
  assert.equal(checkInPayload(null, many).length, RULES.maxHomeTeams);
});

// --- Tap outbox ------------------------------------------------------------------------

test("outbox: one entry per routine, age from the first tap, dropped after 120 s", () => {
  const e = { meetId: MEET, teamId: "a", tappedAt: 1_000 };
  let box = enqueueTap([], e);
  box = enqueueTap(box, { ...e, tappedAt: 9_000 });
  box = enqueueTap(box, { ...e, meetId: "other-meet" });
  assert.deepEqual(box, [e, { ...e, meetId: "other-meet" }]);

  assert.equal(tapAgeMs(e, 1_000), 0);
  assert.equal(tapAgeMs(e, 6_400), 5_400);
  assert.equal(tapAgeMs(e, 500), 0, "clock went backwards: never negative");
  assert.equal(outboxAction(e, 1_000 + OUTBOX_MAX_AGE_MS), "send", "120 s exactly still counts");
  assert.equal(outboxAction(e, 1_001 + OUTBOX_MAX_AGE_MS), "drop");
  assert.equal(OUTBOX_MAX_AGE_MS, RULES.maxTapAgeSeconds * SEC);
});

test("tap outcomes: accepted or already confirmed is sent; anything else fails with friendly copy", () => {
  assert.deepEqual(tapOutcome({ ok: true, confirmed: false }), { state: "sent" });
  assert.deepEqual(tapOutcome({ ok: false, reason: "already-confirmed", confirmed: true }), { state: "sent" });
  assert.deepEqual(tapOutcome({ ok: false, reason: "too-soon", confirmed: false }), {
    state: "failed",
    message: TAP_MESSAGES["too-soon"],
  });
});

test("ballot reasons map to the domain's messages (own-team keeps the house copy)", () => {
  assert.equal(ballotError({ ok: true }), null);
  assert.deepEqual(ballotError({ ok: false, reason: "own-team" }), { reason: "own-team", message: OWN_TEAM_MESSAGE });
  assert.deepEqual(ballotError({ ok: false, reason: "window-closed" }), {
    reason: "window-closed",
    message: BALLOT_MESSAGES["window-closed"],
  });
});

// --- Links and mode -------------------------------------------------------------------

test("resolveMeetId: ?meet= wins in live mode, then the stored meet, else the demo", () => {
  const demo = "winter-classic-2026";
  assert.equal(resolveMeetId("dec-classic", null, true, demo), "dec-classic");
  assert.equal(resolveMeetId("dec-classic", null, false, demo), demo, "no backend: demo fallback");
  assert.equal(resolveMeetId("Bad Id!", "dec-classic", true, demo), demo);
  assert.equal(resolveMeetId(demo, "dec-classic", true, demo), demo);
  assert.equal(resolveMeetId(null, "dec-classic", true, demo), "dec-classic");
  assert.equal(resolveMeetId(null, "dec-classic", false, demo), demo);
  assert.equal(resolveMeetId(null, null, true, demo), demo);

  assert.equal(modeFor("dec-classic", true, demo), "live");
  assert.equal(modeFor("dec-classic", false, demo), "demo");
  assert.equal(modeFor(demo, true, demo), "demo");
  assert.equal(modeFor(null, true, demo), "demo");
});

test("src and share links", () => {
  assert.equal(cleanSrc("qr"), "qr");
  assert.equal(cleanSrc("group-chat-2"), "group-chat-2");
  assert.equal(cleanSrc("Group Chat"), null);
  assert.equal(cleanSrc("x".repeat(33)), null);
  assert.equal(cleanSrc(null), null);
  assert.equal(shareUrl("https://judgey.app", "dec-classic"), "https://judgey.app/?meet=dec-classic&src=share");
});
