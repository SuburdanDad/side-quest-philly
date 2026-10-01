import type { Metadata } from "next";
import { Vote } from "@/components/vote";

export const metadata: Metadata = { title: "Vote" };

// Dynamic: live meets aren't known at build time, so the team is resolved on the client.
export default async function VotePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <Vote teamId={teamId} />;
}
