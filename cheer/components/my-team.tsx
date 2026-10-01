"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, CircleSlash, HelpCircle, Megaphone, PartyPopper, Send, Users } from "lucide-react";
import { APP_NAME } from "@/src/brand.ts";
import { findRow, type RoutineRow } from "@/src/board.ts";
import { dueAlerts } from "@/src/schedule.ts";
import { formatClock, formatMmSs } from "@/src/format.ts";
import { etaCountdown, homeOrder, matChip } from "@/lib/eta-copy";
import { voteHref } from "@/lib/links";
import { shareUrl } from "@/lib/live-core";
import type { MeetView } from "@/lib/meet-view";
import { useMeet } from "@/lib/use-meet";
import { MatStatus } from "./mats";
import { checkInHref, selectMeetOnClick } from "./meet-shell";
import { Button, ButtonLink, Card, Chip, SectionTitle } from "./ui";

const LEADS = [60, 20, 5];

export function MyTeam() {
  const view = useMeet();
  const { boards, homeTeamIds, myBallots } = view;
  const home = homeTeamIds
    .map((id) => findRow(boards, id))
    .filter((r): r is RoutineRow => !!r)
    .sort(homeOrder);

  const open = boards.flatMap((b) => b.rows).filter((r) => r.votingOpen);
  const votable = open
    .filter((r) => !homeTeamIds.includes(r.team.id))
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <>
      <h1 className="sr-only">My Team</h1>
      {home.length === 0 ? (
        <Card>
          <p className="font-display text-3xl uppercase">Here to cheer</p>
          <p className="mt-1 text-muted">
            No home team? Even better: you can vote for everyone. Voting opens the moment a team takes the mat.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {home.map((row) => (
            <EtaCard key={row.team.id} row={row} view={view} />
          ))}
        </div>
      )}

      <ShareButton view={view} />
      <Link
        href={checkInHref(view)}
        prefetch={false}
        onClick={selectMeetOnClick(view.meet.id)}
        className="flex h-12 items-center justify-center gap-1.5 text-sm font-bold text-muted underline-offset-4 hover:underline"
      >
        <Users size={16} /> Change teams
      </Link>

      <SectionTitle>Voting open now</SectionTitle>
      {votable.length === 0 ? (
        <p className="text-sm text-muted">
          {open.length > 0
            ? "No other teams to vote on right now. Cheer loud!"
            : "Nobody's on the mat this second. Hang tight!"}
        </p>
      ) : (
        <div className="space-y-2">
          {votable.map((r) => (
            <VoteRow key={r.team.id} row={r} now={view.now} voted={myBallots.has(r.team.id)} />
          ))}
        </div>
      )}

      <SectionTitle>On the mats</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {boards.map((b) => (
          <Link key={b.mat} href={`/meet/mats?mat=${b.mat}`} className="rounded-3xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl uppercase">Mat {b.mat}</span>
              <ChevronRight size={18} className="text-muted" />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <MatStatus board={b} view={view} />
            </div>
            <p className="mt-3 text-[11px] font-bold tracking-wide text-mat uppercase">
              {b.onMat ? "On the mat" : "Up next"}
            </p>
            <p className="truncate font-bold">{(b.onMat ?? b.upNext)?.team.name ?? "All done"}</p>
            <p className="truncate text-xs text-muted">{(b.onMat ?? b.upNext)?.team.gym}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

function EtaCard({ row, view }: { row: RoutineRow; view: MeetView }) {
  const { now, meet, boards } = view;
  const { team, eta, slot } = row;
  const sent = dueAlerts(eta, now);
  const scheduled = formatClock(eta.scheduledAt, meet.timeZone);
  // No confirmed start on this mat yet: the time is just the schedule, not an "On time" estimate.
  const confirmed = boards.find((b) => b.mat === slot.mat)?.confirmed ?? false;
  const chip = matChip({ confirmed, driftMinutes: eta.driftMinutes });
  const countdown = etaCountdown(eta.estimatedAt, now);

  return (
    <Card
      className={
        eta.status === "on-mat" ? "pulse-ring border-mat" : eta.status === "scratched" ? "bg-ink!" : ""
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="mat">Mat {slot.mat}</Chip>
        {eta.status === "upcoming" && <Chip tone={chip.tone}>{chip.label}</Chip>}
        {eta.status === "scratched" && <Chip tone="late">Scratched</Chip>}
        <Chip>{team.division}</Chip>
      </div>
      <p className="mt-4 text-xs font-bold tracking-[0.18em] text-muted uppercase">{team.gym}</p>
      <p className="font-display text-4xl leading-tight uppercase">{team.name}</p>

      {eta.status === "upcoming" && (
        <>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">
                {countdown.overdue ? "Going on" : "Going on in"}
              </p>
              <p
                className={`font-display leading-none text-mat uppercase tabular-nums ${
                  countdown.text.length > 12 ? "text-4xl" : "text-6xl"
                }`}
              >
                {countdown.text}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">
                {confirmed ? "Around" : "Scheduled"}
              </p>
              <p className="font-display text-6xl leading-none uppercase tabular-nums">
                {formatClock(eta.estimatedAt, meet.timeZone)}
              </p>
            </div>
          </div>
          {eta.driftMinutes !== 0 && (
            <p className="mt-2 text-sm text-muted">
              Scheduled <span className="line-through">{scheduled}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Bell size={14} className="shrink-0" />
            <span>Keep {APP_NAME} open for 60/20/5 heads-ups</span>
            <span className="flex gap-1.5">
              {LEADS.map((lead) => (
                <span
                  key={lead}
                  className={`rounded-full px-2 py-0.5 font-bold ${sent.includes(lead) ? "bg-bow/15 text-bow" : "bg-surface-2"}`}
                >
                  {lead}
                </span>
              ))}
            </span>
          </div>
        </>
      )}

      {eta.status === "on-mat" && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-mat px-4 py-4 text-ink">
          <Megaphone size={28} />
          <div>
            <p className="font-display text-3xl leading-none uppercase">On the mat now</p>
            <p className="text-sm font-bold">Cheer loud!</p>
          </div>
        </div>
      )}

      {eta.status === "done" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold">
            <PartyPopper size={20} className="text-gold" /> That&apos;s a wrap!
          </p>
          <Link href="/meet/favorites" className="flex min-h-12 items-center text-sm font-bold text-gold">
            {row.votingOpen ? "Fans are voting…" : "See the crowd recap →"}
          </Link>
        </div>
      )}

      {eta.status === "skipped" && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <p className="flex items-center gap-2 font-bold text-late">
            <HelpCircle size={18} /> Not seen on the mat yet. Moved or scratched?
          </p>
          <p className="mt-1 text-sm text-muted">
            Scheduled {scheduled}. Later teams on Mat {slot.mat} have already gone. Check with your coach.
          </p>
        </div>
      )}

      {eta.status === "scratched" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CircleSlash size={16} /> Scratched from the running order (was {scheduled}).
        </p>
      )}
    </Card>
  );
}

/** "Send to another parent": the meet link, tagged so we can tell it was shared. */
function ShareButton({ view }: { view: MeetView }) {
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const url = shareUrl(window.location.origin, view.meet.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: APP_NAME, text: `When does your team go on at ${view.meet.name}? This knows.`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Paste it in the group chat!");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNote(url);
    }
  }

  return (
    <div className="mt-3">
      <Button variant="ghost" className="w-full" onClick={share}>
        <Send size={18} /> Send to another parent
      </Button>
      {note && (
        <p role="status" className="mt-2 text-center text-xs break-all text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

function VoteRow({ row, now, voted }: { row: RoutineRow; now: number; voted: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.team.name}</p>
        <p className="truncate text-xs text-muted">
          {row.team.gym} · Mat {row.slot.mat}
        </p>
        <p className="text-xs font-bold whitespace-nowrap text-bow tabular-nums">
          Closes in {formatMmSs((row.votingClosesAt ?? now) - now)}
        </p>
      </div>
      {voted ? (
        <Chip tone="go">Voted</Chip>
      ) : (
        <ButtonLink href={voteHref(row.team.id)} className="h-12 px-4 text-sm">
          Vote
        </ButtonLink>
      )}
    </div>
  );
}
