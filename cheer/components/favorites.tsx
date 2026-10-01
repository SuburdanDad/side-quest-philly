"use client";

import { useMemo } from "react";
import { Award as AwardIcon, Heart, Lock, Trophy } from "lucide-react";
import { closedTeamIds, findRow } from "@/src/board.ts";
import { AWARD_LABELS, awardWinner, crowdFavorites, tally } from "@/src/voting.ts";
import { AWARDS } from "@/src/types.ts";
import { useMeet } from "@/lib/use-meet";
import { Card, Chip, SectionTitle } from "./ui";

export function Favorites() {
  const { ballots, boards, now, state, teamById } = useMeet();

  const { tallies, top } = useMemo(() => {
    const closed = closedTeamIds(boards, now);
    const tallies = tally(ballots.filter((b) => closed.has(b.teamId)));
    return { tallies, top: crowdFavorites(tallies) };
  }, [ballots, boards, now]);

  return (
    <>
      <h1 className="font-display text-5xl leading-none uppercase">
        Crowd <span className="text-gold">Favorites</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Teams appear once their voting closes. We only ever show the top 5, never the bottom.
      </p>

      {top.length === 0 ? (
        <Card className="mt-5 text-center">
          <Trophy size={36} className="mx-auto text-gold" />
          <p className="mt-2 font-bold">No results yet</p>
          <p className="text-sm text-muted">The first Crowd Favorites land a few minutes after the first routines.</p>
        </Card>
      ) : (
        <ol className="mt-5 space-y-2">
          {top.map((t, i) => {
            const team = teamById(t.teamId)!;
            return (
              <li
                key={t.teamId}
                className={`flex items-center gap-4 rounded-3xl border p-4 ${
                  i === 0 ? "border-gold bg-gold/10" : "border-line bg-surface"
                }`}
              >
                <span className="w-8 text-center font-display text-4xl text-gold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {state.homeTeamIds.includes(t.teamId) && <Heart size={14} className="fill-bow text-bow" />}
                    {team.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {team.gym} · {team.division}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gold tabular-nums">★ {t.rating.toFixed(1)}</p>
                  <p className="text-xs text-muted tabular-nums">{t.votes} fans</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <SectionTitle>Shout-outs</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {AWARDS.map((a) => {
          const w = awardWinner(tallies, a);
          const team = w && teamById(w.teamId);
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

      {state.homeTeamIds.length > 0 && (
        <>
          <SectionTitle>Your team&apos;s recap</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-muted">Just for you. We never publish anyone&apos;s full results.</p>
          <div className="space-y-2">
            {state.homeTeamIds.map((id) => {
              const team = teamById(id)!;
              const t = tallies.get(id);
              const rank = top.findIndex((x) => x.teamId === id);
              const row = findRow(boards, id);
              return (
                <Card key={id}>
                  <p className="font-display text-2xl uppercase">{team.name}</p>
                  {!t ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <Lock size={14} />
                      {row?.startedAt === undefined
                        ? "Unlocks after they perform and voting closes."
                        : "Unlocks when voting closes."}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm">
                        <span className="font-bold text-bow">{t.votes} fans</span> cheered for {team.name}!
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rank >= 0 && <Chip tone="gold">#{rank + 1} Crowd Favorite</Chip>}
                        {AWARDS.filter((a) => t.awards[a] > 0)
                          .sort((a, b) => t.awards[b] - t.awards[a])
                          .map((a) => (
                            <Chip key={a} tone="muted">
                              {t.awards[a]}× {AWARD_LABELS[a]}
                            </Chip>
                          ))}
                      </div>
                    </>
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
