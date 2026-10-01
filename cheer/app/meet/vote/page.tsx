import type { Metadata } from "next";
import { Suspense } from "react";
import { Vote } from "@/components/vote";

export const metadata: Metadata = { title: "Vote" };

// Static on purpose (/meet/vote?team=<id>): live meets aren't known at build
// time, so the team is resolved on the client, and the page works offline.
export default function VotePage() {
  return (
    <Suspense>
      <Vote />
    </Suspense>
  );
}
