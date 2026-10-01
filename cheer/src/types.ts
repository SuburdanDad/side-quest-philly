// Core domain types. Teams only: no athlete names or photos (most athletes are minors).

export type Minutes = number;
/** Epoch milliseconds. */
export type Timestamp = number;

export interface Team {
  id: string;
  name: string;
  gym: string;
  division: string;
}

/** One routine on the published running order. */
export interface Slot {
  teamId: string;
  mat: string;
  scheduledAt: Timestamp;
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
  homeTeamIds: string[];
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
