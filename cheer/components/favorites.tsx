"use client";

import { Award as AwardIcon, Heart, Hourglass, Lock, Trophy } from "lucide-react";
import { findRow } from "@/src/board.ts";
import type { Recap } from "@/src/results.ts";
import { AWARD_LABELS } from "@/src/voting.ts";
import { AWARDS } from "@/src/types.ts";
import { useMeet } from "@/lib/use-meet";
import { Card, Chip, SectionTitle } from "./ui";

/** Rendered only from the public board and this device's recaps (both computed by the server in live mode). */
export function Favorites() {
  const { board, recaps, boards, homeTeamIds, teamById } = useMeet();
  const recapFor = new Map(recaps.map((r) => [r.teamId, r]));

  return (
    <>
      <h1 className="font-display text-5xl leading-none uppercase">
        Crowd <span className="text-gold">Favorites</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Each division&apos;s results land after its last routine. We only ever show the top half (5 at most), never
        the bottom.
      </p>

      {board.top.length === 0 ? (
        <Card className="mt-5 text-center">
          <Trophy size={36} className="mx-auto text-gold" />
          <p className="mt-2 font-bold">No results yet</p>
          <p className="text-sm text-muted">The first Crowd Favorites land once a division wraps up.</p>
        </Card>
      ) : (
        <ol className="mt-5 space-y-2">
          {board.top.map((entry, i) => {
            const team = teamById(entry.teamId);
            return (
              <li
                key={entry.teamId}
                className={`flex items-center gap-4 rounded-3xl border p-4 ${
                  i === 0 ? "border-gold bg-gold/10" : "border-line bg-surface"
                }`}
              >
                <span className="w-8 text-center font-display text-4xl text-gold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {homeTeamIds.includes(entry.teamId) && <Heart size={14} className="fill-bow text-bow" />}
                    {team?.name ?? entry.teamId}
                  </p>
                  <p className="truncate text-xs text-muted">{team && `${team.gym} · ${team.division}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gold tabular-nums">★ {entry.rating.toFixed(1)}</p>
                  <p className="text-xs text-muted tabular-nums">{entry.votes} fans</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {board.pendingDivisions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {board.pendingDivisions.map((d) => (
            <li key={d} className="flex items-center gap-2 text-sm text-muted">
              <Hourglass size={14} className="shrink-0 text-gold" />
              {d} results land after its last routine
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Shout-outs</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {AWARDS.map((a) => {
          const id = board.awards[a];
          const team = id ? teamById(id) : undefined;
          return (
            <div key={a} className="rounded-3xl border border-line bg-surface p-4">
              <AwardIcon size={20} className="text-gold" />
              <p className="mt-2 text-[11px] font-bold tracking-wide text-gold uppercase">{AWARD_LABELS[a]}</p>
              <p className="truncate font-bold">{team ? team.name : "TBD"}</p>
              <p className="truncate text-xs text-muted">{team ? team.gym : "Waiting on votes"}</p>
            </div>
          );
        })}
      </div>

      {homeTeamIds.length > 0 && (
        <>
          <SectionTitle>Your team&apos;s recap</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-muted">Just for you. We never publish anyone&apos;s full results.</p>
          <div className="space-y-2">
            {homeTeamIds.map((id) => {
              const team = teamById(id);
              if (!team) return null;
              const recap = recapFor.get(id);
              const row = findRow(boards, id);
              return (
                <Card key={id}>
                  <p className="font-display text-2xl uppercase">{team.name}</p>
                  {recap ? (
                    <RecapBody recap={recap} teamName={team.name} />
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <Lock size={14} />
                      {row?.eta.status === "scratched"
                        ? "Scratched, so no recap for this one."
                        : row?.startedAt === undefined
                          ? "Unlocks after they perform and voting closes."
                          : "Unlocks when voting closes."}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function RecapBody({ recap, teamName }: { recap: Recap; teamName: string }) {
  const awards = AWARDS.filter((a) => (recap.awards[a] ?? 0) > 0).sort(
    (a, b) => (recap.awards[b] ?? 0) - (recap.awards[a] ?? 0),
  );
  return (
    <>
      <p className="mt-1 text-sm">
        {recap.votes === null ? (
          <span className="font-bold text-bow">Fans cheered for you!</span>
        ) : (
          <>
            <span className="font-bold text-bow">{recap.votes} fans</span> cheered for {teamName}!
          </>
        )}
      </p>
      {(recap.rank !== null || awards.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recap.rank !== null && <Chip tone="gold">#{recap.rank} Crowd Favorite</Chip>}
          {awards.map((a) => (
            <Chip key={a} tone="muted">
              {recap.awards[a]}× {AWARD_LABELS[a]}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}
