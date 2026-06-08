import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Side Quest Philadelphia — Summer 2026 Scavenger Hunts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #004C54 0%, #003038 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 20% 80%, rgba(232,24,40,0.2), transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,107,182,0.2), transparent 50%)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: 16,
              display: "flex",
            }}
          >
            Summer 2026
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            Side Quest
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#E8B931",
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            Philadelphia
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.7)",
              marginTop: 24,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            <span>⚽ World Cup</span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <span>⚾ All-Star Game</span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <span>9 Neighborhoods</span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <span>45 Objectives</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
