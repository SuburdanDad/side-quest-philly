"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Search, Sparkles } from "lucide-react";
import { APP_NAME, TAGLINE } from "@/src/brand.ts";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { OWN_TEAM_MESSAGE } from "@/src/voting.ts";
import { actions, useJudgeyState } from "@/lib/store";
import { Button, ButtonLink, Card, Chip } from "./ui";

const meetDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: DEMO_MEET.timeZone,
}).format(DEMO_MEET.startsAt);

export function CheckIn() {
  const router = useRouter();
  const state = useJudgeyState();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = picked ?? state.homeTeamIds;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byGym = new Map<string, typeof DEMO_MEET.teams>();
    for (const t of DEMO_MEET.teams) {
      const hay = `${t.gym} ${t.name} ${t.division}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      byGym.set(t.gym, [...(byGym.get(t.gym) ?? []), t]);
    }
    return [...byGym].sort(([a], [b]) => a.localeCompare(b));
  }, [query]);

  const toggle = (id: string) =>
    setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const go = (ids: string[]) => {
    actions.checkIn(ids);
    router.push("/meet");
  };

  return (
    <main className="mx-auto max-w-[480px] px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-40">
      <header>
        <h1 className="font-display text-7xl leading-none tracking-tight uppercase">
          {APP_NAME}
          <span className="text-bow">.</span>
        </h1>
        <p className="mt-2 text-lg text-muted">{TAGLINE}</p>
      </header>

      {state.checkedIn && picked === null && (
        <Card className="mt-6 flex items-center justify-between gap-3 border-bow/40">
          <p className="text-sm">You&apos;re checked in.</p>
          <ButtonLink href="/meet" className="h-11 text-sm">
            Back to the meet
          </ButtonLink>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <Chip tone="bow">Demo meet</Chip>
          <Chip>Fictional teams</Chip>
        </div>
        <p className="mt-3 font-display text-3xl leading-tight uppercase">{DEMO_MEET.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={14} /> {DEMO_MEET.venue} · {DEMO_MEET.city} · {meetDate}
        </p>
      </Card>

      <h2 className="mt-8 font-display text-3xl uppercase">Which squad are you here to see?</h2>
      <p className="mt-2 text-sm text-muted">
        Pick as many as you like (siblings count). We&apos;ll tell you exactly when they go on.
      </p>

      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4">
        <Search size={18} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search gym, team or division"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted"
        />
      </label>

      <div className="mt-4 space-y-5">
        {groups.map(([gym, teams]) => (
          <section key={gym}>
            <h3 className="mb-2 text-xs font-bold tracking-[0.18em] text-muted uppercase">{gym}</h3>
            <div className="grid gap-2">
              {teams.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      on ? "border-bow bg-bow/10" : "border-line bg-surface"
                    }`}
                  >
                    <span>
                      <span className="block font-bold">{t.name}</span>
                      <span className="text-sm text-muted">{t.division}</span>
                    </span>
                    <span
                      className={`grid size-7 place-items-center rounded-full border ${
                        on ? "border-bow bg-bow text-ink" : "border-line"
                      }`}
                    >
                      {on && <Check size={16} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="text-muted">No teams match &ldquo;{query}&rdquo;.</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <p className="mb-2 flex items-start gap-1.5 text-xs text-muted">
            <Sparkles size={14} className="mt-px shrink-0 text-gold" />
            {OWN_TEAM_MESSAGE}
          </p>
          <Button className="w-full" disabled={selected.length === 0} onClick={() => go(selected)}>
            {selected.length === 0
              ? "Pick your team"
              : `Let's go${selected.length > 1 ? ` (${selected.length} teams)` : ""}`}
          </Button>
          <button
            onClick={() => go([])}
            className="mt-1 h-10 w-full text-sm font-medium text-muted underline-offset-4 hover:underline"
          >
            I&apos;m just here to cheer
          </button>
        </div>
      </div>
    </main>
  );
}
