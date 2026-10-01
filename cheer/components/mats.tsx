"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Hand, Heart } from "lucide-react";
import type { RoutineRow } from "@/src/board.ts";
import { driftLabel, driftTone, formatClock } from "@/src/format.ts";
import { actions } from "@/lib/store";
import { useMeet } from "@/lib/use-meet";
import { ButtonLink, Chip } from "./ui";

export function Mats({ initialMat }: { initialMat?: string }) {
  const { boards, state } = useMeet();
  const homeMat = boards.find((b) => b.rows.some((r) => state.homeTeamIds.includes(r.team.id)))?.mat;
  const [mat, setMat] = useState(initialMat ?? homeMat ?? boards[0].mat);
  const board = boards.find((b) => b.mat === mat) ?? boards[0];

  // Keep the action (on the mat / up next) in view when switching mats.
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [mat]);
  const focusId = (board.onMat ?? board.upNext)?.team.id;

  return (
    <>
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist">
        {boards.map((b) => (
          <button
            key={b.mat}
            role="tab"
            aria-selected={b.mat === mat}
            onClick={() => setMat(b.mat)}
            className={`h-11 rounded-xl text-sm font-bold ${b.mat === mat ? "bg-mat text-ink" : "text-muted"}`}
          >
            Mat {b.mat}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-4xl uppercase">Mat {board.mat}</h1>
        <Chip tone={driftTone(board.driftMinutes)}>{driftLabel(board.driftMinutes)}</Chip>
      </div>
      <p className="mt-1 text-sm text-muted">
        Times update live as fans tap teams onto the mat.
      </p>

      <ol className="mt-4 space-y-2">
        {board.rows.map((row) => (
          <li key={row.team.id} ref={row.team.id === focusId ? focusRef : undefined} className="scroll-mt-24">
            <Row row={row} isUpNext={row.team.id === board.upNext?.team.id} />
          </li>
        ))}
      </ol>
    </>
  );
}

function Row({ row, isUpNext }: { row: RoutineRow; isUpNext: boolean }) {
  const { meet, state, now } = useMeet();
  const { team, eta } = row;
  const mine = state.homeTeamIds.includes(team.id);
  const tapped = state.taps.some((t) => t.teamId === team.id);
  const voted = state.ballots.some((b) => b.teamId === team.id);
  const done = eta.status === "done";
  const onMat = eta.status === "on-mat";

  return (
    <div
      className={`rounded-2xl border p-3 ${
        onMat ? "pulse-ring border-mat bg-mat/10" : mine ? "border-bow/50 bg-surface" : "border-line bg-surface"
      } ${done && !row.votingOpen ? "opacity-55" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 text-right tabular-nums">
          <p className="text-sm font-bold">{formatClock(eta.estimatedAt, meet.timeZone)}</p>
          {eta.driftMinutes !== 0 && (
            <p className="text-[11px] text-muted line-through">{formatClock(eta.scheduledAt, meet.timeZone)}</p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-bold">
            {mine && <Heart size={14} className="shrink-0 fill-bow text-bow" aria-label="Your team" />}
            {team.name}
          </p>
          <p className="truncate text-xs text-muted">
            {team.gym} · {team.division}
          </p>
        </div>
        <div className="shrink-0">
          {onMat && !row.votingOpen && <Chip tone="mat">On the mat</Chip>}
          {done && !row.votingOpen && <Check size={18} className="text-muted" aria-label="Done" />}
          {row.votingOpen &&
            (mine ? (
              <Chip tone={onMat ? "mat" : "muted"}>{onMat ? "On the mat" : "Done"}</Chip>
            ) : voted ? (
              <Chip tone="go">Voted</Chip>
            ) : (
              <ButtonLink href={`/meet/vote/${team.id}`} className="h-10 px-4 text-sm">
                Vote
              </ButtonLink>
            ))}
        </div>
      </div>

      {isUpNext && (
        <button
          disabled={tapped}
          onClick={() => actions.tap({ teamId: team.id, at: now })}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-mat/60 text-sm font-bold text-mat disabled:border-line disabled:text-muted"
        >
          {tapped ? (
            <>
              <Check size={16} /> Thanks! Waiting for another fan to confirm
            </>
          ) : (
            <>
              <Hand size={16} /> They just took the mat
            </>
          )}
        </button>
      )}
    </div>
  );
}
