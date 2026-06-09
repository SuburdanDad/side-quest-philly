import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Side Quest Philadelphia — Summer 2026 Scavenger Hunts celebrating America's 250th";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0F1D36";
const GOLD = "#C9A84C";
const AMBER = "#D97706";

export default async function Image() {
  const skylineBuffer = await readFile(
    join(process.cwd(), "public/og-skyline.jpg"),
  );
  const skylineBase64 = `data:image/jpeg;base64,${skylineBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Georgia, serif",
          background: NAVY,
        }}
      >
        {/* Skyline photo — full bleed */}
        <img
          src={skylineBase64}
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
          }}
        />

        {/* Warm sunset gradient — amber to navy */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(217,119,6,0.35) 0%, rgba(201,168,76,0.2) 30%, rgba(15,29,54,0.7) 60%, rgba(15,29,54,0.92) 100%)",
            display: "flex",
          }}
        />

        {/* Top accent line — warm gold */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(to right, ${AMBER}, ${GOLD}, ${AMBER})`,
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {/* Top badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 20px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: GOLD,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontWeight: 700,
                display: "flex",
              }}
            >
              Summer 2026 Scavenger Hunt
            </span>
          </div>

          {/* Main title */}
          <div
            style={{
              display: "flex",
              fontSize: 100,
              fontWeight: 900,
              color: "white",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            SIDE QUEST
          </div>

          {/* Divider line */}
          <div
            style={{
              display: "flex",
              width: 120,
              height: 3,
              background: GOLD,
              marginTop: 12,
              marginBottom: 12,
              borderRadius: 2,
            }}
          />

          {/* City name */}
          <div
            style={{
              display: "flex",
              fontSize: 34,
              color: "white",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 400,
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            Philadelphia
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 28,
              marginTop: 24,
              fontSize: 15,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ display: "flex" }}>9 Neighborhoods</span>
            <span style={{ display: "flex", color: GOLD }}>·</span>
            <span style={{ display: "flex" }}>45 Quests</span>
            <span style={{ display: "flex", color: GOLD }}>·</span>
            <span style={{ display: "flex" }}>1 Epic Summer</span>
          </div>
        </div>

        {/* Bottom events bar */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ display: "flex" }}>⚽ FIFA World Cup</span>
            <span style={{ display: "flex", color: GOLD, opacity: 0.5 }}>
              ✦
            </span>
            <span style={{ display: "flex" }}>⚾ MLB All-Star</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
