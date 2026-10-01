"use client";

import Link from "next/link";
import { Bell, ChevronRight, Megaphone, PartyPopper } from "lucide-react";
import { findRow, type RoutineRow } from "@/src/board.ts";
import { dueAlerts } from "@/src/schedule.ts";
import { driftLabel, driftTone, formatClock, formatCountdown, formatMmSs } from "@/src/format.ts";
import { useMeet } from "@/lib/use-meet";
import { ButtonLink, Card, Chip, SectionTitle } from "./ui";

export function MyTeam() {
  const { boards, state } = useMeet();
  const home = state.homeTeamIds
    .map((id) => findRow(boards, id))
    .filter((r): r is RoutineRow => !!r)
    .sort((a, b) => a.eta.estimatedAt - b.eta.estimatedAt);

  const votable = boards
    .flatMap((b) => b.rows)
    .filter((r) => r.votingOpen && !state.homeTeamIds.includes(r.team.id))
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <>
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
            <EtaCard key={row.team.id} row={row} />
          ))}
        </div>
      )}

      <SectionTitle>Voting open now</SectionTitle>
      {votable.length === 0 ? (
        <p className="text-sm text-muted">Nobody&apos;s on the mat this second. Hang tight!</p>
      ) : (
        <div className="space-y-2">
          {votable.map((r) => (
            <VoteRow key={r.team.id} row={r} />
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
            <p className={`mt-1 text-xs font-bold ${driftTone(b.driftMinutes) === "late" ? "text-late" : "text-go"}`}>
              {driftLabel(b.driftMinutes)}
            </p>
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

function EtaCard({ row }: { row: RoutineRow }) {
  const { now, meet } = useMeet();
  const { team, eta, slot } = row;
  const tone = driftTone(eta.driftMinutes);
  const sent = dueAlerts(eta, now);

  return (
    <Card className={eta.status === "on-mat" ? "pulse-ring border-mat" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="mat">Mat {slot.mat}</Chip>
        {eta.status === "upcoming" && <Chip tone={tone}>{driftLabel(eta.driftMinutes)}</Chip>}
        <Chip>{team.division}</Chip>
      </div>
      <p className="mt-4 text-xs font-bold tracking-[0.18em] text-muted uppercase">{team.gym}</p>
      <p className="font-display text-4xl leading-tight uppercase">{team.name}</p>

      {eta.status === "upcoming" && (
        <>
          <p className="mt-4 text-xs font-bold tracking-[0.18em] text-muted uppercase">Going on in</p>
          <p className="font-display text-7xl leading-none text-mat uppercase tabular-nums">
            {formatCountdown(eta.estimatedAt - now)}
          </p>
          <p className="mt-2 text-sm text-muted">
            ~{formatClock(eta.estimatedAt, meet.timeZone)}
            {eta.driftMinutes !== 0 && (
              <>
                {" "}
                · scheduled <span className="line-through">{formatClock(eta.scheduledAt, meet.timeZone)}</span>
              </>
            )}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Bell size={14} />
            {[60, 20, 5].map((lead) => (
              <span
                key={lead}
                className={`rounded-full px-2 py-0.5 font-bold ${
                  sent.includes(lead) ? "bg-bow/15 text-bow" : "bg-surface-2"
                }`}
              >
                {lead} min
              </span>
            ))}
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
          <Link href="/meet/favorites" className="text-sm font-bold text-gold">
            {row.votingOpen ? "Fans are voting…" : "See the crowd recap →"}
          </Link>
        </div>
      )}
    </Card>
  );
}

function VoteRow({ row }: { row: RoutineRow }) {
  const { now, state } = useMeet();
  const voted = state.ballots.some((b) => b.teamId === row.team.id);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.team.name}</p>
        <p className="truncate text-xs text-muted">
          {row.team.gym} · Mat {row.slot.mat} · closes in {formatMmSs((row.votingClosesAt ?? now) - now)}
        </p>
      </div>
      {voted ? (
        <Chip tone="go">Voted</Chip>
      ) : (
        <ButtonLink href={`/meet/vote/${row.team.id}`} className="h-11 px-4 text-sm">
          Vote
        </ButtonLink>
      )}
    </div>
  );
}
