import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

/**
 * Portfolio mode: the suggestion inbox is retired with the Summer 2026
 * season. The page stays as a thank-you — and social stays open for
 * anyone who finds a spot that belongs on a quest.
 */
export default function SuggestionsPage() {
  return (
    <main className="flex-1">
      {/* Header */}
      <div className="bg-[#0F1D36] text-white relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B22234] via-[#C9A84C] to-[#3C3B6E]" />
        <div className="mx-auto max-w-lg px-4 pt-6 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl italic tracking-tight">
                Help Shape the Quest
              </h1>
              <p className="text-[11px] text-white/50 mt-0.5 font-bold uppercase tracking-wider">
                Suggestions · Summer 2026
              </p>
            </div>
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-[#C9A84C]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <section className="bg-card border rounded-xl p-8 text-center animate-content-enter">
          <p className="text-4xl mb-3">🗺️</p>
          <h2 className="font-heading text-2xl italic mb-2">
            The quest log is complete
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            The Summer 2026 season has wrapped, and with it the suggestion
            inbox. Every idea that shipped — Chapter II, the secret quest, the
            Ultimate Quest — started as a note from an explorer like you.
            Thank you.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Know a spot that still belongs on a quest? Tag{" "}
            <a
              href="https://x.com/SideQuestPhilly"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#C9A84C] hover:underline"
            >
              @SideQuestPhilly
            </a>{" "}
            with <span className="font-bold">#SideQuestPhilly</span>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-[#0F1D36] text-white px-6 py-3 text-sm font-bold hover:bg-[#0F1D36]/90 transition-colors"
          >
            Back to the quests
          </Link>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
