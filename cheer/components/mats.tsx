"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Hand, Heart, Loader2, WifiOff } from "lucide-react";
import type { MatBoard, RoutineRow } from "@/src/board.ts";
import { MINUTE } from "@/src/rules.ts";
import { tapRejection } from "@/src/schedule.ts";
import { driftLabel, driftTone, formatClock } from "@/src/format.ts";
import { TAP_MESSAGES } from "@/lib/live-core";
import type { MeetView, OperatorActions } from "@/lib/meet-view";
import { useMeet } from "@/lib/use-meet";
import { ButtonLink, Chip } from "./ui";

/** The tap button ignores clicks this long after the up-next team changes (no double-taps onto the next team). */
const TAP_GUARD_MS = 1500;
/** Past this, the mat chip says when the last start was confirmed. */
const STALE_ANCHOR_MS = 20 * MINUTE;

/** Drift chip, plus "last confirmed h:mm" once the newest confirmed start is getting old. */
export function MatStatus({ board, view }: { board: MatBoard; view: MeetView }) {
  const stale = board.lastConfirmedAt !== undefined && view.now - board.lastConfirmedAt > STALE_ANCHOR_MS;
  return (
    <>
      <Chip tone={driftTone(board.driftMinutes)}>{driftLabel(board.driftMinutes)}</Chip>
      {stale && <Chip>Last confirmed {formatClock(board.lastConfirmedAt!, view.meet.timeZone)}</Chip>}
    </>
  );
}

