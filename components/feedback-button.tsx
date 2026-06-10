"use client";

import { useState } from "react";
import { MessageCircle, Loader2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAnonId } from "@/lib/analytics";

/**
 * "Tell us what you think" — the launch's listening post.
 * Writes through the rate-limited submit_feedback() function.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const anonId = getAnonId();
    if (!supabase || !anonId || message.trim().length < 3) return;

    setStatus("sending");
    const { data, error } = await supabase.rpc("submit_feedback", {
      p_anon_id: anonId,
      p_message: message.trim(),
      p_email: email.trim() || null,
    });

    if (error || data === false) {
      setStatus("error");
      return;
    }
    setStatus("sent");
    setMessage("");
    setEmail("");
    setTimeout(() => {
      setOpen(false);
      setStatus("idle");
    }, 1600);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#C9A84C] transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Tell us what you think
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div
            className="absolute inset-0 bg-[#0F1D36]/90 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card border p-5">
            {status === "sent" ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A84C]/15">
                  <Check className="h-6 w-6 text-[#C9A84C]" />
                </div>
                <p className="font-heading text-xl italic">Thank you!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every note makes the quest better.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-xl italic">
                    What do you think?
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Loved a spot? Found a bug? Photo judge too harsh? Tell us —
                  we read everything.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={4}
                  placeholder="The quest through Fishtown was..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — if you want a reply)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {status === "error" && (
                  <p className="text-xs text-destructive">
                    Couldn&apos;t send right now — try again in a minute.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full rounded-xl bg-[#0F1D36] py-2.5 text-sm font-bold text-white hover:bg-[#0F1D36]/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {status === "sending" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Send feedback
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
