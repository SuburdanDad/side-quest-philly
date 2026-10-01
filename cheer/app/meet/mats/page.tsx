import type { Metadata } from "next";
import { Mats } from "@/components/mats";

export const metadata: Metadata = { title: "Mats" };

export default async function MatsPage({ searchParams }: { searchParams: Promise<{ mat?: string }> }) {
  const { mat } = await searchParams;
  return <Mats key={mat ?? "default"} initialMat={mat} />;
}
