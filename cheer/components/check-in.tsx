"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { APP_NAME, TAGLINE } from "@/src/brand.ts";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { RULES } from "@/src/rules.ts";
import type { Team } from "@/src/types.ts";
import { OWN_TEAM_MESSAGE } from "@/src/voting.ts";
import { resolveMeetId } from "@/lib/live-core";
import { claimOperator } from "@/lib/sources/live";
import { deviceActions, getDeviceState, useDeviceState } from "@/lib/store";
import { isLiveEnabled } from "@/lib/supabase";
import { useMeet } from "@/lib/use-meet";
import { Button, ButtonLink, Card, Chip, Skeleton } from "./ui";

/** "/" reads ?meet= (QR and group-chat links), ?src= (first touch) and ?op= (operator code). */
export function CheckIn() {
  return (
    <Suspense fallback={<CheckInFrame loading />}>
      <CheckInScreen />
    </Suspense>
  );
}

function CheckInScreen() {
  const params = useSearchParams();
  const meetParam = params.get("meet");
  const src = params.get("src");
  const op = params.get("op");
  const { meetId: storedMeetId } = useDeviceState();
  const target = resolveMeetId(meetParam, storedMeetId, isLiveEnabled, DEMO_MEET.id);
  const [opNote, setOpNote] = useState<{ ok: boolean; text: string } | null>(null);
  const claimed = useRef(false);

  useEffect(() => {
    // Fresh state, not the hydration snapshot: the device may already be following a meet.
    const meetId = resolveMeetId(meetParam, getDeviceState().meetId, isLiveEnabled, DEMO_MEET.id);
    if (meetParam !== null) deviceActions.selectMeet(meetId);
    deviceActions.recordSrc(meetId, src);
    if (!op || claimed.current) return;
    claimed.current = true;
    // The code is used once and never stored: take it out of the address bar right away.
    const url = new URL(window.location.href);
    url.searchParams.delete("op");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (meetId === DEMO_MEET.id) {
      setTimeout(() => setOpNote({ ok: false, text: "Operator mode only works for a live meet." }), 0);
      return;
    }
    claimOperator(meetId, op).then((error) =>
      setOpNote(error ? { ok: false, text: error } : { ok: true, text: "Operator mode is on for this phone." }),
    );
  }, [meetParam, src, op]);

  const view = useMeet();
  const showing = view.meet.id === target && view.ready;
  const fellBack = meetParam !== null && meetParam !== DEMO_MEET.id && target === DEMO_MEET.id;

  return (
    <CheckInFrame loading={!showing && !view.notFound}>
      {opNote && (
        <Card className={`mt-6 ${opNote.ok ? "border-gold/50" : "border-late/50"}`}>
          <p className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck size={18} className={opNote.ok ? "text-gold" : "text-late"} /> {opNote.text}
          </p>
        </Card>
      )}
      {fellBack && (
        <Card className="mt-6">
          <p className="text-sm text-muted">
            We couldn&apos;t open that meet here, so here&apos;s the demo meet to look around.
          </p>
        </Card>
      )}
      {view.notFound && view.meet.id === target ? (
        <Card className="mt-6">
          <p className="font-display text-3xl uppercase">Meet not found</p>
          <p className="mt-1 text-sm text-muted">That link doesn&apos;t match a meet we know. Check it, or look around the demo.</p>
          <ButtonLink href={`/?meet=${DEMO_MEET.id}`} variant="ghost" className="mt-4 w-full">
            Try the demo meet
          </ButtonLink>
        </Card>
      ) : (
        showing && <Picker key={target} />
      )}
      {!showing && !view.notFound && view.mode === "live" && (
        <p className="mt-6 text-center text-sm text-muted">
          {view.freshness.kind === "offline" ? "No signal yet. We'll keep trying…" : "Loading the running order…"}
        </p>
      )}
    </CheckInFrame>
  );
}

function CheckInFrame({ loading = false, children }: { loading?: boolean; children?: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[480px] px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-48">
      <header>
        <h1 className="font-display text-7xl leading-none tracking-tight uppercase">
          {APP_NAME}
          <span className="text-bow">.</span>
        </h1>
        <p className="mt-2 text-lg text-muted">{TAGLINE}</p>
      </header>
      {children}
      {loading && (
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading the meet">
          <Skeleton className="h-36" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}
    </main>
  );
}

function Picker() {
  const router = useRouter();
  const { meet, mode, checkedIn, homeTeamIds, actions } = useMeet();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = picked ?? homeTeamIds;
  const full = selected.length >= RULES.maxHomeTeams;

  // Scratched routines can't be followed (check_in would refuse them).
  const groups = useMemo(() => {
    const scratched = new Set(meet.slots.filter((s) => s.status === "scratched").map((s) => s.teamId));
    const q = query.trim().toLowerCase();
    const byGym = new Map<string, Team[]>();
    for (const t of meet.teams) {
      if (scratched.has(t.id)) continue;
      const hay = `${t.gym} ${t.name} ${t.division}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      byGym.set(t.gym, [...(byGym.get(t.gym) ?? []), t]);
    }
    return [...byGym].sort(([a], [b]) => a.localeCompare(b));
  }, [meet, query]);

  const meetDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: meet.timeZone,
  }).format(meet.startsAt);

  const toggle = (id: string) => {
    if (selected.includes(id)) setPicked(selected.filter((x) => x !== id));
    else if (!full) setPicked([...selected, id]);
  };

  const go = (ids: string[]) => {
    actions.checkIn(ids); // local-first: never waits on the network
    router.push("/meet");
  };

  return (
    <>
      {checkedIn && picked === null && (
        <Card className="mt-6 flex items-center justify-between gap-3 border-bow/40">
          <p className="text-sm">You&apos;re checked in.</p>
          <ButtonLink href="/meet" className="h-12 text-sm">
            Back to the meet
          </ButtonLink>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {mode === "demo" ? (
            <>
              <Chip tone="bow">Demo meet</Chip>
              <Chip>Fictional teams</Chip>
            </>
          ) : (
            <Chip tone="go">Live meet</Chip>
          )}
        </div>
        <p className="mt-3 font-display text-3xl leading-tight uppercase">{meet.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={14} className="shrink-0" /> {[meet.venue, meet.city, meetDate].filter(Boolean).join(" · ")}
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
                    disabled={!on && full}
                    className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:opacity-40 ${
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

      {mode === "live" && (
        <ButtonLink href={`/?meet=${DEMO_MEET.id}`} variant="ghost" className="mt-8 w-full text-sm">
          Just looking? Try the demo meet
        </ButtonLink>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <p className="mb-1 flex items-start gap-1.5 text-xs text-muted">
            <Sparkles size={14} className="mt-px shrink-0 text-gold" />
            {OWN_TEAM_MESSAGE}
          </p>
          <p className="mb-2 flex items-start gap-1.5 text-xs text-muted">
            <ShieldCheck size={14} className="mt-px shrink-0 text-go" />
            {mode === "live" ? "Anonymous. No names. Deleted 30 days after the meet." : "Demo meet: nothing leaves this phone."}
          </p>
          <Button className="w-full" disabled={selected.length === 0} onClick={() => go(selected)}>
            {selected.length === 0
              ? "Pick your team"
              : `Let's go${selected.length > 1 ? ` (${selected.length} teams)` : ""}`}
          </Button>
          <button
            onClick={() => go([])}
            className="mt-1 h-12 w-full text-sm font-medium text-muted underline-offset-4 hover:underline"
          >
            I&apos;m just here to cheer
          </button>
        </div>
      </div>
    </>
  );
}
