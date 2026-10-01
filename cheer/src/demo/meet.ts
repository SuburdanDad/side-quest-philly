// A fictional demo meet. Every gym and team name here is made up.

import type { Meet, Slot, Team } from "../types.ts";

const MINUTE = 60_000;
/** Saturday Dec 5, 2026, 9:00 AM Eastern. */
const START = Date.UTC(2026, 11, 5, 14, 0);
/** Gap between routines on the same mat, as published. */
export const SLOT_MINUTES = 4;
/** Mat 1 stops for a 25-minute awards break after its 9th routine, so a late mat can catch up. */
export const BREAKS: Array<{ mat: string; afterRoutines: number; minutes: number }> = [
  { mat: "1", afterRoutines: 9, minutes: 25 },
];

const ROSTER: Array<[mat: string, name: string, gym: string, division: string]> = [
  ["1", "Sapphire", "Liberty Elite", "Youth 2"],
  ["1", "Thunder", "Northeast Storm", "Youth 2"],
  ["1", "Lady Bugs", "Brandywine Spirit", "Youth 2"],
  ["1", "Glitter Bombs", "Shore Thing Cheer", "Youth 2"],
  ["1", "Riot", "Schuylkill All Stars", "Junior 3"],
  ["1", "Hurricanes", "Keystone Cheer Co.", "Junior 3"],
  ["1", "Venom", "Delaware Valley Vipers", "Junior 3"],
  ["1", "Mavs", "Main Line Mavericks", "Junior 3"],
  ["1", "Crown", "Liberty Elite", "Junior 3"],
  ["1", "Lightning", "Northeast Storm", "Junior 3"],
  ["1", "Wildflowers", "Brandywine Spirit", "Junior 3"],
  ["1", "Riptide", "Shore Thing Cheer", "Junior 3"],
  ["2", "Royals", "Keystone Cheer Co.", "Senior 4"],
  ["2", "Fangs", "Delaware Valley Vipers", "Senior 4"],
  ["2", "Stallions", "Main Line Mavericks", "Senior 4"],
  ["2", "Diamonds", "Liberty Elite", "Senior 4"],
  ["2", "Cyclone", "Northeast Storm", "Senior 4"],
  ["2", "Uproar", "Schuylkill All Stars", "Senior 4"],
  ["2", "Black Ice", "Ironbound Athletics", "Senior Coed 5"],
  ["2", "Empire", "Keystone Cheer Co.", "Senior Coed 5"],
  ["2", "Cobra", "Delaware Valley Vipers", "Senior Coed 5"],
  ["2", "Legacy", "Liberty Elite", "Senior Coed 5"],
  ["2", "Steel", "Ironbound Athletics", "Senior Coed 5"],
  ["2", "Tsunami", "Shore Thing Cheer", "Senior Coed 5"],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function build(): Meet {
  const teams: Team[] = [];
  const slots: Slot[] = [];
  const perMat = new Map<string, number>();
  for (const [mat, name, gym, division] of ROSTER) {
    const id = slug(`${gym} ${name}`);
    teams.push({ id, name, gym, division });
    const i = perMat.get(mat) ?? 0;
    perMat.set(mat, i + 1);
    // Mat 2 opens 10 minutes after mat 1.
    const offset = mat === "1" ? 0 : 10;
    const breaks = BREAKS.filter((b) => b.mat === mat && i >= b.afterRoutines).reduce((m, b) => m + b.minutes, 0);
    slots.push({ teamId: id, mat, scheduledAt: START + (offset + i * SLOT_MINUTES + breaks) * MINUTE });
  }
  return {
    id: "winter-classic-2026",
    name: "Liberty Bell Winter Classic",
    venue: "Hall B",
    city: "Philadelphia, PA",
    timeZone: "America/New_York",
    startsAt: START,
    mats: ["1", "2"],
    teams,
    slots,
  };
}

export const DEMO_MEET: Meet = build();
