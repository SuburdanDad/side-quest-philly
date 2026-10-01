import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { Vote } from "@/components/vote";

export const metadata: Metadata = { title: "Vote" };

export function generateStaticParams() {
  return DEMO_MEET.teams.map((t) => ({ teamId: t.id }));
}

export default async function VotePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!DEMO_MEET.teams.some((t) => t.id === teamId)) notFound();
  return <Vote teamId={teamId} />;
}
