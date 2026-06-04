import { describe, it, expect } from "vitest";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";

function computeDerived(completed: string[]) {
  const completedNeighborhoods = NEIGHBORHOODS.filter((n) =>
    n.objectives.every((o) => completed.includes(o.id)),
  ).map((n) => n.id);

  const ultimateCompleted = ULTIMATE_QUEST_IDS.every((uid) =>
    completed.includes(uid),
  );

  return { completedNeighborhoods, ultimateCompleted };
}

describe("Quest progress computation", () => {
  it("empty objectives yields no completions", () => {
    const { completedNeighborhoods, ultimateCompleted } = computeDerived([]);
    expect(completedNeighborhoods).toHaveLength(0);
    expect(ultimateCompleted).toBe(false);
  });

  it("partial objectives do not complete a neighborhood", () => {
    const rittIds = NEIGHBORHOODS.find((n) => n.id === "rittenhouse")!
      .objectives.map((o) => o.id)
      .slice(0, 4);
    const { completedNeighborhoods } = computeDerived(rittIds);
    expect(completedNeighborhoods).not.toContain("rittenhouse");
  });

  it("all 5 objectives complete a neighborhood", () => {
    const rittIds = NEIGHBORHOODS.find((n) => n.id === "rittenhouse")!
      .objectives.map((o) => o.id);
    const { completedNeighborhoods } = computeDerived(rittIds);
    expect(completedNeighborhoods).toContain("rittenhouse");
    expect(completedNeighborhoods).toHaveLength(1);
  });

  it("completing multiple neighborhoods", () => {
    const ritt = NEIGHBORHOODS.find((n) => n.id === "rittenhouse")!.objectives.map((o) => o.id);
    const oldc = NEIGHBORHOODS.find((n) => n.id === "old-city")!.objectives.map((o) => o.id);
    const { completedNeighborhoods } = computeDerived([...ritt, ...oldc]);
    expect(completedNeighborhoods).toContain("rittenhouse");
    expect(completedNeighborhoods).toContain("old-city");
    expect(completedNeighborhoods).toHaveLength(2);
  });

  it("ultimate quest requires all IDs", () => {
    const { ultimateCompleted } = computeDerived([...ULTIMATE_QUEST_IDS]);
    expect(ultimateCompleted).toBe(true);
  });

  it("ultimate quest not complete with partial IDs", () => {
    const { ultimateCompleted } = computeDerived(ULTIMATE_QUEST_IDS.slice(0, 5));
    expect(ultimateCompleted).toBe(false);
  });

  it("toggle off removes an objective correctly", () => {
    const completed = ["ritt-01", "ritt-02", "oldc-01"];
    const toggled = completed.filter((id) => id !== "ritt-01");
    expect(toggled).toEqual(["ritt-02", "oldc-01"]);
  });

  it("toggle on adds an objective correctly", () => {
    const completed = ["ritt-01"];
    const id = "ritt-02";
    const toggled = completed.includes(id)
      ? completed.filter((o) => o !== id)
      : [...completed, id];
    expect(toggled).toEqual(["ritt-01", "ritt-02"]);
  });
});

describe("Progress merge (sync-on-login)", () => {
  it("union merges local and remote objectives", () => {
    const local = ["ritt-01", "ritt-02", "oldc-01"];
    const remote = ["ritt-02", "ritt-03", "midv-01"];
    const merged = [...new Set([...local, ...remote])];
    expect(merged).toHaveLength(5);
    expect(merged).toContain("ritt-01");
    expect(merged).toContain("ritt-02");
    expect(merged).toContain("ritt-03");
    expect(merged).toContain("oldc-01");
    expect(merged).toContain("midv-01");
  });

  it("identifies new objectives to push to remote", () => {
    const local = ["ritt-01", "ritt-02", "oldc-01"];
    const remote = ["ritt-02"];
    const merged = [...new Set([...local, ...remote])];
    const newToRemote = merged.filter((id) => !remote.includes(id));
    expect(newToRemote).toEqual(["ritt-01", "oldc-01"]);
  });

  it("handles empty local progress", () => {
    const local: string[] = [];
    const remote = ["ritt-01", "ritt-02"];
    const merged = [...new Set([...local, ...remote])];
    expect(merged).toEqual(["ritt-01", "ritt-02"]);
  });

  it("handles empty remote progress", () => {
    const local = ["ritt-01", "ritt-02"];
    const remote: string[] = [];
    const merged = [...new Set([...local, ...remote])];
    expect(merged).toEqual(["ritt-01", "ritt-02"]);
  });

  it("handles both empty", () => {
    const merged = [...new Set([...([] as string[]), ...([] as string[])])];
    expect(merged).toHaveLength(0);
  });

  it("merge preserves neighborhood completion detection", () => {
    const local = ["ritt-01", "ritt-02", "ritt-03"];
    const remote = ["ritt-04", "ritt-05"];
    const merged = [...new Set([...local, ...remote])];
    const { completedNeighborhoods } = computeDerived(merged);
    expect(completedNeighborhoods).toContain("rittenhouse");
  });
});
