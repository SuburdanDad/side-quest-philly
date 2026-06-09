import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Side Quest Philadelphia — Summer 2026 Scavenger Hunts celebrating America's 250th";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Parchment / quest palette
const PARCHMENT = "#F5E6C8";
const PARCHMENT_DARK = "#E8D5A8";
const BROWN = "#6B4226";
const DARK_BROWN = "#3D2415";
const GOLD = "#C9A84C";
const NAVY = "#0F1D36";
const RED = "#B22234";

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
          background: PARCHMENT,
        }}
      >
        {/* Parchment texture — radial grain effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(ellipse at 30% 20%, ${PARCHMENT} 0%, ${PARCHMENT_DARK} 70%, #D4C090 100%)`,
            display: "flex",
          }}
        />

        {/* Skyline photo strip across the bottom third */}
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 40,
            right: 40,
            height: 180,
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            border: `3px solid ${BROWN}`,
            boxShadow: "0 4px 20px rgba(59,36,21,0.3)",
          }}
        >
          <img
            src={skylineBase64}
            width={1120}
            height={180}
            style={{
              width: 1120,
              height: 180,
              objectFit: "cover",
              objectPosition: "center 40%",
            }}
          />
          {/* Warm overlay on photo */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(to bottom, rgba(245,230,200,0.15) 0%, rgba(15,29,54,0.4) 100%)",
              display: "flex",
            }}
          />
        </div>

        {/* Quest stamp border — top */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            bottom: 14,
            border: `3px dashed ${BROWN}`,
            borderRadius: 20,
            display: "flex",
            opacity: 0.4,
          }}
        />

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            position: "relative",
            paddingTop: 40,
          }}
        >
          {/* Compass + quest icons row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 32,
            }}
          >
            <span style={{ display: "flex" }}>🧭</span>
            <span style={{ display: "flex" }}>🗺️</span>
            <span style={{ display: "flex" }}>🔔</span>
            <span style={{ display: "flex" }}>🗽</span>
            <span style={{ display: "flex" }}>📍</span>
          </div>

          {/* SIDE QUEST title — hand-drawn feel */}
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 900,
              color: DARK_BROWN,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginTop: 12,
              textShadow: `2px 2px 0 ${PARCHMENT_DARK}`,
            }}
          >
            SIDE QUEST
          </div>

          {/* Decorative divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 80,
                height: 2,
                background: BROWN,
                opacity: 0.5,
              }}
            />
            <span style={{ fontSize: 18, display: "flex", color: GOLD }}>
              ⭐
            </span>
            <div
              style={{
                display: "flex",
                width: 80,
                height: 2,
                background: BROWN,
                opacity: 0.5,
              }}
            />
          </div>

          {/* PHILADELPHIA subtitle */}
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 700,
              color: BROWN,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            Philadelphia
          </div>

          {/* Quest stats — styled like a treasure map legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginTop: 16,
              padding: "10px 30px",
              background: "rgba(107,66,38,0.08)",
              borderRadius: 12,
              border: `1.5px solid rgba(107,66,38,0.15)`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20, display: "flex" }}>📍</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: DARK_BROWN,
                  display: "flex",
                }}
              >
                9 Neighborhoods
              </span>
            </div>
            <div
              style={{
                display: "flex",
                width: 4,
                height: 4,
                borderRadius: 2,
                background: GOLD,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20, display: "flex" }}>🏆</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: DARK_BROWN,
                  display: "flex",
                }}
              >
                45 Quests
              </span>
            </div>
            <div
              style={{
                display: "flex",
                width: 4,
                height: 4,
                borderRadius: 2,
                background: GOLD,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20, display: "flex" }}>🇺🇸</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: DARK_BROWN,
                  display: "flex",
                }}
              >
                Summer 2026
              </span>
            </div>
          </div>
        </div>

        {/* Bottom banner on photo */}
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
              alignItems: "center",
              gap: 10,
              padding: "6px 24px",
              background: NAVY,
              borderRadius: 999,
              border: `2px solid ${GOLD}`,
            }}
          >
            <span style={{ fontSize: 14, display: "flex" }}>⚽</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
                letterSpacing: "0.1em",
                display: "flex",
              }}
            >
              FIFA World Cup
            </span>
            <span
              style={{
                fontSize: 12,
                color: GOLD,
                display: "flex",
              }}
            >
              ✦
            </span>
            <span style={{ fontSize: 14, display: "flex" }}>⚾</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
                letterSpacing: "0.1em",
                display: "flex",
              }}
            >
              MLB All-Star
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
