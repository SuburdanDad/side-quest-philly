"use client";

// Live mode wiring (docs/backend-spec.md §8): one external store per meet that
// hydrates from its localStorage cache, polls meet_snapshot (15 s ± 3 s while
// visible; at once on visible/online and after our own actions), refreshes
// my_state (on sign-in, after actions, every 60 s, and when a home team's
// voting closes), syncs the local-first check-in and drains the tap outbox.
// Every decision lives in ../live-core.ts; this file only does timers and I/O.

import { useSyncExternalStore } from "react";
import { buildBoards } from "@/src/board.ts";
import { SECOND } from "@/src/rules.ts";
import type { Meet, Team } from "@/src/types.ts";
import {
  addClockSample,
  applyMyState,
  applySnapshot,
  backoffDelay,
  ballotError,
  cacheKey,
  checkInPayload,
  clockOffset,
  clockSample,
  DROPPED_TAP_MESSAGE,
  emptyData,
  freshness,
  haveVersion,
  myStateDelay,
  needsCheckInSync,
  nextHomeClose,
  OFFLINE_MESSAGE,
  OPERATOR_MESSAGES,
  OUTBOX_RETRY_MS,
  outboxAction,
  parseBallot,
  parseCache,
  parseCheckIn,
  parseMyState,
  parseOperator,
  parseSnapshot,
  parseTap,
  pollDelay,
  serializeCache,
  shouldTouchOnVisible,
  tapAgeMs,
  tapOutcome,
  withBallot,
  withCheckIn,
  withTap,
  type ClockSample,
  type Freshness,
  type LiveData,
  type PendingTap,
} from "../live-core";
import { placeholderView, type MeetActions, type MeetView, type OperatorActions } from "../meet-view";
import { deviceActions, getDeviceState, useDeviceState, type DeviceState } from "../store";
import { callAuthed, ensureSession, fetchSnapshot, onSessionRenewed } from "../supabase";
import { useRealNow } from "../ticker";

const ACTION_TIMEOUT_MS = 15 * SECOND;
/** How long a "Couldn't send" note stays under the tap button. */
const TAP_NOTE_MS = 60 * SECOND;
/** Keep polling briefly after the last screen unsubscribes (route changes re-subscribe). */
const STOP_DELAY_MS = 5 * SECOND;
const NONE: string[] = [];

interface LiveState {
  data: LiveData;
  /** Device time of the last good snapshot (seeded from the cache). */
  lastSuccessAt: number;
  lastFailureAt: number;
  notFound: boolean;
  clock: ClockSample[];
  /** teamId → what the tap button shows. */
  taps: Record<string, PendingTap>;
}

interface LiveStore {
  getState(): LiveState;
  subscribe(cb: () => void): () => void;
  view(state: LiveState, device: DeviceState, realNow: number): MeetView;
  claim(code: string): Promise<string | null>;
}

type Timer = ReturnType<typeof setTimeout> | undefined;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: Timer;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** Run `fn` now, or once more right after the run that's in flight. */
function coalesced(fn: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let again = false;
  const run = (): Promise<void> => {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = fn().finally(() => {
      inFlight = null;
      if (again) {
        again = false;
        run().catch(() => {});
      }
    });
    return inFlight;
  };
  return run;
}

function readCache(meetId: string): LiveData | null {
  try {
    return parseCache(localStorage.getItem(cacheKey(meetId)), meetId);
  } catch {
    return null;
  }
}

function writeCache(data: LiveData) {
  try {
    localStorage.setItem(cacheKey(data.meetId), serializeCache(data));
  } catch {
    // Quota / private mode: the in-memory copy still works.
  }
}

const teamMaps = new WeakMap<Meet, Map<string, Team>>();
function teamsOf(meet: Meet): Map<string, Team> {
  let m = teamMaps.get(meet);
  if (!m) teamMaps.set(meet, (m = new Map(meet.teams.map((t) => [t.id, t]))));
  return m;
}

