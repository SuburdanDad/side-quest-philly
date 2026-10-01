"use client";

// One shared 1-second ticker for real (device) time. 0 on the server and
// during hydration, so "not ready yet" is easy to spot.

import { useSyncExternalStore } from "react";

let realNow = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    realNow = Date.now();
    timer = setInterval(() => {
      realNow = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useRealNow(): number {
  return useSyncExternalStore(subscribe, () => realNow, () => 0);
}