export function Mats({ initialMat }: { initialMat?: string }) {
  const view = useMeet();
  const { boards, homeTeamIds } = view;
  const homeMat = boards.find((b) => b.rows.some((r) => homeTeamIds.includes(r.team.id)))?.mat;
  const [mat, setMat] = useState(initialMat ?? homeMat ?? boards[0]?.mat);
  const board = boards.find((b) => b.mat === mat) ?? boards[0];

  // Keep the action (on the mat / up next) in view when switching mats.
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [mat]);

  if (!board) return <p className="text-muted">No running order yet.</p>;
  const focusId = (board.onMat ?? board.upNext)?.team.id;

  return (
    <>
      <div
        className="grid gap-1 rounded-2xl border border-line bg-surface p-1"
        style={{ gridTemplateColumns: `repeat(${boards.length}, minmax(0, 1fr))` }}
        role="tablist"
      >
        {boards.map((b) => (
          <button
            key={b.mat}
            role="tab"
            aria-selected={b.mat === board.mat}
            onClick={() => setMat(b.mat)}
            className={`h-12 rounded-xl text-sm font-bold ${b.mat === board.mat ? "bg-mat text-ink" : "text-muted"}`}
          >
            Mat {b.mat}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl uppercase">Mat {board.mat}</h1>
        <div className="flex flex-wrap gap-1">
          <MatStatus board={board} view={view} />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Times update live as fans tap teams onto the mat.</p>

      <TapPanel key={board.mat} board={board} view={view} />

      <ol className="mt-4 space-y-2">
        {board.rows.map((row) => (
          <li key={row.team.id} ref={row.team.id === focusId ? focusRef : undefined} className="scroll-mt-24">
            <Row row={row} view={view} isUpNext={row.team.id === board.upNext?.team.id} />
          </li>
        ))}
      </ol>
    </>
  );
}

/** "<Team> just took the mat", plus a disclosure for swaps and late teams. */
function TapPanel({ board, view }: { board: MatBoard; view: MeetView }) {
  const upId = board.upNext?.team.id;
  const [armedFor, setArmedFor] = useState(upId);
  useEffect(() => {
    if (armedFor === upId) return;
    const t = setTimeout(() => setArmedFor(upId), TAP_GUARD_MS);
    return () => clearTimeout(t);
  }, [armedFor, upId]);

  const others = board.tapCandidates.filter((r) => r.team.id !== upId);
  if (!board.upNext && others.length === 0) return null;

  return (
    <section className="mt-4" aria-label="Tap when a team takes the mat">
      {board.upNext && <TapButton row={board.upNext} view={view} primary guarded={armedFor !== upId} />}
      {others.length > 0 && (
        <details className="mt-2 rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-bold text-muted">
            Someone else on the mat?
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <p className="text-xs text-muted">Teams swap spots sometimes. Tap whoever is really out there.</p>
            {others.map((r) => (
              <TapButton key={r.team.id} row={r} view={view} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function TapButton({
  row,
  view,
  primary = false,
  guarded = false,
}: {
  row: RoutineRow;
  view: MeetView;
  primary?: boolean;
  guarded?: boolean;
}) {
  const id = row.team.id;
  const pending = view.pendingTaps.find((p) => p.teamId === id);
  const state = pending?.state ?? (view.myTappedTeamIds.includes(id) ? "sent" : "idle");
  const rejection = state === "idle" || state === "failed" ? tapRejection(view.meet, view.starts, id, view.now) : null;
  const busy = state === "sending" || state === "retrying" || state === "sent";

  const name = primary ? `${row.team.name} just took the mat` : `${row.team.name} took the mat`;
  const label = {
    idle: name,
    sending: "Sending…",
    retrying: "No signal, retrying…",
    sent: row.startedAt === undefined ? "Sent! Waiting for another fan" : "Sent! Thanks",
    failed: "Couldn't send",
  }[state];
  const Icon = { idle: Hand, sending: Loader2, retrying: WifiOff, sent: Check, failed: Hand }[state];
  const note = state === "failed" ? pending?.message : rejection ? TAP_MESSAGES[rejection] : null;

  return (
    <div>
      <button
        disabled={busy || rejection !== null || guarded}
        onClick={() => view.actions.tap(id)}
        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center font-bold transition active:scale-[0.98] disabled:active:scale-100 ${
          primary ? "text-base" : "text-sm"
        } ${
          state === "sent"
            ? "border border-go/50 bg-go/10 text-go"
            : state === "retrying" || state === "failed"
              ? "border border-late/50 bg-late/10 text-late"
              : primary
                ? "bg-mat text-ink disabled:opacity-40"
                : "border border-mat/60 text-mat disabled:opacity-40"
        }`}
      >
        <Icon size={18} className={`shrink-0 ${state === "sending" ? "motion-safe:animate-spin" : ""}`} />
        {label}
      </button>
      {note && (
        <p role="status" className={`mt-1.5 text-xs ${state === "failed" ? "text-late" : "text-muted"}`}>
          {note}
        </p>
      )}
    </div>
  );
}

function Row({ row, view, isUpNext }: { row: RoutineRow; view: MeetView; isUpNext: boolean }) {
  const { meet, homeTeamIds, myBallots, actions } = view;
  const { team, eta } = row;
  const mine = homeTeamIds.includes(team.id);
  const voted = myBallots.has(team.id);
  const done = eta.status === "done";
  const onMat = eta.status === "on-mat";
  const scratched = eta.status === "scratched";
  const skipped = eta.status === "skipped";

  return (
    <div
      className={`rounded-2xl border p-3 ${
        onMat ? "pulse-ring border-mat bg-mat/10" : mine ? "border-bow/50 bg-surface" : "border-line bg-surface"
      } ${(done && !row.votingOpen) || scratched ? "opacity-55" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 text-right tabular-nums">
          <p className={`text-sm font-bold ${scratched ? "line-through" : ""}`}>
            {formatClock(eta.estimatedAt, meet.timeZone)}
          </p>
          {eta.driftMinutes !== 0 && (
            <p className="text-[11px] text-muted line-through">{formatClock(eta.scheduledAt, meet.timeZone)}</p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-1.5 truncate font-bold ${scratched ? "line-through" : ""}`}>
            {mine && <Heart size={14} className="shrink-0 fill-bow text-bow" aria-label="Your team" />}
            {team.name}
          </p>
          <p className="truncate text-xs text-muted">
            {team.gym} · {team.division}
          </p>
          {skipped && <p className="mt-0.5 text-xs text-late">Not seen on the mat yet. Moved or scratched?</p>}
        </div>
        <div className="shrink-0">
          {scratched && <Chip tone="late">Scratched</Chip>}
          {skipped && <Clock size={18} className="text-late" aria-label="Not seen yet" />}
          {isUpNext && <Chip tone="mat">Up next</Chip>}
          {onMat && !row.votingOpen && <Chip tone="mat">On the mat</Chip>}
          {done && !row.votingOpen && <Check size={18} className="text-muted" aria-label="Done" />}
          {row.votingOpen &&
            (mine ? (
              <Chip tone={onMat ? "mat" : "muted"}>{onMat ? "On the mat" : "Done"}</Chip>
            ) : voted ? (
              <Chip tone="go">Voted</Chip>
            ) : (
              <ButtonLink href={`/meet/vote/${team.id}`} className="h-12 px-4 text-sm">
                Vote
              </ButtonLink>
            ))}
        </div>
      </div>
      {view.isOperator && actions.op && <OperatorControls row={row} op={actions.op} />}
    </div>
  );
}

/** Operator-only: fix any start in one tap. */
function OperatorControls({ row, op }: { row: RoutineRow; op: OperatorActions }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = row.team.id;
  const scratched = row.slot.status === "scratched";

  const run = async (what: string, fn: () => Promise<string | null>) => {
    setBusy(what);
    setError(null);
    setError(await fn());
    setBusy(null);
  };

  const cls =
    "flex h-12 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-xs font-bold text-gold uppercase disabled:opacity-40";
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        <button className={cls} disabled={!!busy || scratched} onClick={() => run("start", () => op.start(id))}>
          {busy === "start" ? "…" : "Start now"}
        </button>
        <button
          className={cls}
          disabled={!!busy || row.startedAt === undefined}
          onClick={() => run("clear", () => op.clear(id))}
        >
          {busy === "clear" ? "…" : "Clear"}
        </button>
        <button
          className={cls}
          disabled={!!busy}
          onClick={() => run("status", () => op.setStatus(id, scratched ? "scheduled" : "scratched"))}
        >
          {busy === "status" ? "…" : scratched ? "Unscratch" : "Scratch"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-late">{error}</p>}
    </div>
  );
}
