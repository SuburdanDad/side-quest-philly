"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Loader2, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Only allow same-origin paths so ?next= can't be an open redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const next = safeNext(searchParams.get("next"));
  const forLeaderboard = next.startsWith("/leaderboard");

  // Already signed in? Go straight to the destination.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setErrorMessage("Authentication is not configured.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {forLeaderboard && (
            <div className="mx-auto w-11 h-11 rounded-full bg-[#C9A84C]/15 flex items-center justify-center mb-1">
              <Trophy className="h-5 w-5 text-[#C9A84C]" />
            </div>
          )}
          <CardTitle className="text-2xl">
            {forLeaderboard ? "Join the Leaderboard" : "Sign In"}
          </CardTitle>
          <CardDescription>
            {forLeaderboard
              ? "One email, no password — see the rankings and claim your spot among the City Legends."
              : "Save your progress across devices and unlock all features."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Check your email</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a magic link to <strong>{email}</strong>. Click it to
                  sign in.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStatus("idle")}
              >
                Try a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {status === "error" && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Magic Link
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No password needed. We&apos;ll email you a sign-in link.
              </p>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to quests
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
