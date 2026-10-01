"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Heart, Lock, PartyPopper, Star } from "lucide-react";
import { findRow } from "@/src/board.ts";
import { formatClock, formatMmSs } from "@/src/format.ts";
import { AWARD_LABELS, OWN_TEAM_MESSAGE, validateBallot } from "@/src/voting.ts";
import { AWARDS, type Award, type Ballot } from "@/src/types.ts";
import { actions, currentDeviceId } from "@/lib/store";
import { useMeet } from "@/lib/use-meet";
import { Button, ButtonLink, Card, Chip, Stars } from "./ui";

const STAR_WORDS = ["", "Nice!", "Solid!", "Great!", "Amazing!", "Flawless!"];

export function Vote({ teamId }: { teamId: string }) {
  const { boards, now, state, meet } = useMeet();
  const [stars, setStars] = useState(0);
  const [awards, setAwards] = useState<Award[]>([]);
  const [error, setError] = useState<string | null>(null);

  const row = findRow(boards, teamId);
  if (!row) {
    return (
      <Card>
        <p className="font-display text-3xl uppercase">Team not found</p>
        <BackLink />
      </Card>
    );
  }
  const { team } = row;
  const myBallot = state.ballots.find((b) => b.teamId === teamId);

  const header = (
    <>
      <BackLink />
      <p className="mt-4 text-xs font-bold tracking-[0.18em] text-muted uppercase">
        {team.gym} · Mat {row.slot.mat}
      </p>
      <h1 className="font-display text-5xl leading-none uppercase">{team.name}</h1>
      <p className="mt-1 text-sm text-muted">{team.division}</p>
    </>
  );

  if (state.homeTeamIds.includes(teamId)) {
    return (
      <>
        {header}
        <Card className="mt-6 border-bow/40 text-center">
          <Heart size={40} className="mx-auto fill-bow text-bow" />
          <p className="mt-3 text-lg font-bold">{OWN_TEAM_MESSAGE}</p>
          <p className="mt-2 text-sm text-muted">Go cheer for everyone else while you wait.</p>
        </Card>
      </>
    );
  }

  if (myBallot) {
    return (
      <>
        {header}
        <Card className="mt-6 text-center">
          <PartyPopper size={40} className="mx-auto text-gold" />
          <p className="mt-3 font-display text-3xl uppercase">Your cheer is in!</p>
          <div className="mt-3 flex justify-center">
            <Stars value={myBallot.stars} size={28} />
          </div>
          {myBallot.awards.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {myBallot.awards.map((a) => (
                <Chip key={a} tone="gold">
                  {AWARD_LABELS[a]}
                </Chip>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            Crowd Favorites update once voting closes for {team.name}.
          </p>
          <ButtonLink href="/meet/mats" variant="ghost" className="mt-5 w-full">
            Back to the mats
          </ButtonLink>
        </Card>
      </>
    );
  }

  if (!row.votingOpen) {
    const notYet = row.startedAt === undefined;
    return (
      <>
        {header}
        <Card className="mt-6 text-center">
          {notYet ? <Clock size={40} className="mx-auto text-mat" /> : <Lock size={40} className="mx-auto text-muted" />}
          <p className="mt-3 font-display text-3xl uppercase">{notYet ? "Not on the mat yet" : "Voting closed"}</p>
          <p className="mt-2 text-sm text-muted">
            {notYet
              ? `Voting opens the moment ${team.name} takes the mat (around ${formatClock(row.eta.estimatedAt, meet.timeZone)}).`
              : "Voting closes a few minutes after each routine. Catch the next one!"}
          </p>
        </Card>
      </>
    );
  }

  const toggleAward = (a: Award) =>
    setAwards((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  async function submit() {
    const ballot: Ballot = { deviceId: currentDeviceId(), teamId, stars, awards, castAt: now };
    const err = validateBallot(ballot, {
      profile: { deviceId: ballot.deviceId, homeTeamIds: state.homeTeamIds },
      teamStartedAt: row!.startedAt,
      existing: state.ballots,
    });
    if (err) {
      setError(err.message);
      return;
    }
    actions.vote({ teamId, stars, awards, castAt: now });
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.7 },
      colors: ["#ff3d8b", "#2ec4ff", "#ffc83d", "#f5f3ff"],
      disableForReducedMotion: true,
    });
  }

  return (
    <>
      {header}
      <div className="mt-3">
        <Chip tone="bow">Voting closes in {formatMmSs((row.votingClosesAt ?? now) - now)}</Chip>
      </div>

      <Card className="mt-5">
        <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">How&apos;d they do?</p>
        <div className="mt-3 flex justify-between" role="radiogroup" aria-label="Stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setStars(n)}
              className="grid size-14 place-items-center rounded-2xl transition active:scale-90"
            >
              <Star size={40} className={n <= stars ? "fill-gold text-gold" : "text-line"} />
            </button>
          ))}
        </div>
        <p className="mt-2 h-6 text-center font-display text-xl text-gold uppercase">{STAR_WORDS[stars]}</p>
      </Card>

      <Card className="mt-3">
        <p className="text-xs font-bold tracking-[0.18em] text-muted uppercase">Shout-outs (optional)</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {AWARDS.map((a) => {
            const on = awards.includes(a);
            return (
              <button
                key={a}
                aria-pressed={on}
                onClick={() => toggleAward(a)}
                className={`h-12 rounded-xl border text-sm font-bold ${
                  on ? "border-gold bg-gold/15 text-gold" : "border-line bg-surface-2"
                }`}
              >
                {AWARD_LABELS[a]}
              </button>
            );
          })}
        </div>
      </Card>

      {error && <p className="mt-3 text-sm font-bold text-late">{error}</p>}
      <Button className="mt-5 w-full" disabled={stars === 0} onClick={submit}>
        {stars === 0 ? "Pick some stars" : "Send my cheer"}
      </Button>
      <p className="mt-3 text-center text-xs text-muted">
        One cheer per routine. Only the top Crowd Favorites are ever shown, never the bottom.
      </p>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/meet/mats" className="inline-flex h-10 items-center gap-1 text-sm font-bold text-muted">
      <ArrowLeft size={16} /> Mats
    </Link>
  );
}
