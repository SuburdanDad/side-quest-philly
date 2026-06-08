import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = (await searchParams) ?? {};
  const xp = String(params.xp ?? "0");
  const stamps = String(params.stamps ?? "");
  const a = String(params.a ?? "0");
  const obj = String(params.obj ?? "0");

  const ogUrl = `/api/og/passport?xp=${xp}&stamps=${stamps}&a=${a}&obj=${obj}`;

  return {
    title: "Your Passport — Side Quest Philadelphia",
    description: `${obj} objectives completed, ${xp} XP earned. Explore Philly this summer.`,
    openGraph: {
      title: "My Side Quest Philadelphia Passport",
      description: `${obj} objectives completed, ${xp} XP earned. Explore Philly this summer.`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "My Side Quest Philadelphia Passport",
      description: `${obj} objectives completed, ${xp} XP earned.`,
      images: [ogUrl],
    },
  };
}

export default function PassportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
