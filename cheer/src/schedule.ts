// "When do we go on?" Spectators in the arena tap when a team takes the mat.
// When enough of them agree, that routine has a confirmed start. The latest
// confirmed routine on a mat (its anchor) shows how far the mat is running
// behind or ahead, and every later ETA walks forward from it; a scheduled break
// soaks up lateness. The same start opens the fan-vote window.
// Rules and edge cases: docs/backend-spec.md §2 (the SQL mirrors this file).

import { compareIds, MINUTE, RULES, SECOND } from "./rules.ts";
import type { MatTap, Meet, Minutes, Slot, Timestamp } from "./types.ts";

/** teamId → confirmed start (crowd median, or an operator's start). */
export type Starts = Map<string, Timestamp>;

export const isScratched = (slot: Slot): boolean => slot.status === "scratched";

/** Scheduled order: scheduledAt, then teamId (byte order) for exact ties. */
export function bySchedule(a: Slot, b: Slot): number {
  return a.scheduledAt - b.scheduledAt || compareIds(a.teamId, b.teamId);
}

/** A mat's non-scratched routines in scheduled order. */
export function matOrder(meet: Meet, mat: string): Slot[] {
  return meet.slots.filter((s) => s.mat === mat && !isScratched(s)).sort(bySchedule);
}

/** Position of the anchor (the confirmed routine scheduled last) in a mat order, or -1. */
export function anchorIndex(order: Slot[], starts: Starts): number {
  for (let k = order.length - 1; k >= 0; k--) if (starts.has(order[k].teamId)) return k;
  return -1;
}

/**
 * Crowd start for one routine, or undefined until minTaps distinct people tap
 * within clusterSeconds of each other. The start is the median of the taps from
 * the start of that cluster until freezeSeconds after the confirming tap, so a
 * late tap can't drag it and one early griefer can't confirm it alone.
 */
export function confirmedStart(
  slot: Slot,
  taps: MatTap[],
  minTaps: number = RULES.minTaps,
): Timestamp | undefined {
  const earliest = slot.scheduledAt - RULES.earlyTapMinutes * MINUTE;
  const first = new Map<string, Timestamp>(); // first tap per identity
  for (const tap of taps) {
    if (tap.teamId !== slot.teamId || tap.at < earliest) continue;
    const prev = first.get(tap.deviceId);
    if (prev === undefined || tap.at < prev) first.set(tap.deviceId, tap.at);
  }
  // The spec breaks ties by identity; only the times matter from here on.
  const t = [...first.values()].sort((a, b) => a - b);

  for (let j = minTaps - 1; j < t.length; j++) {
    const i = j - minTaps + 1;
    if (t[j] - t[i] > RULES.clusterSeconds * SECOND) continue;
    const freeze = t[j] + RULES.freezeSeconds * SECOND;
    const counted = t.filter((at) => at >= t[i] && at <= freeze);
    const m = counted.length >> 1;
    return counted.length % 2 ? counted[m] : Math.floor((counted[m - 1] + counted[m] + 1) / 2);
  }
  return undefined;
}

/** Crowd starts for every non-scratched routine, using the meet's minTaps. */
export function confirmedStarts(meet: Meet, taps: MatTap[]): Starts {
  const byTeam = new Map<string, MatTap[]>();
  for (const tap of taps) {
    const list = byTeam.get(tap.teamId);
    if (list) list.push(tap);
    else byTeam.set(tap.teamId, [tap]);
  }
  const starts: Starts = new Map();
  for (const slot of meet.slots) {
    if (isScratched(slot)) continue;
    const start = confirmedStart(slot, byTeam.get(slot.teamId) ?? [], meet.minTaps ?? RULES.minTaps);
    if (start !== undefined) starts.set(slot.teamId, start);
  }
  return starts;
}

export function anchorOf(meet: Meet, starts: Starts, mat: string): Slot | undefined {
  const order = matOrder(meet, mat);
  const a = anchorIndex(order, starts);
  return a < 0 ? undefined : order[a];
}

/** ms → whole minutes for display (never -0). */
export const roundMinutes = (ms: number): number => Math.round(ms / MINUTE) || 0;

/** How far behind (+) or ahead (-) a mat is running, in ms. Zero until its first confirmation. */
export function matDrift(meet: Meet, starts: Starts, mat: string): number {
  const anchor = anchorOf(meet, starts, mat);
  return anchor ? starts.get(anchor.teamId)! - anchor.scheduledAt : 0;
}

/** Median gap between consecutive routines in a mat order (even count: floor of the middle two's mean). */
export function usualGap(order: Slot[]): number {
  const gaps = order.slice(1).map((s, k) => s.scheduledAt - order[k].scheduledAt).sort((a, b) => a - b);
  if (gaps.length === 0) return 0;
  const m = gaps.length >> 1;
  return gaps.length % 2 ? gaps[m] : Math.floor((gaps[m - 1] + gaps[m]) / 2);
}

