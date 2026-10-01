import type { Timestamp } from "./types.ts";

const MINUTE = 60_000;

export function formatClock(ts: Timestamp, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(ts);
}

/** "42 min", "1 hr 5 min", "Now" */
export function formatCountdown(ms: number): string {
  const mins = Math.ceil(ms / MINUTE);
  if (mins <= 0) return "Now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "7:05" for short countdowns like a voting window. */
export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function driftLabel(minutes: number): string {
  if (minutes >= 2) return `${minutes} min behind`;
  if (minutes <= -2) return `${-minutes} min ahead`;
  return "On time";
}

export type DriftTone = "late" | "go";
export const driftTone = (minutes: number): DriftTone => (minutes >= 2 ? "late" : "go");