const visible = () => document.visibilityState !== "hidden";

function createStore(meetId: string): LiveStore {
  const cached = readCache(meetId);
  let state: LiveState = {
    data: cached ?? emptyData(meetId),
    lastSuccessAt: cached?.fetchedAt ?? 0,
    lastFailureAt: 0,
    notFound: false,
    clock: [],
    taps: {},
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<LiveState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  /** New data (plus any other changes) in one notification; the cache follows. */
  const setData = (data: LiveData, patch: Partial<LiveState> = {}) => {
    if (data === state.data) {
      if (Object.keys(patch).length > 0) set(patch);
      return;
    }
    set({ ...patch, data });
    writeCache(data);
  };
  const offset = () => clockOffset(state.clock, state.data.offset);
  const localCheckIn = () => getDeviceState().checkIns[meetId];
  const outbox = () => getDeviceState().outbox.filter((e) => e.meetId === meetId);
  const setTap = (teamId: string, tap: Omit<PendingTap, "teamId" | "at">) =>
    set({ taps: { ...state.taps, [teamId]: { teamId, at: Date.now(), ...tap } } });

  let running = false;
  let signedIn = false;
  let hiddenAt: number | null = null;
  let stopTimer: Timer, pollTimer: Timer, myTimer: Timer, outboxTimer: Timer, checkInTimer: Timer;

  // --- meet_snapshot ------------------------------------------------------
  let forceSchedule = false;
  const refresh = coalesced(async () => {
    clearTimeout(pollTimer);
    const sentAt = Date.now();
    try {
      const raw = await fetchSnapshot(meetId, forceSchedule ? 0 : haveVersion(state.data));
      const receivedAt = Date.now();
      const snap = parseSnapshot(raw);
      if (!snap) {
        set({ notFound: true, lastSuccessAt: receivedAt });
        return;
      }
      forceSchedule = false;
      const clock = addClockSample(state.clock, clockSample(snap.serverNow, sentAt, receivedAt));
      const { data, needsSchedule } = applySnapshot(state.data, snap, receivedAt);
      const next = data === state.data ? data : { ...data, offset: clockOffset(clock, data.offset) };
      setData(next, { clock, lastSuccessAt: receivedAt, notFound: false });
      if (needsSchedule) {
        forceSchedule = true;
        refresh().catch(() => {});
      }
      scheduleMine(); // a home team may have just started
    } catch {
      set({ lastFailureAt: Date.now() });
    } finally {
      schedulePoll();
    }
  });

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (running && visible()) pollTimer = setTimeout(() => void refresh(), pollDelay(Math.random()));
  }

  // --- my_state -----------------------------------------------------------
  /** Bumped by every optimistic update, so an older my_state can't undo it. */
  let mySeq = 0;
  let myLastAt = 0;
  const refreshMine = coalesced(async () => {
    if (!signedIn) return;
    clearTimeout(myTimer);
    const seq = mySeq;
    myLastAt = Date.now(); // the 60 s cadence counts attempts, so failures don't retry in a loop
    try {
      const my = parseMyState(await callAuthed("my_state", { p_meet: meetId }));
      if (seq !== mySeq) return;
      // my_state is the truth about our own taps (an operator Clear deletes them): settle "Sent!".
      const taps = Object.fromEntries(Object.entries(state.taps).filter(([, t]) => t.state !== "sent"));
      setData(applyMyState(state.data, my), { taps });
      if (needsCheckInSync(localCheckIn(), my.fan, state.data.meet)) {
        deviceActions.markCheckInUnsynced(meetId);
        syncCheckIn().catch(() => {});
      }
    } catch {
      // Try again on the next round.
    } finally {
      scheduleMine();
    }
  });

  function scheduleMine() {
    clearTimeout(myTimer);
    if (!running || !signedIn || !visible()) return;
    const realNow = Date.now();
    const off = offset();
    const close = nextHomeClose(state.data.starts, localCheckIn()?.homeTeamIds ?? NONE, realNow + off);
    const delay = myStateDelay(myLastAt, realNow, close === undefined ? undefined : close - off);
    myTimer = setTimeout(() => void refreshMine(), delay);
  }

  // --- session, touch -----------------------------------------------------
  const touch = () =>
    callAuthed("touch", { p_meet: meetId, p_src: getDeviceState().src[meetId] ?? null }).catch(() => {});

  /** Sign in (once), then touch() for this page load and fetch my_state. */
  async function startSession() {
    await ensureSession();
    if (signedIn) return;
    signedIn = true;
    void touch();
    void refreshMine();
  }

  /** Everything that needs a session: check-in sync, the outbox, my_state. */
  function wake() {
    startSession().then(
      () => {
        syncCheckIn().catch(() => {});
        void flushOutbox();
      },
      () => {
        if (localCheckIn() && !localCheckIn()!.synced) retrySync();
        if (outbox().length > 0) scheduleFlush();
      },
    );
  }

  // --- check_in (local-first) --------------------------------------------
  let syncAttempt = 0;
  function retrySync() {
    clearTimeout(checkInTimer);
    if (state.notFound) return;
    const delay = backoffDelay(syncAttempt++, Math.random(), 2 * SECOND, 60 * SECOND);
    checkInTimer = setTimeout(() => syncCheckIn().catch(() => {}), delay);
  }

  const syncCheckIn = coalesced(async () => {
    clearTimeout(checkInTimer);
    try {
      // A few rounds at most: each one catches up with a newer pick made while the last was in flight.
      for (let round = 0; round < 3; round++) {
        const local = localCheckIn();
        if (!local || local.synced) return;
        await startSession();
        const ids = checkInPayload(state.data.meet, local.homeTeamIds);
        const res = parseCheckIn(await callAuthed("check_in", { p_meet: meetId, p_home_team_ids: ids }));
        if (!res.ok) {
          // Probably a stale running order (a team was scratched): fetch it before retrying.
          forceSchedule = true;
          void refresh();
          throw new Error(res.reason);
        }
        mySeq++;
        setData(withCheckIn(state.data, res.fan, res.removedBallotTeamIds));
        deviceActions.markCheckInSynced(meetId, local.homeTeamIds);
        syncAttempt = 0;
        void refreshMine(); // recaps follow the new home teams
      }
    } catch (e) {
      retrySync();
      throw e;
    }
  });

  // --- tap outbox -----------------------------------------------------------
  function scheduleFlush() {
    clearTimeout(outboxTimer);
    if (running && outbox().length > 0) outboxTimer = setTimeout(() => void flushOutbox(), OUTBOX_RETRY_MS);
  }

  const flushOutbox = coalesced(async () => {
    clearTimeout(outboxTimer);
    for (const entry of outbox()) {
      if (outboxAction(entry, Date.now()) === "drop") {
        deviceActions.removeTap(meetId, entry.teamId);
        setTap(entry.teamId, { state: "failed", message: DROPPED_TAP_MESSAGE });
        continue;
      }
      try {
        await startSession();
        const args = { p_meet: meetId, p_team: entry.teamId, p_age_ms: tapAgeMs(entry, Date.now()) };
        const res = parseTap(await callAuthed("tap_mat", args));
        deviceActions.removeTap(meetId, entry.teamId);
        const outcome = tapOutcome(res);
        setTap(entry.teamId, outcome);
        if (outcome.state === "sent") {
          mySeq++;
          setData(withTap(state.data, entry.teamId));
        }
        void refresh();
        void refreshMine();
      } catch {
        setTap(entry.teamId, { state: "retrying" });
      }
    }
    scheduleFlush();
  });

  // --- lifecycle --------------------------------------------------------------
  function onVisibility() {
    if (!visible()) {
      hiddenAt = Date.now();
      clearTimeout(pollTimer);
      clearTimeout(myTimer);
      return;
    }
    if (signedIn && shouldTouchOnVisible(hiddenAt, Date.now())) void touch();
    hiddenAt = null;
    void refresh();
    void refreshMine();
    void flushOutbox();
  }

  function onOnline() {
    void refresh();
    void refreshMine();
    void flushOutbox();
    if (localCheckIn() && !localCheckIn()!.synced) syncCheckIn().catch(() => {});
  }

  function start() {
    running = true;
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    void refresh();
    // No session until it's needed: a check-in, a queued tap, or one from earlier on this page.
    if (signedIn || localCheckIn() || outbox().length > 0) wake();
  }

  function stop() {
    running = false;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    [pollTimer, myTimer, outboxTimer, checkInTimer].forEach(clearTimeout);
  }

  onSessionRenewed(() => {
    // A brand-new anonymous identity: re-send the cached check-in and reload our own rows.
    mySeq++;
    deviceActions.markCheckInUnsynced(meetId);
    if (localCheckIn()) syncCheckIn().catch(() => {});
    void refreshMine();
  });

  // --- actions ------------------------------------------------------------------
  async function opCall(fn: string, args: Record<string, unknown>): Promise<string | null> {
    try {
      const res = parseOperator(await withTimeout(callAuthed(fn, { p_meet: meetId, ...args }), ACTION_TIMEOUT_MS));
      void refresh();
      if (res.ok) return null;
      if (res.reason === "not-operator") void refreshMine();
      return OPERATOR_MESSAGES[res.reason ?? "invalid"];
    } catch {
      return OFFLINE_MESSAGE;
    }
  }

  const ops: OperatorActions = {
    start: (teamId) => opCall("op_set_start", { p_team: teamId, p_started_at_ms: Math.round(Date.now() + offset()) }),
    clear: (teamId) => opCall("op_set_start", { p_team: teamId, p_started_at_ms: null }),
    setStatus: (teamId, status) => opCall("op_set_status", { p_team: teamId, p_status: status }),
  };

  const actions: MeetActions = {
    checkIn(homeTeamIds) {
      deviceActions.checkInLive(meetId, homeTeamIds);
      wake();
    },
    tap(teamId) {
      deviceActions.enqueueTap({ meetId, teamId, tappedAt: Date.now() });
      setTap(teamId, { state: "sending" });
      void flushOutbox();
    },
    async vote(teamId, stars, awards) {
      // The server needs our fans row first (local-first check-in may still be syncing).
      await withTimeout(startSession().then(syncCheckIn), ACTION_TIMEOUT_MS);
      const args = { p_meet: meetId, p_team: teamId, p_stars: stars, p_awards: awards };
      const error = ballotError(parseBallot(await withTimeout(callAuthed("cast_ballot", args), ACTION_TIMEOUT_MS)));
      if (!error) {
        mySeq++;
        setData(withBallot(state.data, teamId, { stars, awards }));
      }
      void refreshMine();
      void refresh();
      return error;
    },
    dismissAlert: (key) => deviceActions.dismissAlert(meetId, key),
  };
  const operatorActions: MeetActions = { ...actions, op: ops };

  // --- view ---------------------------------------------------------------------
  let memo: { s: LiveState; device: DeviceState; realNow: number; view: MeetView } | undefined;

  function view(s: LiveState, device: DeviceState, realNow: number): MeetView {
    if (memo && memo.s === s && memo.device === device && memo.realNow === realNow) return memo.view;
    const { data } = s;
    const local = device.checkIns[meetId];
    const homeTeamIds = local?.homeTeamIds ?? NONE;
    const fresh: Freshness =
      realNow === 0 ? { kind: "connecting" } : freshness(s.lastSuccessAt, s.lastFailureAt, realNow);
    let result: MeetView;
    if (!data.meet || realNow === 0) {
      const checkedIn = !!local;
      result = placeholderView("live", meetId, { notFound: s.notFound, freshness: fresh, checkedIn, homeTeamIds });
    } else {
      const meet = data.meet;
      const now = realNow + clockOffset(s.clock, data.offset);
      const queued = device.outbox.filter((e) => e.meetId === meetId);
      const queuedIds = new Set(queued.map((e) => e.teamId));
      // Queued taps show sending/retrying; settled ones show "sent", or a failure note for a minute.
      const inFlight = (t: PendingTap | undefined): t is PendingTap =>
        t !== undefined && (t.state === "sending" || t.state === "retrying");
      const settled = (t: PendingTap) =>
        !queuedIds.has(t.teamId) && (t.state === "sent" || (t.state === "failed" && realNow - t.at < TAP_NOTE_MS));
      const pendingTaps: PendingTap[] = [
        ...queued.map((e): PendingTap => {
          const t = s.taps[e.teamId];
          return inFlight(t) ? t : { teamId: e.teamId, state: "sending", at: e.tappedAt };
        }),
        ...Object.values(s.taps).filter(settled),
      ];
      const my = data.my;
      const sent = Object.values(s.taps).filter((t) => t.state === "sent").map((t) => t.teamId);
      const teams = teamsOf(meet);
      result = {
        mode: "live",
        meet,
        now,
        ready: true,
        freshness: fresh,
        starts: data.starts,
        boards: buildBoards(meet, data.starts, now),
        teamById: (id) => teams.get(id),
        checkedIn: !!local,
        homeTeamIds,
        myTappedTeamIds: [...new Set([...(my?.tappedTeamIds ?? NONE), ...sent])],
        pendingTaps,
        myBallots: new Map((my?.ballots ?? []).map((b) => [b.teamId, { stars: b.stars, awards: b.awards }])),
        board: data.board,
        recaps: my?.recaps ?? [],
        isOperator: my?.isOperator ?? false,
        dismissedAlerts: device.dismissedAlerts[meetId] ?? NONE,
        notFound: s.notFound,
        actions: my?.isOperator ? operatorActions : actions,
      };
    }
    memo = { s, device, realNow, view: result };
    return result;
  }

  return {
    getState: () => state,
    subscribe(cb) {
      listeners.add(cb);
      clearTimeout(stopTimer);
      if (!running) start();
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0) stopTimer = setTimeout(stop, STOP_DELAY_MS);
      };
    },
    view,
    async claim(code) {
      try {
        await withTimeout(startSession(), ACTION_TIMEOUT_MS);
        const args = { p_meet: meetId, p_code: code };
        const res = parseOperator(await withTimeout(callAuthed("claim_operator", args), ACTION_TIMEOUT_MS));
        mySeq++;
        await refreshMine();
        return res.ok ? null : OPERATOR_MESSAGES[res.reason ?? "invalid"];
      } catch {
        return OFFLINE_MESSAGE;
      }
    },
  };
}

const stores = new Map<string, LiveStore>();
function storeFor(meetId: string): LiveStore {
  let s = stores.get(meetId);
  if (!s) stores.set(meetId, (s = createStore(meetId)));
  return s;
}

/** Trade an operator code (from /?meet=…&op=…) for operator rights. Resolves with an error message or null. */
export const claimOperator = (meetId: string, code: string) => storeFor(meetId).claim(code);

const noSubscribe = () => () => {};
const noState = () => null;
const INACTIVE = placeholderView("live", "");

/** A live meet's view, or an inert placeholder when meetId is null. Always called (hooks run unconditionally). */
export function useLiveSource(meetId: string | null): MeetView {
  const device = useDeviceState();
  const realNow = useRealNow();
  const store = meetId ? storeFor(meetId) : null;
  const state = useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getState ?? noState, noState);
  if (!meetId || !store || !state) return meetId ? placeholderView("live", meetId) : INACTIVE;
  return store.view(state, device, realNow);
}
