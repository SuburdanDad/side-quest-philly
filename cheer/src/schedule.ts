// "When do we go on?" Spectators in the arena tap when a team takes the mat.
// Those taps show how far each mat is running behind (or ahead), and every
// parent's ETA shifts by that amount. The same signal opens the fan-vote window.

import type { MatTap, Minutes, Slot, Timestamp } from "./types.ts";

const MINUTE = 60_000;

export interface ConfirmOptions {
  /** Distinct devices required before we trust a start time. */
  minDevices?: number;
  /** Ignore taps this far before the scheduled time (fat fingers, wrong team). */
  maxEarly?: Minutes;
}

/** Median tap time from distinct devices, or undefined until enough people agree. */
export function confirmedStart(
  slot: Slot,
  taps: MatTap[],
  { minDevices = 2, maxEarly = 45 }: ConfirmOptions = {},
): Timestamp | undefined {
  const earliest = slot.scheduledAt - maxEarly * MINUTE;
  const byDevice = new Map<string, Timestamp>();
  for (const tap of taps) {
    if (tap.teamId !== slot.teamId || tap.at < earliest) continue;
    // One vote per device; keep its first tap.
    const prev = byDevice.get(tap.deviceId);
    if (prev === undefined || tap.at < prev) byDevice.set(tap.deviceId, tap.at);
  }
  if (byDevice.size < minDevices) return undefined;
  const times = [...byDevice.values()].sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);
}

/**
 * How far behind (+) or ahead (-) a mat is running, in ms, based on the most
 * recently confirmed routine on that mat. Zero until the first confirmation.
 */
export function matDrift(
  mat: string,
  slots: Slot[],
  taps: MatTap[],
  opts?: ConfirmOptions,
): number {
  const onMat = slots
    .filter((s) => s.mat === mat)
    .sort((a, b) => b.scheduledAt - a.scheduledAt);
  for (const slot of onMat) {
    const start = confirmedStart(slot, taps, opts);
    if (start !== undefined) return start - slot.scheduledAt;
  }
  return 0;
}

export interface Eta {
  teamId: string;
  scheduledAt: Timestamp;
  estimatedAt: Timestamp;
  /** Rounded minutes behind (+) / ahead (-), for display. */
  driftMinutes: number;
  status: "upcoming" | "on-mat" | "done";
}

/** Estimated performance time for a team, using its mat's current drift. */
export function etaFor(
  teamId: string,
  slots: Slot[],
  taps: MatTap[],
  now: Timestamp,
  opts?: ConfirmOptions & { routineLength?: Minutes },
): Eta | undefined {
  const slot = slots.find((s) => s.teamId === teamId);
  if (!slot) return undefined;

  const routineMs = (opts?.routineLength ?? 3) * MINUTE;
  const start = confirmedStart(slot, taps, opts);
  if (start !== undefined) {
    return {
      teamId,
      scheduledAt: slot.scheduledAt,
      estimatedAt: start,
      driftMinutes: Math.round((start - slot.scheduledAt) / MINUTE),
      status: now < start + routineMs ? "on-mat" : "done",
    };
  }

  const drift = matDrift(slot.mat, slots, taps, opts);
  return {
    teamId,
    scheduledAt: slot.scheduledAt,
    estimatedAt: slot.scheduledAt + drift,
    driftMinutes: Math.round(drift / MINUTE),
    status: "upcoming",
  };
}

/** Countdown alerts a parent should have received by `now` ("20 min to go"). */
export function dueAlerts(
  eta: Eta,
  now: Timestamp,
  leads: Minutes[] = [60, 20, 5],
): Minutes[] {
  if (eta.status !== "upcoming") return [];
  return leads.filter((lead) => now >= eta.estimatedAt - lead * MINUTE);
}
