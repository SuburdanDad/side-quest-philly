import type { Metadata } from "next";
import { Favorites } from "@/components/favorites";

export const metadata: Metadata = { title: "Crowd Favorites" };

export default function FavoritesPage() {
  return <Favorites />;
}
