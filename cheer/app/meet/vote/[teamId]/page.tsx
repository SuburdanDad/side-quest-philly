import { redirect } from "next/navigation";

// Old links (/meet/vote/<team>) keep working: voting lives at /meet/vote?team=<team>.
export default async function LegacyVotePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  redirect(`/meet/vote?team=${encodeURIComponent(teamId)}`);
}
