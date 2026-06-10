"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lightbulb,
  MapPin,
  Sparkles,
  Bug,
  MessageCircle,
  Loader2,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAnonId } from "@/lib/analytics";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { SiteFooter } from "@/components/site-footer";

type Category = "spot" | "feature" | "bug" | "general";

const CATEGORIES: {
  id: Category;
  label: string;
  icon: typeof MapPin;
  placeholder: string;
}[] = [
  {
    id: "spot",
    label: "New spot",
    icon: MapPin,
    placeholder:
      "There's a mural at 5th & Berks everyone misses... / The best tacos in the city are at...",
  },
  {
    id: "feature",
    label: "Feature idea",
    icon: Sparkles,
    placeholder: "It would be awesome if the app could...",
  },
  {
    id: "bug",
    label: "Something's broken",
    icon: Bug,
    placeholder: "When I tried to..., the app...",
  },
  {
    id: "general",
    label: "Anything else",
    icon: MessageCircle,
    placeholder: "Tell us anything — what you loved, what felt off...",
  },
];

export default function SuggestionsPage() {
  const [category, setCategory] = useState<Category>("spot");
  const [neighborhood, setNeighborhood] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const active = CATEGORIES.find((c) => c.id === category)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const anonId = getAnonId();
    if (!supabase || !anonId || message.trim().length < 3) return;

    setStatus("sending");
    const { data, error } = await supabase.rpc("submit_suggestion", {
      p_anon_id: anonId,
      p_category: category,
      p_message: message.trim(),
      p_neighborhood: category === "spot" ? neighborhood || null : null,
      p_email: email.trim() || null,
    });

    if (error || data === false) {
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  function reset() {
    setMessage("");
    setStatus("idle");
  }

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
                Suggestions · we read every one
              </p>
            </div>
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-[#C9A84C]" />
            </div>
          </div>
          <p className="text-white/70 text-sm mt-3 leading-relaxed">
            This game grows all summer. Know a spot that belongs on a quest? A
            feature that would make exploring better? Tell us — the best ideas
            ship.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {status === "sent" ? (
          <section className="bg-card border rounded-xl p-8 text-center animate-content-enter">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-4 border-dashed border-[#C9A84C] bg-[#C9A84C]/10">
              <Check className="h-6 w-6 text-[#C9A84C]" />
            </div>
            <h2 className="font-heading text-2xl italic mb-1">
              Your idea is in the quest log!
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              We read every single one.
              {email.trim() &&
                " If it ships, you'll hear from us — explorers get credit."}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={reset}
                className="w-full rounded-xl bg-[#0F1D36] py-3 text-sm font-bold text-white hover:bg-[#0F1D36]/90 transition-colors"
              >
                Suggest another
              </button>
              <Link
                href="/"
                className="w-full rounded-xl border py-3 text-sm font-bold text-center hover:bg-muted transition-colors"
              >
                Back to the quests
              </Link>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-card border rounded-xl p-5 space-y-4 animate-content-enter"
          >
            {/* Category chips */}
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                What kind of idea?
              </label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const selected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        selected
                          ? "border-[#0F1D36] bg-[#0F1D36] text-white"
                          : "bg-background hover:border-foreground/20"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${selected ? "text-[#C9A84C]" : "text-muted-foreground"}`}
                      />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Neighborhood picker for spot ideas */}
            {category === "spot" && (
              <div>
                <label
                  htmlFor="neighborhood"
                  className="text-xs font-black uppercase tracking-wide text-muted-foreground"
                >
                  Which neighborhood?
                </label>
                <select
                  id="neighborhood"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Pick one (or skip)</option>
                  {NEIGHBORHOODS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.emoji} {n.name}
                    </option>
                  ))}
                  <option value="new-neighborhood">
                    🗺️ Somewhere new entirely
                  </option>
                </select>
              </div>
            )}

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="text-xs font-black uppercase tracking-wide text-muted-foreground"
              >
                The idea
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={3}
                maxLength={2000}
                rows={5}
                placeholder={active.placeholder}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="text-xs font-black uppercase tracking-wide text-muted-foreground"
              >
                Email{" "}
                <span className="font-normal normal-case tracking-normal">
                  (optional — explorers get credit when ideas ship)
                </span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive">
                Couldn&apos;t send right now — try again in a minute.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-[#0F1D36] py-3 text-sm font-bold text-white hover:bg-[#0F1D36]/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {status === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4 text-[#C9A84C]" />
              )}
              Send it in
            </button>
          </form>
        )}

        <SiteFooter />
      </div>
    </main>
  );
}
