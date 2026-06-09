import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt =
  "Side Quest Philadelphia — Summer 2026 Scavenger Hunts celebrating America's 250th";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Patriotic palette
const RED = "#B22234";
const WHITE = "#FFFFFF";
const BLUE = "#3C3B6E";

// Brighter versions for text legibility on dark backgrounds
const TEXT_RED = "#EF4444";
const TEXT_BLUE = "#93B4F5";

// Cycle through red, white, blue for each letter
function patrioticLetters(
  text: string,
  fontSize: number,
  shadow: string,
) {
  const colors = [TEXT_RED, WHITE, TEXT_BLUE];
  let colorIndex = 0;

  return text.split("").map((char, i) => {
    if (char === " ") {
      return (
        <span
          key={i}
          style={{
            fontSize,
            fontWeight: 800,
            display: "flex",
            width: fontSize * 0.25,
          }}
        >
          {" "}
        </span>
      );
    }
    const color = colors[colorIndex % 3];
    colorIndex++;
    return (
      <span
        key={i}
        style={{
          fontSize,
          fontWeight: 800,
          color,
          display: "flex",
          textShadow: shadow,
        }}
      >
        {char}
      </span>
    );
  });
}

export default async function Image() {
  // Load the real Philadelphia skyline photo
  const skylineBuffer = await readFile(
    join(process.cwd(), "public/og-skyline.jpg"),
  );
  const skylineBase64 = `data:image/jpeg;base64,${skylineBuffer.toString("base64")}`;

  const textShadow = "0 4px 24px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)";

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
          background: BLUE,
        }}
      >
        {/* Real skyline photo background */}
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

        {/* Dark blue overlay for text readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(15,29,54,0.88) 0%, rgba(15,29,54,0.72) 30%, rgba(15,29,54,0.65) 50%, rgba(15,29,54,0.72) 70%, rgba(15,29,54,0.92) 100%)",
            display: "flex",
          }}
        />

        {/* Subtle red/blue patriotic tint */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(135deg, rgba(178,34,52,0.1) 0%, transparent 40%, rgba(60,59,110,0.12) 100%)",
            display: "flex",
          }}
        />

        {/* Top border — navy with white star emojis */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            background: BLUE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
          }}
        >
          {Array.from({ length: 15 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: 14,
                display: "flex",
              }}
            >
              ⭐
            </span>
          ))}
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            position: "relative",
            paddingBottom: 30,
          }}
        >
          {/* America 250 badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              padding: "6px 20px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: 999,
              background: "rgba(60,59,110,0.5)",
            }}
          >
            <span style={{ fontSize: 18, display: "flex" }}>🇺🇸</span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: WHITE,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              America&apos;s 250th
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.15em",
                display: "flex",
              }}
            >
              · Summer 2026
            </span>
          </div>

          {/* Title — Side Quest — per-letter R/W/B */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {patrioticLetters("Side Quest", 82, textShadow)}
          </div>

          {/* Title — Philadelphia — per-letter R/W/B continued */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginTop: 4,
            }}
          >
            {patrioticLetters("Philadelphia", 82, textShadow)}
          </div>

          {/* Philly icons row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 22,
            }}
          >
            <span style={{ fontSize: 26, display: "flex" }}>🔔</span>
            <span style={{ fontSize: 26, display: "flex" }}>🏈</span>
            <span style={{ fontSize: 26, display: "flex" }}>⚾</span>
            <span style={{ fontSize: 26, display: "flex" }}>🏀</span>
            <span style={{ fontSize: 26, display: "flex" }}>🏒</span>
            <span style={{ fontSize: 26, display: "flex" }}>🥊</span>
            <span style={{ fontSize: 26, display: "flex" }}>🧀</span>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 18,
              fontSize: 18,
              color: "rgba(255,255,255,0.75)",
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{ display: "flex" }}>9 Neighborhoods</span>
            <span style={{ color: TEXT_RED, display: "flex", fontSize: 14 }}>
              ⭐
            </span>
            <span style={{ display: "flex" }}>45 Objectives</span>
            <span style={{ color: TEXT_RED, display: "flex", fontSize: 14 }}>
              ⭐
            </span>
            <span style={{ display: "flex" }}>1 Epic Summer</span>
          </div>

          {/* Events row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 10,
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{ display: "flex" }}>⚽ FIFA World Cup</span>
            <span style={{ color: "rgba(255,255,255,0.2)", display: "flex" }}>
              |
            </span>
            <span style={{ display: "flex" }}>⚾ MLB All-Star Game</span>
          </div>
        </div>

        {/* Bottom patriotic bar with URL */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 0,
            right: 0,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(to top, rgba(15,29,54,0.95), rgba(15,29,54,0.7))",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            sidequestphilly.com
          </span>
        </div>

        {/* Bottom border — red with white star emojis */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 28,
            background: RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
          }}
        >
          {Array.from({ length: 15 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: 14,
                display: "flex",
              }}
            >
              ⭐
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
