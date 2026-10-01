"use client";

// This device's state: check-in, taps, ballots, dismissed alerts, demo clock.
// localStorage + useSyncExternalStore for now; this is the seam where the
// realtime backend plugs in later (taps/ballots become shared rows).

import { useSyncExternalStore } from "react";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { initialClock, setSpeed, startClock, type ClockState } from "@/src/demo/clock.ts";
import type { Ballot, MatTap } from "@/src/types.ts";

const KEY = "judgey_v1";

export interface JudgeyState {
  deviceId: string;
  checkedIn: boolean;
  homeTeamIds: string[];
  taps: MatTap[];
  ballots: Ballot[];
  dismissedAlerts: string[];
  clock: ClockState;
}

const DEFAULT: JudgeyState = {
  deviceId: "",
  checkedIn: false,
  homeTeamIds: [],
  taps: [],
  ballots: [],
  dismissedAlerts: [],
  clock: initialClock(DEMO_MEET.startsAt),
};

let cachedRaw: string | null | undefined;
let cached: JudgeyState = DEFAULT;

function read(): JudgeyState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<JudgeyState>) } : DEFAULT;
  } catch {
    cached = DEFAULT;
  }
  return cached;
}

const listeners = new Set<() => void>();

function write(next: JudgeyState) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Private mode / quota: keep working in memory for this session.
  }
  cachedRaw = raw;
  cached = next;
  listeners.forEach((l) => l());
}

function update(fn: (s: JudgeyState) => JudgeyState) {
  const s = read();
  write(fn(s.deviceId ? s : { ...s, deviceId: crypto.randomUUID() }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useJudgeyState(): JudgeyState {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

export const actions = {
  checkIn(homeTeamIds: string[]) {
    update((s) => ({
      ...s,
      checkedIn: true,
      homeTeamIds,
      clock: startClock(s.clock, Date.now()),
    }));
  },
  startClock() {
    update((s) => ({ ...s, clock: startClock(s.clock, Date.now()) }));
  },
  setSpeed(speed: number) {
    update((s) => ({ ...s, clock: setSpeed(s.clock, speed, Date.now()) }));
  },
  tap(tap: Omit<MatTap, "deviceId">) {
    update((s) => ({ ...s, taps: [...s.taps, { ...tap, deviceId: s.deviceId }] }));
  },
  vote(ballot: Omit<Ballot, "deviceId">) {
    update((s) => ({ ...s, ballots: [...s.ballots, { ...ballot, deviceId: s.deviceId }] }));
  },
  dismissAlert(key: string) {
    update((s) => ({ ...s, dismissedAlerts: [...s.dismissedAlerts, key] }));
  },
  restartDemo() {
    update((s) => ({
      ...DEFAULT,
      deviceId: s.deviceId,
      checkedIn: s.checkedIn,
      homeTeamIds: s.homeTeamIds,
      clock: startClock(initialClock(DEMO_MEET.startsAt), Date.now()),
    }));
  },
  signOut() {
    update((s) => ({ ...DEFAULT, deviceId: s.deviceId }));
  },
};

/** The device id for building ballots before they're stored. */
export function currentDeviceId(): string {
  return read().deviceId;
}
