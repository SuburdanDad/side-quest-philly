import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NEIGHBORHOODS, getNeighborhoodBySlug } from "@/lib/data/neighborhoods";
import { QuestPageClient } from "./quest-page-client";

export function generateStaticParams() {
  return NEIGHBORHOODS.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const neighborhood = getNeighborhoodBySlug(slug);
  if (!neighborhood) return {};

  return {
    title: `${neighborhood.name} Quest — Side Quest Philadelphia`,
    description: `${neighborhood.description} Complete 5 objectives in the ${neighborhood.name} neighborhood.`,
    openGraph: {
      title: `${neighborhood.name} Quest — Side Quest Philadelphia`,
      description: neighborhood.description,
    },
  };
}

export default async function QuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const neighborhood = getNeighborhoodBySlug(slug);
  if (!neighborhood) notFound();

  return <QuestPageClient neighborhood={neighborhood} />;
}
