import type { Metadata } from "next";
import { TIMS_FAVORITES } from "@/lib/data/secret-quests";
import { SecretQuestClient } from "./secret-quest-client";

export const metadata: Metadata = {
  title: "Tim's Favorites — Side Quest Philadelphia",
  description:
    "A secret side quest with Tim's personal favorite things to do in Philadelphia. Unlock it by completing 2 neighborhoods.",
  openGraph: {
    title: "Tim's Favorites — Side Quest Philadelphia",
    description:
      "A secret side quest with deep cuts from a real Philadelphian.",
  },
};

export default function TimsFavoritesPage() {
  return <SecretQuestClient quest={TIMS_FAVORITES} />;
}
