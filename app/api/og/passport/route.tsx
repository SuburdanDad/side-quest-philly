import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { LEVELS } from "@/lib/gamification/xp";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

// Neighborhood emoji grid positions (3x3)
const GRID_POSITIONS = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Parse query params: xp, stamps (comma-separated neighborhood ids), achievements count
  const xp = parseInt(params.get("xp") || "0", 10);
  const stampsParam = params.get("stamps") || "";
  const completedStamps = stampsParam ? stampsParam.split(",") : [];
  const achievementCount = parseInt(params.get("a") || "0", 10);
  const objectiveCount = parseInt(params.get("obj") || "0", 10);

  // Derive level from XP
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXP) currentLevel = level;
    else break;
  }

  const CELL = 72;
  const GAP = 8;
  const gridWidth = CELL * 3 + GAP * 2;
  const gridHeight = CELL * 3 + GAP * 2;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1D36",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Top gradient bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(to right, #B22234, #C9A84C, #3C3B6E)",
            display: "flex",
          }}
        />

        {/* Subtle background radials */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 15% 85%, rgba(201,168,76,0.12), transparent 50%), radial-gradient(circle at 85% 15%, rgba(60,59,110,0.15), transparent 50%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "48px 64px",
            gap: 48,
            position: "relative",
          }}
        >
          {/* Left side — stamp grid */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
            }}
          >
            {/* Stamp grid */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                width: gridWidth,
                gap: GAP,
              }}
            >
              {NEIGHBORHOODS.map((n, i) => {
                const isCompleted = completedStamps.includes(n.id);
                const pos = GRID_POSITIONS[i];
                return (
                  <div
                    key={n.id}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border: isCompleted
                        ? `3px solid ${n.color}`
                        : "2px dashed rgba(255,255,255,0.15)",
                      background: isCompleted
                        ? `${n.color}25`
                        : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 28,
                        filter: isCompleted ? "none" : "grayscale(1)",
                        opacity: isCompleted ? 1 : 0.25,
                        display: "flex",
                      }}
                    >
                      {n.emoji}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side — stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              gap: 8,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Side Quest Philadelphia
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: "white",
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              My Passport
            </div>

            {/* Level */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 40, display: "flex" }}>
                {currentLevel.emoji}
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#C9A84C",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                  }}
                >
                  {currentLevel.name}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.5)",
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  {xp} XP
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                gap: 32,
                marginTop: 24,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "white", display: "flex" }}>
                  {objectiveCount}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "flex",
                  }}
                >
                  Objectives
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "white", display: "flex" }}>
                  {completedStamps.length}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "flex",
                  }}
                >
                  Stamps
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "white", display: "flex" }}>
                  {achievementCount}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "flex",
                  }}
                >
                  Achievements
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            side-quest-philly.vercel.app · Summer 2026
          </span>
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
