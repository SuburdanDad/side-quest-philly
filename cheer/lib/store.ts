"use client";

// This device's own state, in localStorage: which meet it's at, its local-first
// check-in per live meet, first-touch src, dismissed alerts, the tap outbox, and
// everything the demo meet runs on (profile, taps, ballots, clock). What the
// server knows about a live meet lives in lib/sources/live.ts and its cache.

import { useSyncExternalStore } from "react";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { initialClock, setSpeed, startClock, type ClockState } from "@/src/demo/clock.ts";
import { applyCheckIn } from "@/src/voting.ts";
import type { Ballot, FanProfile, MatTap, Timestamp } from "@/src/types.ts";
import { cleanSrc, enqueueTap, sameIds, type LocalCheckIn, type OutboxEntry } from "./live-core";

const KEY = "judgey_v2";

export interface DemoState {
  /** null until this device checks in to the demo meet. */
  profile: FanProfile | null;
  taps: MatTap[];
  ballots: Ballot[];
  clock: ClockState;
}

export interface DeviceState {
  /** Random per-device id for the demo (live mode uses the anonymous auth user). */
  deviceId: string;
  /** The meet this device is following; null = the demo. */
  meetId: string | null;
  /** Live meets only: meetId → this device's pick. */
  checkIns: Record<string, LocalCheckIn>;
  /** meetId → first-touch ?src= (qr, groupchat, share…). */
  src: Record<string, string>;
  /** meetId → dismissed alert keys (`${teamId}:${lead}`). */
  dismissedAlerts: Record<string, string[]>;
  /** Live taps not yet acknowledged by the server. */
  outbox: OutboxEntry[];
  demo: DemoState;
}

const freshDemo = (): DemoState => ({
  profile: null,
  taps: [],
  ballots: [],
  clock: initialClock(DEMO_MEET.startsAt),
});

const DEFAULT: DeviceState = {
  deviceId: "",
  meetId: null,
  checkIns: {},
  src: {},
  dismissedAlerts: {},
  outbox: [],
  demo: freshDemo(),
};

let cachedRaw: string | null | undefined;
let cached: DeviceState = DEFAULT;
/** A write failed (quota / private mode): from then on the in-memory copy is the truth. */
let memoryOnly = false;

function parse(raw: string | null): DeviceState {
  if (!raw) return DEFAULT;
  try {
    const s = JSON.parse(raw) as Partial<DeviceState>;
    return { ...DEFAULT, ...s, demo: { ...DEFAULT.demo, ...s.demo } };
  } catch {
    return DEFAULT;
  }
}

function read(): DeviceState {
  if (memoryOnly) return cached;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = parse(raw);
  return cached;
}

const listeners = new Set<() => void>();

function write(next: DeviceState) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    memoryOnly = true; // Private mode / quota: keep working in memory for this session.
  }
  cachedRaw = raw;
  cached = next;
  listeners.forEach((l) => l());
}

function update(fn: (s: DeviceState) => DeviceState) {
  const s = read();
  write(fn(s.deviceId ? s : { ...s, deviceId: crypto.randomUUID() }));
}

export function subscribeDevice(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current state outside React (event handlers, the live wiring). */
export const getDeviceState = read;

export function useDeviceState(): DeviceState {
  return useSyncExternalStore(subscribeDevice, read, () => DEFAULT);
}

/** This device's id, created on first use. */
export function deviceId(): string {
  if (!read().deviceId) update((s) => s);
  return read().deviceId;
}

const demoUpdate = (fn: (d: DemoState) => DemoState) => update((s) => ({ ...s, demo: fn(s.demo) }));

export const deviceActions = {
  selectMeet(meetId: string) {
    if (read().meetId !== meetId) update((s) => ({ ...s, meetId }));
  },
  /** First touch wins: a later link with another src doesn't overwrite it. */
  recordSrc(meetId: string, src: string | null) {
    const clean = cleanSrc(src);
    if (clean && !read().src[meetId]) update((s) => ({ ...s, src: { ...s.src, [meetId]: clean } }));
  },
  dismissAlert(meetId: string, key: string) {
    update((s) => ({
      ...s,
      dismissedAlerts: { ...s.dismissedAlerts, [meetId]: [...(s.dismissedAlerts[meetId] ?? []), key] },
    }));
  },

  // Live meets: local-first check-in and the tap outbox.
  checkInLive(meetId: string, homeTeamIds: string[]) {
    const entry: LocalCheckIn = { homeTeamIds: [...new Set(homeTeamIds)], at: Date.now(), synced: false };
    update((s) => ({ ...s, meetId, checkIns: { ...s.checkIns, [meetId]: entry } }));
  },
  /** check_in succeeded for exactly these ids (a newer pick stays unsynced). */
  markCheckInSynced(meetId: string, homeTeamIds: string[]) {
    const cur = read().checkIns[meetId];
    if (!cur || cur.synced || !sameIds(cur.homeTeamIds, homeTeamIds)) return;
    update((s) => ({ ...s, checkIns: { ...s.checkIns, [meetId]: { ...cur, synced: true } } }));
  },
  markCheckInUnsynced(meetId: string) {
    const cur = read().checkIns[meetId];
    if (!cur || !cur.synced) return;
    update((s) => ({ ...s, checkIns: { ...s.checkIns, [meetId]: { ...cur, synced: false } } }));
  },
  enqueueTap(entry: OutboxEntry) {
    update((s) => ({ ...s, outbox: enqueueTap(s.outbox, entry) }));
  },
  removeTap(meetId: string, teamId: string) {
    update((s) => ({ ...s, outbox: s.outbox.filter((e) => !(e.meetId === meetId && e.teamId === teamId)) }));
  },

  // The demo meet: everything stays on this phone.
  demoCheckIn(homeTeamIds: string[]) {
    update((s) => {
      const { profile, removedBallotTeamIds } = applyCheckIn(s.demo.profile, s.deviceId, homeTeamIds, s.demo.ballots);
      const gone = new Set(removedBallotTeamIds);
      return {
        ...s,
        meetId: DEMO_MEET.id,
        demo: {
          ...s.demo,
          profile,
          ballots: s.demo.ballots.filter((b) => !gone.has(b.teamId)),
          clock: startClock(s.demo.clock, Date.now()),
        },
      };
    });
  },
  demoTap(teamId: string, at: Timestamp) {
    update((s) => ({ ...s, demo: { ...s.demo, taps: [...s.demo.taps, { teamId, deviceId: s.deviceId, at }] } }));
  },
  demoVote(ballot: Ballot) {
    demoUpdate((d) => ({ ...d, ballots: [...d.ballots, ballot] }));
  },
  startDemoClock() {
    demoUpdate((d) => ({ ...d, clock: startClock(d.clock, Date.now()) }));
  },
  setDemoSpeed(speed: number) {
    demoUpdate((d) => ({ ...d, clock: setSpeed(d.clock, speed, Date.now()) }));
  },
  /** Back to 9:40 with no taps or votes; the same teams stay followed. */
  restartDemo() {
    update((s) => {
      const home = s.demo.profile?.homeTeamIds;
      return {
        ...s,
        dismissedAlerts: { ...s.dismissedAlerts, [DEMO_MEET.id]: [] },
        demo: {
          ...freshDemo(),
          profile: home ? { deviceId: s.deviceId, homeTeamIds: home, everHomeTeamIds: home } : null,
          clock: startClock(initialClock(DEMO_MEET.startsAt), Date.now()),
        },
      };
    });
  },
};
