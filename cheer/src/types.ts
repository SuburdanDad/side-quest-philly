// Core domain types. Teams only: no athlete names or photos (most athletes are minors).

export type Minutes = number;
/** Epoch milliseconds (always an integer). */
export type Timestamp = number;

export interface Team {
  id: string;
  name: string;
  gym: string;
  division: string;
}

export interface Meet {
  id: string;
  name: string;
  venue: string;
  city: string;
  /** IANA zone used for every displayed time. */
  timeZone: string;
  startsAt: Timestamp;
  mats: string[];
  teams: Team[];
  slots: Slot[];
  /** Distinct taps needed to confirm a start (default RULES.minTaps). */
  minTaps?: number;
}

export type RoutineStatus = "scheduled" | "scratched";

/** One routine on the published running order. */
export interface Slot {
  teamId: string;
  mat: string;
  scheduledAt: Timestamp;
  /** Missing means 'scheduled'. */
  status?: RoutineStatus;
}

/** A spectator tapped "they just took the mat". */
export interface MatTap {
  teamId: string;
  deviceId: string;
  at: Timestamp;
}

/** Set at check-in: "Which squad are you here to see?" */
export interface FanProfile {
  deviceId: string;
  /** Teams followed right now (ETAs, alerts). Editable freely. */
  homeTeamIds: string[];
  /** Every team ever followed at this meet; the own-team block keys on this. */
  everHomeTeamIds: string[];
}

export const AWARDS = ["stunts", "tumbling", "spirit", "dance"] as const;
export type Award = (typeof AWARDS)[number];

export interface Ballot {
  deviceId: string;
  teamId: string;
  /** Fan score, 1-5 stars. Only the top teams are ever shown publicly. */
  stars: number;
  /** Optional shout-outs: "Best Stunts", "Most Spirit", ... */
  awards: Award[];
  castAt: Timestamp;
}
