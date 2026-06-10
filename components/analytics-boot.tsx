"use client";

import { useEffect } from "react";
import { captureSrc } from "@/lib/analytics";

/** Captures the first-touch ?src= on any landing page. Renders nothing. */
export function AnalyticsBoot() {
  useEffect(() => {
    captureSrc();
  }, []);
  return null;
}
