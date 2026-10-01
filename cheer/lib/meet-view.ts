// The one view every screen reads (docs/backend-spec.md §8), the same shape in
// demo and live mode. Built by lib/sources/demo.ts or lib/sources/live.ts and
// handed out by useMeet().

import type { MatBoard } from "@/src/board.ts";
import type { MeetBoard, Recap } from "@/src/results.ts";
import type { Starts } from "@/src/schedule.ts";
import type { Award, Meet, RoutineStatus, Team, Timestamp } from "@/src/types.ts";
import type { BallotError } from "@/src/voting.ts";
import { EMPTY_BOARD, type Freshness, type MyBallot, type PendingTap } from "./live-core";

export type Mode = "demo" | "live";

/** Operator-only fixes (live mode). Each resolves with an error message, or null when it worked. */
export interface OperatorActions {
  start(teamId: string): Promise<string | null>;
  clear(teamId: string): Promise<string | null>;
  setStatus(teamId: string, status: RoutineStatus): Promise<string | null>;
}

export interface MeetActions {
  /** Local-first: the UI is unblocked immediately, the server hears about it in the background. */
  checkIn(homeTeamIds: string[]): void;
  /** "They just took the mat." Live: goes through the tap outbox. */
  tap(teamId: string): void;
  /** Resolves with why the ballot was refused (null = counted). Rejects when there's no signal. */
  vote(teamId: string, stars: number, awards: Award[]): Promise<BallotError | null>;
  dismissAlert(key: string): void;
  op?: OperatorActions;
}

export interface MeetView {
  mode: Mode;
  meet: Meet;
  /** Meet clock: demo time, or device time corrected by the server clock offset. */
  now: Timestamp;
  /** Hydrated and the running order is known (from the network or the cache). */
  ready: boolean;
  freshness: Freshness;
  starts: Starts;
  boards: MatBoard[];
  teamById: (id: string) => Team | undefined;
  checkedIn: boolean;
  homeTeamIds: string[];
  myTappedTeamIds: string[];
  pendingTaps: PendingTap[];
  myBallots: Map<string, MyBallot>;
  board: MeetBoard;
  recaps: Recap[];
  isOperator: boolean;
  dismissedAlerts: string[];
  /** Live only: the server has no meet with this id. */
  notFound: boolean;
  actions: MeetActions;
}

const NOOP_ACTIONS: MeetActions = {
  checkIn: () => {},
  tap: () => {},
  vote: async () => null,
  dismissAlert: () => {},
};

/** A not-ready view: screens show a skeleton until `ready`. */
export function placeholderView(mode: Mode, meetId: string, overrides: Partial<MeetView> = {}): MeetView {
  return {
    mode,
    meet: { id: meetId, name: "", venue: "", city: "", timeZone: "UTC", startsAt: 0, mats: [], teams: [], slots: [] },
    now: 0,
    ready: false,
    freshness: { kind: "connecting" },
    starts: new Map(),
    boards: [],
    teamById: () => undefined,
    checkedIn: false,
    homeTeamIds: [],
    myTappedTeamIds: [],
    pendingTaps: [],
    myBallots: new Map(),
    board: EMPTY_BOARD,
    recaps: [],
    isOperator: false,
    dismissedAlerts: [],
    notFound: false,
    actions: NOOP_ACTIONS,
    ...overrides,
  };
}
