"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Heart, LayoutList, Pause, RotateCcw, Trophy, Users, Wifi, WifiOff, X } from "lucide-react";
import { APP_NAME } from "@/src/brand.ts";
import { SPEEDS } from "@/src/demo/clock.ts";
import { DEMO_MEET } from "@/src/demo/meet.ts";
import { findRow } from "@/src/board.ts";
import { dueAlerts } from "@/src/schedule.ts";
import { formatClock, formatCountdown } from "@/src/format.ts";
import { freshnessLabel } from "@/lib/live-core";
import type { MeetView } from "@/lib/meet-view";
import { deviceActions, useDeviceState } from "@/lib/store";
import { useMeet } from "@/lib/use-meet";
import { ButtonLink, Chip, Skeleton } from "./ui";

const TABS = [
  { href: "/meet", label: "My Team", icon: Heart, match: (p: string) => p === "/meet" },
  {
    href: "/meet/mats",
    label: "Mats",
    icon: LayoutList,
    match: (p: string) => p.startsWith("/meet/mats") || p.startsWith("/meet/vote"),
  },
  { href: "/meet/favorites", label: "Favorites", icon: Trophy, match: (p: string) => p.startsWith("/meet/favorites") },
];

/** Check-in link for this meet (the demo needs no param). */
export const checkInHref = (view: MeetView) => (view.mode === "live" ? `/?meet=${view.meet.id}` : "/");

export function MeetShell({ children }: { children: ReactNode }) {
  const view = useMeet();
  const pathname = usePathname();
  const demoClockStarted = useDeviceState().demo.clock.anchorReal !== 0;
  const { mode, ready, checkedIn, notFound } = view;

  useEffect(() => {
    if (mode === "demo" && checkedIn && !demoClockStarted) deviceActions.startDemoClock();
  }, [mode, checkedIn, demoClockStarted]);

  if (notFound) {
    return (
      <Centered title="Meet not found">
        <p className="text-muted">That link doesn&apos;t match a meet we know. Double-check it, or try the demo.</p>
        <ButtonLink href={`/?meet=${DEMO_MEET.id}`}>Try the demo meet</ButtonLink>
      </Centered>
    );
  }

  if (ready && !checkedIn) {
    return (
      <Centered title="Check in first">
        <p className="text-muted">Tell us which squad you&apos;re here to see.</p>
        <ButtonLink href={checkInHref(view)}>Check in</ButtonLink>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <Header view={view} />
      {ready && <AlertBanner view={view} />}
      <main className="mx-auto max-w-[480px] px-4 pt-4">{ready ? children : <LoadingCards />}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid h-16 max-w-[480px] grid-cols-3">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide uppercase ${
                    active ? "text-bow" : "text-muted"
                  }`}
                >
                  <Icon size={22} className={active ? "fill-bow/20" : ""} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Centered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[480px] place-content-center gap-4 px-4 text-center">
      <p className="font-display text-4xl uppercase">{title}</p>
      {children}
    </main>
  );
}

/** First load with nothing cached: the shape of the screen, never a blank page. */
function LoadingCards() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the running order">
      <Skeleton className="h-64" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

function Header({ view }: { view: MeetView }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      {/* Until hydrated we don't know the mode yet: no demo clock flash for live fans. */}
      {view.mode === "demo" && view.ready ? (
        <DemoClock view={view} />
      ) : (
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between gap-3 px-4">
          <Brand view={view} />
          {view.mode === "live" && <FreshnessChip view={view} />}
        </div>
      )}
    </header>
  );
}

function Brand({ view }: { view: MeetView }) {
  return (
    <Link href="/meet" className="min-w-0">
      <span className="font-display text-2xl leading-none uppercase">
        {APP_NAME}
        <span className="text-bow">.</span>
      </span>
      <span className="block truncate text-[11px] text-muted">
        {view.isOperator && <span className="font-bold text-gold uppercase">Operator · </span>}
        {view.meet.name || "\u00a0"}
      </span>
    </Link>
  );
}

/** Live mode: how fresh the times on screen are. */
function FreshnessChip({ view }: { view: MeetView }) {
  const f = view.freshness;
  const tone = f.kind === "live" ? "go" : f.kind === "offline" ? "late" : "muted";
  const Icon = f.kind === "offline" ? WifiOff : Wifi;
  return (
    <span role="status" className="shrink-0">
      <Chip tone={tone}>
        <Icon size={12} />
        {freshnessLabel(f, view.meet.timeZone)}
      </Chip>
    </span>
  );
}

/** Demo mode only: the meet clock, its speeds, restart, change teams. */
function DemoClock({ view }: { view: MeetView }) {
  const [open, setOpen] = useState(false);
  const speed = useDeviceState().demo.clock.speed;
  return (
    <>
      <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between gap-3 px-4">
        <Brand view={view} />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-bold tabular-nums"
        >
          <span className="text-mat">DEMO</span>
          {formatClock(view.now, view.meet.timeZone)}
          <span className="text-muted">{speed === 0 ? "paused" : `${speed}×`}</span>
        </button>
      </div>
      {open && (
        <div className="mx-auto max-w-[480px] px-4 pb-4">
          <p className="mb-2 text-xs text-muted">
            Demo clock: a simulated crowd taps teams onto the mat and votes. Speed it up to watch a meet unfold.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => deviceActions.setDemoSpeed(s)}
                aria-label={s === 0 ? "Pause" : `${s}× speed`}
                aria-pressed={speed === s}
                className={`flex h-12 items-center justify-center rounded-xl border text-sm font-bold ${
                  speed === s ? "border-mat bg-mat/15 text-mat" : "border-line bg-surface"
                }`}
              >
                {s === 0 ? <Pause size={16} /> : `${s}×`}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => deviceActions.restartDemo()}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-bold"
            >
              <RotateCcw size={16} /> Restart demo
            </button>
            <Link
              href="/"
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-bold"
            >
              <Users size={16} /> Change teams
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** The most urgent countdown alert for any of your teams ("Crown goes on in ~20 min"). */
function AlertBanner({ view }: { view: MeetView }) {
  const { boards, now, homeTeamIds, dismissedAlerts, meet, actions } = view;

  let alert: { key: string; text: string; leads: number[]; teamId: string; lead: number } | undefined;
  for (const teamId of homeTeamIds) {
    const row = findRow(boards, teamId);
    if (!row) continue;
    const due = dueAlerts(row.eta, now).filter((l) => !dismissedAlerts.includes(`${teamId}:${l}`));
    if (due.length === 0) continue;
    const lead = Math.min(...due);
    if (!alert || lead < alert.lead) {
      alert = {
        key: `${teamId}:${lead}`,
        teamId,
        lead,
        leads: due,
        text: `${row.team.name} goes on in ~${formatCountdown(row.eta.estimatedAt - now)} · Mat ${row.slot.mat}, ${formatClock(row.eta.estimatedAt, meet.timeZone)}`,
      };
    }
  }

  const key = alert?.key;
  useEffect(() => {
    // Browsers only allow vibration after the user has interacted with the page.
    if (key && navigator.userActivation?.hasBeenActive) navigator.vibrate?.([120, 60, 120]);
  }, [key]);

  if (!alert) return null;
  const { leads, teamId, text } = alert;
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-3">
      <div role="status" className="flex items-center gap-3 rounded-2xl bg-bow px-4 py-3 text-ink">
        <BellRing size={20} className="shrink-0" />
        <p className="flex-1 text-sm font-bold">{text}</p>
        <button
          aria-label="Dismiss"
          onClick={() => leads.forEach((l) => actions.dismissAlert(`${teamId}:${l}`))}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-ink/10"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
