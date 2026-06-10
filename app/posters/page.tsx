import type { Metadata } from "next";
import QRCode from "qrcode";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "QR Posters — Side Quest Philadelphia",
  robots: { index: false },
};

const BASE = "https://side-quest-philly.vercel.app";

async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 260,
    color: { dark: "#0F1D36", light: "#FFFFFF" },
  });
}

type Poster = {
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  svg: string;
};

export default async function PostersPage() {
  const master: Poster = {
    slug: "philly",
    title: "Side Quest Philadelphia",
    emoji: "🔔",
    tagline: "9 neighborhoods · 45 quests · 1 epic summer",
    svg: await qrSvg(`${BASE}/q/philly`),
  };

  const posters: Poster[] = [
    master,
    ...(await Promise.all(
      NEIGHBORHOODS.map(async (n) => ({
        slug: n.slug,
        title: n.name,
        emoji: n.emoji,
        tagline: n.tagline,
        svg: await qrSvg(`${BASE}/q/${n.slug}`),
      })),
    )),
  ];

  return (
    <main className="flex-1 bg-background">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden mx-auto max-w-lg px-4 py-8 text-center space-y-3">
        <h1 className="font-heading text-3xl italic">QR Posters</h1>
        <p className="text-sm text-muted-foreground">
          One master poster plus one per neighborhood. Print, tape them up in
          coffee shops and bar windows, and every scan lands in the funnel
          tagged with its source.
        </p>
        <PrintButton />
      </div>

      {/* Posters — one per printed page */}
      <div className="mx-auto max-w-lg px-4 pb-12 space-y-6 print:max-w-none print:space-y-0 print:p-0">
        {posters.map((poster) => (
          <section
            key={poster.slug}
            className="rounded-2xl border-2 border-[#0F1D36]/10 bg-white p-10 text-center print:rounded-none print:border-0 print:break-after-page print:flex print:min-h-screen print:flex-col print:items-center print:justify-center"
          >
            <div className="mx-auto flex h-1 w-24 rounded bg-gradient-to-r from-[#B22234] via-[#C9A84C] to-[#3C3B6E]" />
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.25em] text-[#C9A84C]">
              Free Summer Scavenger Hunt
            </p>
            <p className="mt-3 text-6xl">{poster.emoji}</p>
            <h2 className="font-heading mt-3 text-4xl italic text-[#0F1D36]">
              {poster.title}
            </h2>
            <p className="mt-1 text-sm italic text-[#6B6B6B]">
              &ldquo;{poster.tagline}&rdquo;
            </p>

            <div
              className="mx-auto mt-8 w-[260px]"
              dangerouslySetInnerHTML={{ __html: poster.svg }}
            />

            <p className="mt-6 text-lg font-black uppercase tracking-wide text-[#0F1D36]">
              Scan to play — no app, no signup
            </p>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Snap photos · AI verifies your quest · Earn your stamp
            </p>

            <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-[#6B6B6B]">
              #SideQuestPhilly · side-quest-philly.vercel.app
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
