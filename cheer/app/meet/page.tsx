import type { Metadata } from "next";
import { MyTeam } from "@/components/my-team";

export const metadata: Metadata = { title: "My Team" };

export default function MyTeamPage() {
  return <MyTeam />;
}
