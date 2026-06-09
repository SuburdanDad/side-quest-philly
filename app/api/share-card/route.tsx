import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

const NAVY = "#0F1D36";
const GOLD = "#C9A84C";
const AMBER = "#D97706";

// Neighborhood emoji lookup
const NEIGHBORHOOD_EMOJI: Record<string, string> = {
  "old-city": "🏛️",
  "south-philly": "🍝",
  fishtown: "🎣",
  "center-city": "🏙️",
  "university-city": "🎓",
  manayunk: "🚴",
  chinatown: "🏮",
  "west-philly": "🌳",
  "northern-liberties": "🎨",
};

const NEIGHBORHOOD_NAME: Record<string, string> = {
  "old-city": "Old City",
  "south-philly": "South Philly",
  fishtown: "Fishtown",
  "center-city": "Center City",
  "university-city": "University City",
  manayunk: "Manayunk",
  chinatown: "Chinatown",
  "west-philly": "West Philly",
  "northern-liberties": "Northern Liberties",
};

/**
 * Generate a branded share card for Instagram Stories (1080×1920).
 *
 * Query params:
 * - neighborhood: slug of the completed neighborhood
 * - xp: total XP earned
 * - stamps: number of stamps collected
 * - obj: objective title that was just completed
 * - photo: base64 data URL of the proof photo (sent via POST body)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { neighborhood, xp, stamps, objectiveTitle, photo } = body as {
      neighborhood: string;
      xp: number;
      stamps: number;
      objectiveTitle: string;
      photo?: string;
    };

    const emoji = NEIGHBORHOOD_EMOJI[neighborhood] ?? "📍";
    const name = NEIGHBORHOOD_NAME[neighborhood] ?? neighborhood;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Georgia, serif",
            background: NAVY,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: `linear-gradient(to right, ${AMBER}, ${GOLD}, ${AMBER})`,
              display: "flex",
            }}
          />

          {/* Radial glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `radial-gradient(ellipse at 50% 30%, ${GOLD}15, transparent 70%)`,
              display: "flex",
            }}
          />

          {/* Content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              height: "100%",
              padding: "80px 60px 60px",
            }}
          >
            {/* App badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 24px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                marginBottom: 40,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: GOLD,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                Side Quest Philadelphia
              </span>
            </div>

            {/* Photo area */}
            {photo ? (
              <div
                style={{
                  display: "flex",
                  width: 800,
                  height: 800,
                  borderRadius: 32,
                  overflow: "hidden",
                  border: `4px solid ${GOLD}40`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${GOLD}15`,
                  marginBottom: 50,
                }}
              >
                <img
                  src={photo}
                  width={800}
                  height={800}
                  style={{
                    width: 800,
                    height: 800,
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 600,
                  height: 600,
                  borderRadius: 300,
                  border: `6px dashed ${GOLD}40`,
                  background: `${GOLD}08`,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 50,
                }}
              >
                <span style={{ fontSize: 200, display: "flex" }}>{emoji}</span>
              </div>
            )}

            {/* Neighborhood stamp */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 56, display: "flex" }}>{emoji}</span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: GOLD,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      display: "flex",
                    }}
                  >
                    Quest Complete
                  </span>
                  <span
                    style={{
                      fontSize: 48,
                      fontWeight: 900,
                      color: "white",
                      display: "flex",
                      lineHeight: 1.1,
                    }}
                  >
                    {name}
                  </span>
                </div>
              </div>

              {/* Objective that was completed */}
              {objectiveTitle && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 16,
                    padding: "12px 28px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      color: "rgba(255,255,255,0.7)",
                      display: "flex",
                      textAlign: "center",
                    }}
                  >
                    {objectiveTitle}
                  </span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                gap: 48,
                marginTop: 50,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: GOLD,
                    display: "flex",
                    lineHeight: 1,
                  }}
                >
                  {xp ?? 0}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  Total XP
                </span>
              </div>
              <div
                style={{
                  width: 1,
                  height: 48,
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: "white",
                    display: "flex",
                    lineHeight: 1,
                  }}
                >
                  {stamps ?? 0}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    display: "flex",
                  }}
                >
                  Stamps
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                marginTop: "auto",
                paddingTop: 40,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 3,
                  background: GOLD,
                  borderRadius: 2,
                  display: "flex",
                }}
              />
              <span
                style={{
                  fontSize: 18,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.1em",
                  display: "flex",
                }}
              >
                sidequestphilly.com
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                <span style={{ display: "flex" }}>Summer 2026</span>
                <span style={{ display: "flex", color: `${GOLD}60` }}>
                  {" "}
                </span>
                <span style={{ display: "flex" }}>
                  #SideQuestPhilly
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      },
    );
  } catch (error) {
    return new Response("Failed to generate share card", { status: 500 });
  }
}
