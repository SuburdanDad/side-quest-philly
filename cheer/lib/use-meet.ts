"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { buildCrowdPlan, crowdAt } from "@/src/demo/crowd.ts";
import { meetNow } from "@/src/demo/clock.ts";
import { buildBoards } from "@/src/board.ts";
import { useJudgeyState } from "./store";

const PLAN = buildCrowdPlan(DEMO_MEET);

// One shared 1-second ticker for real time. 0 on the server / before hydration.
let realNow = 0;
const tickListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  if (!timer) {
    realNow = Date.now();
    timer = setInterval(() => {
      realNow = Date.now();
      tickListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useRealNow(): number {
  return useSyncExternalStore(subscribeTick, () => realNow, () => 0);
}

/** Meet + this device's state + simulated crowd, merged into one live view. */
export function useMeet() {
  const state = useJudgeyState();
  const real = useRealNow();
  const now = meetNow(state.clock, real);

  return useMemo(() => {
    const crowd = crowdAt(PLAN, now);
    const taps = [...crowd.taps, ...state.taps];
    const ballots = [...crowd.ballots, ...state.ballots];
    const boards = buildBoards(DEMO_MEET, taps, now);
    return {
      meet: DEMO_MEET,
      state,
      now,
      ready: real !== 0,
      taps,
      ballots,
      boards,
      teamById: (id: string) => DEMO_MEET.teams.find((t) => t.id === id),
    };
  }, [now, state, real]);
}
