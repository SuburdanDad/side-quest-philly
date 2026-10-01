"use client";

// useMeet(): the single MeetView every screen reads (docs/backend-spec.md §8).
// Both sources are always called (hooks never run conditionally); the device's
// selected meet decides which one the screens get.

import { DEMO_MEET } from "@/src/demo/meet.ts";
import { modeFor } from "./live-core";
import type { MeetView } from "./meet-view";
import { useDemoSource } from "./sources/demo";
import { useLiveSource } from "./sources/live";
import { useDeviceState } from "./store";
import { isLiveEnabled } from "./supabase";

export function useMeet(): MeetView {
  const { meetId } = useDeviceState();
  const mode = modeFor(meetId, isLiveEnabled, DEMO_MEET.id);
  const demo = useDemoSource(mode === "demo");
  const live = useLiveSource(mode === "live" ? meetId : null);
  return mode === "live" ? live : demo;
}
