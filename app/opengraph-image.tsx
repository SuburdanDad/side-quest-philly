import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Side Quest Philadelphia — Summer 2026 Scavenger Hunts celebrating America's 250th";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#C9A84C";

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
          fontFamily: "system-ui, sans-serif",
          background: "#0F1D36",
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

        {/* Cinematic gradient overlay — dark at top/bottom, clearer in middle */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(10,18,36,0.92) 0%, rgba(10,18,36,0.55) 35%, rgba(10,18,36,0.4) 50%, rgba(10,18,36,0.6) 70%, rgba(10,18,36,0.95) 100%)",
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
            padding: "40px 60px",
          }}
        >
          {/* Top badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              padding: "8px 24px",
              borderRadius: 999,
              background: "rgba(201,168,76,0.15)",
              border: "1.5px solid rgba(201,168,76,0.4)",
            }}
          >
            <span style={{ fontSize: 16, display: "flex" }}>🇺🇸</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: GOLD,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Summer 2026
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(201,168,76,0.5)",
                display: "flex",
              }}
            >
              ·
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: GOLD,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              America 250
            </span>
          </div>

          {/* SIDE QUEST — massive, white, bold */}
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1,
              letterSpacing: "-0.03em",
              textShadow:
                "0 4px 30px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4)",
            }}
          >
            SIDE QUEST
          </div>

          {/* PHILADELPHIA — gold accent */}
          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 800,
              color: GOLD,
              lineHeight: 1,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 8,
              textShadow:
                "0 4px 20px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            Philadelphia
          </div>

          {/* Divider line */}
          <div
            style={{
              display: "flex",
              width: 120,
              height: 3,
              background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`,
              marginTop: 24,
              borderRadius: 2,
            }}
          />

          {/* Tagline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 20,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.04em",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ display: "flex" }}>9 Neighborhoods</span>
            <span
              style={{
                display: "flex",
                color: GOLD,
                fontSize: 10,
              }}
            >
              ◆
            </span>
            <span style={{ display: "flex" }}>45 Quests</span>
            <span
              style={{
                display: "flex",
                color: GOLD,
                fontSize: 10,
              }}
            >
              ◆
            </span>
            <span style={{ display: "flex" }}>1 Epic Summer</span>
          </div>
        </div>

        {/* Bottom gold accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: `linear-gradient(to right, #B22234, ${GOLD}, #3C3B6E)`,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
