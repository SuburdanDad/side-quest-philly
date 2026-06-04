import type { Metadata } from "next";
import { UltimateQuestClient } from "./ultimate-quest-client";

export const metadata: Metadata = {
  title: "Ultimate Philly Quest — Side Quest Philadelphia",
  description:
    "The ultimate Philadelphia scavenger hunt — 10 objectives spanning every corner of the city.",
};

export default function UltimatePage() {
  return <UltimateQuestClient />;
}
