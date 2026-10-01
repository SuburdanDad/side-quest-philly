"use client";

// The demo meet: a fictional running order, a simulated crowd that taps and
// votes by the rules, and a demo clock with speeds. Nothing leaves this phone;
// this device's own taps, ballots and check-in live in lib/store.ts.

import { buildBoards } from "@/src/board.ts";
import { meetNow } from "@/src/demo/clock.ts";
import { buildCrowdPlan, crowdAt } from "@/src/demo/crowd.ts";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { computeBoard, computeRecaps } from "@/src/results.ts";
import { confirmedStarts, tapRejection, type Starts } from "@/src/schedule.ts";
import type { Timestamp } from "@/src/types.ts";
import { validateBallot } from "@/src/voting.ts";
import type { PendingTap } from "../live-core";
import { placeholderView, type MeetActions, type MeetView } from "../meet-view";
import { deviceActions, getDeviceState, useDeviceState, type DemoState, type DeviceState } from "../store";
import { useRealNow } from "../ticker";

const PLAN = buildCrowdPlan(DEMO_MEET);
const TEAMS = new Map(DEMO_MEET.teams.map((t) => [t.id, t]));
const teamById = (id: string) => TEAMS.get(id);
const NONE: string[] = [];

/** Starts at `now`: the simulated crowd's taps plus this device's own. */
const startsAt = (demo: DemoState, now: Timestamp): Starts =>
  confirmedStarts(DEMO_MEET, [...crowdAt(PLAN, now).taps, ...demo.taps]);

/** Read fresh state at call time, so a handler never acts on a stale render. */
function current() {
  const s = getDeviceState();
  const now = meetNow(s.demo.clock, Date.now());
  return { s, now, starts: startsAt(s.demo, now) };
}

const ACTIONS: MeetActions = {
  checkIn: (homeTeamIds) => deviceActions.demoCheckIn(homeTeamIds),
  tap(teamId) {
    const { s, now, starts } = current();
    const mine = s.demo.taps.some((t) => t.teamId === teamId);
    if (!mine && tapRejection(DEMO_MEET, starts, teamId, now) === null) deviceActions.demoTap(teamId, now);
  },
  async vote(teamId, stars, awards) {
    const { s, now, starts } = current();
    const ballot = { deviceId: s.deviceId, teamId, stars, awards, castAt: now };
    const error = validateBallot(ballot, {
      profile: s.demo.profile,
      teamStartedAt: starts.get(teamId),
      existing: s.demo.ballots,
    });
    if (!error) deviceActions.demoVote(ballot);
    return error;
  },
  dismissAlert: (key) => deviceActions.dismissAlert(DEMO_MEET.id, key),
};

let memo: { demo: DemoState; dismissed: string[]; now: Timestamp; ready: boolean; view: MeetView } | undefined;

function demoView(device: DeviceState, realNow: number): MeetView {
  const { demo } = device;
  const ready = realNow !== 0;
  const now = ready ? meetNow(demo.clock, realNow) : demo.clock.anchorMeet;
  const dismissed = device.dismissedAlerts[DEMO_MEET.id] ?? NONE;
  if (memo && memo.demo === demo && memo.dismissed === dismissed && memo.now === now && memo.ready === ready) {
    return memo.view;
  }

  const starts = startsAt(demo, now);
  const ballots = [...crowdAt(PLAN, now).ballots, ...demo.ballots];
  const board = computeBoard(DEMO_MEET, starts, ballots, now);
  const homeTeamIds = demo.profile?.homeTeamIds ?? NONE;
  const myTappedTeamIds = [...new Set(demo.taps.map((t) => t.teamId))];
  // A demo tap reaches "the server" instantly: it waits for another fan until the crowd confirms.
  const pendingTaps: PendingTap[] = demo.taps
    .filter((t) => !starts.has(t.teamId))
    .map((t) => ({ teamId: t.teamId, state: "sent", at: t.at }));

  const view: MeetView = {
    mode: "demo",
    meet: DEMO_MEET,
    now,
    ready,
    freshness: { kind: "demo" },
    starts,
    boards: buildBoards(DEMO_MEET, starts, now),
    teamById,
    checkedIn: demo.profile !== null,
    homeTeamIds,
    myTappedTeamIds,
    pendingTaps,
    myBallots: new Map(demo.ballots.map((b) => [b.teamId, { stars: b.stars, awards: b.awards }])),
    board,
    recaps: computeRecaps(DEMO_MEET, starts, ballots, homeTeamIds, now, board),
    isOperator: false,
    dismissedAlerts: dismissed,
    notFound: false,
    actions: ACTIONS,
  };
  memo = { demo, dismissed, now, ready, view };
  return view;
}

const INACTIVE = placeholderView("demo", DEMO_MEET.id);

/** The demo meet's view. Always called (hooks run unconditionally); cheap when inactive. */
export function useDemoSource(active: boolean): MeetView {
  const device = useDeviceState();
  const realNow = useRealNow();
  return active ? demoView(device, realNow) : INACTIVE;
}
