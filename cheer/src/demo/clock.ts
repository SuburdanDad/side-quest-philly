// Demo clock: meet time runs at an adjustable speed relative to real time.

import type { Timestamp } from "../types.ts";

export interface ClockState {
  /** Real time at the last re-anchor (0 = not started yet). */
  anchorReal: Timestamp;
  /** Meet time at the last re-anchor. */
  anchorMeet: Timestamp;
  /** Meet ms per real ms. 0 = paused. */
  speed: number;
}

export const SPEEDS = [0, 1, 10, 60] as const;

export function initialClock(meetStart: Timestamp): ClockState {
  // Drop in at 9:40, when Mat 1 has already slipped behind.
  return { anchorReal: 0, anchorMeet: meetStart + 40 * 60_000, speed: 10 };
}

export function meetNow(clock: ClockState, realNow: Timestamp): Timestamp {
  if (clock.anchorReal === 0) return clock.anchorMeet;
  return clock.anchorMeet + Math.max(0, realNow - clock.anchorReal) * clock.speed;
}

export function setSpeed(clock: ClockState, speed: number, realNow: Timestamp): ClockState {
  return { anchorReal: realNow, anchorMeet: meetNow(clock, realNow), speed };
}

export function startClock(clock: ClockState, realNow: Timestamp): ClockState {
  return clock.anchorReal === 0 ? { ...clock, anchorReal: realNow } : clock;
}
