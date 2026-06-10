import { NextResponse } from "next/server";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";

/**
 * QR deep links: /q/{slug} → the neighborhood quest, tagged with a
 * source so the funnel can attribute every scan. Unknown slugs land
 * on home with the source preserved.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const clean = (slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);
  const { origin } = new URL(request.url);

  const isNeighborhood = NEIGHBORHOODS.some((n) => n.slug === clean);
  const dest = isNeighborhood
    ? `/quest/${clean}?src=${encodeURIComponent(`qr-${clean}`)}`
    : `/?src=${encodeURIComponent(`qr-${clean || "unknown"}`)}`;

  return NextResponse.redirect(`${origin}${dest}`, 307);
}