/** Estimated starts for one mat order (aligned with it). */
function estimateOrder(order: Slot[], starts: Starts): Timestamp[] {
  const a = anchorIndex(order, starts);
  const gap = usualGap(order);
  const breakGap = gap + RULES.breakExtraMinutes * MINUTE;
  const est: Timestamp[] = [];
  order.forEach((slot, k) => {
    const start = starts.get(slot.teamId);
    if (start !== undefined) est.push(start);
    else if (k < a || a < 0) est.push(slot.scheduledAt); // skipped, or nothing confirmed yet
    else {
      // After the anchor: keep each scheduled gap, except that a break gives a
      // running-late mat its time back (never past the schedule). Running early carries.
      const prev = order[k - 1];
      const g = slot.scheduledAt - prev.scheduledAt;
      const late = est[k - 1] - prev.scheduledAt > 0;
      est.push(g > breakGap && late ? Math.max(slot.scheduledAt, est[k - 1] + gap) : est[k - 1] + g);
    }
  });
  return est;
}

/** teamId → estimated start for every non-scratched routine (confirmed ones: their start). */
export function estimateStarts(meet: Meet, starts: Starts): Map<string, Timestamp> {
  const out = new Map<string, Timestamp>();
  for (const mat of new Set(meet.slots.map((s) => s.mat))) {
    const order = matOrder(meet, mat);
    estimateOrder(order, starts).forEach((at, k) => out.set(order[k].teamId, at));
  }
  return out;
}

export type TapRejection = "unknown-team" | "scratched" | "too-early" | "not-next" | "too-soon";

/**
 * Why this tap would be refused at `now`, or null if the routine is tappable:
 * the next tapLookahead routines after the anchor, the anchor itself (more
 * confirmations), and the tapLookbehind nearest unconfirmed routines before it
 * (late or swapped teams), never within minGapSeconds of the anchor's start.
 */
export function tapRejection(
  meet: Meet,
  starts: Starts,
  teamId: string,
  now: Timestamp,
): TapRejection | null {
  const slot = meet.slots.find((s) => s.teamId === teamId);
  if (!slot) return "unknown-team";
  if (isScratched(slot)) return "scratched";
  if (now < slot.scheduledAt - RULES.earlyTapMinutes * MINUTE) return "too-early";

  const order = matOrder(meet, slot.mat);
  const a = anchorIndex(order, starts);
  const unconfirmed = (s: Slot) => !starts.has(s.teamId);
  const candidates = order.slice(a + 1).filter(unconfirmed).slice(0, RULES.tapLookahead);
  if (a >= 0) {
    candidates.push(order[a]);
    candidates.push(...order.slice(0, a).filter(unconfirmed).reverse().slice(0, RULES.tapLookbehind));
  }
  if (!candidates.some((s) => s.teamId === teamId)) return "not-next";

  if (a >= 0 && order[a].teamId !== teamId) {
    if (now < starts.get(order[a].teamId)! + RULES.minGapSeconds * SECOND) return "too-soon";
  }
  return null;
}

export interface Eta {
  teamId: string;
  scheduledAt: Timestamp;
  estimatedAt: Timestamp;
  /** Rounded minutes behind (+) / ahead (-) of schedule, for display. */
  driftMinutes: number;
  /** 'skipped': not seen yet though a later routine went (no countdown, no alerts). */
  status: "upcoming" | "on-mat" | "done" | "skipped" | "scratched";
}

/** ETAs for every routine on a mat, scratched ones included. */
export function matEtas(meet: Meet, starts: Starts, mat: string, now: Timestamp): Map<string, Eta> {
  const out = new Map<string, Eta>();
  const eta = (slot: Slot, estimatedAt: Timestamp, status: Eta["status"]): Eta => ({
    teamId: slot.teamId,
    scheduledAt: slot.scheduledAt,
    estimatedAt,
    driftMinutes: roundMinutes(estimatedAt - slot.scheduledAt),
    status,
  });
  for (const slot of meet.slots) {
    if (slot.mat === mat && isScratched(slot)) out.set(slot.teamId, eta(slot, slot.scheduledAt, "scratched"));
  }

  const order = matOrder(meet, mat);
  const a = anchorIndex(order, starts);
  const est = estimateOrder(order, starts);
  order.forEach((slot, k) => {
    const start = starts.get(slot.teamId);
    const status =
      start !== undefined
        ? now < start + RULES.routineMinutes * MINUTE
          ? "on-mat"
          : "done"
        : k < a
          ? "skipped"
          : "upcoming";
    out.set(slot.teamId, eta(slot, est[k], status));
  });
  return out;
}

/** Estimated performance time and status for one team. */
export function etaFor(meet: Meet, starts: Starts, teamId: string, now: Timestamp): Eta | undefined {
  const slot = meet.slots.find((s) => s.teamId === teamId);
  return slot && matEtas(meet, starts, slot.mat, now).get(teamId);
}

/** Countdown alerts a parent should have received by `now` ("20 min to go"). Upcoming routines only. */
export function dueAlerts(eta: Eta, now: Timestamp, leads: Minutes[] = [60, 20, 5]): Minutes[] {
  if (eta.status !== "upcoming") return [];
  return leads.filter((lead) => now >= eta.estimatedAt - lead * MINUTE);
}
