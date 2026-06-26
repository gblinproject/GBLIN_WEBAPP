import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * 1200×630 OG image (1.91:1 aspect ratio).
 * Used for heroImageUrl and ogImageUrl in the Farcaster manifest.
 * Primary message: crash-shield challenge CTA.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0b14",
          backgroundImage:
            "radial-gradient(45% 55% at 15% 20%, rgba(59,130,246,0.38) 0%, transparent 70%), " +
            "radial-gradient(40% 45% at 85% 10%, rgba(168,85,247,0.30) 0%, transparent 70%), " +
            "radial-gradient(50% 50% at 75% 85%, rgba(6,182,212,0.28) 0%, transparent 70%), " +
            "radial-gradient(40% 40% at 18% 88%, rgba(251,191,36,0.18) 0%, transparent 70%)",
          color: "#ffffff",
          padding: "52px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0b14",
              fontSize: 38,
              fontWeight: 900,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -8px rgba(251,191,36,0.5)",
              flexShrink: 0,
            }}
          >
            G
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: -2,
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                backgroundClip: "text",
                color: "transparent",
                display: "flex",
                lineHeight: 1,
              }}
            >
              GBLIN
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#94a3b8",
                marginTop: 5,
                letterSpacing: 1.4,
                display: "flex",
                fontWeight: 600,
              }}
            >
              AUTONOMOUS BASKET · LIVE ON BASE · 0 ADMIN KEYS
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#a7f3d0",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 999,
              padding: "8px 16px",
              background: "rgba(16,185,129,0.12)",
              fontWeight: 600,
              letterSpacing: 0.8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#10b981",
                boxShadow: "0 0 10px #10b981",
              }}
            />
            ON-CHAIN · LIVE
          </div>
        </div>

        {/* Center: main challenge message */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: -2.5,
              lineHeight: 1.05,
              display: "flex",
              maxWidth: 900,
            }}
          >
            Can you guess how GBLIN survived the crash?
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              display: "flex",
              lineHeight: 1.4,
            }}
          >
            Open the mini app · guess GBLIN&apos;s drawdown in a real crash
          </div>
        </div>

        {/* Bottom: crash tags + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "JAN 2026 · -40%", ring: "rgba(244,63,94,0.45)" },
              { label: "NOV 2022 · -32%", ring: "rgba(168,85,247,0.45)" },
              { label: "MAY 2021 · -58%", ring: "rgba(59,130,246,0.45)" },
              { label: "MAR 2020 · -45%", ring: "rgba(6,182,212,0.45)" },
            ].map((tag) => (
              <div
                key={tag.label}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${tag.ring}`,
                  color: "#e2e8f0",
                  fontSize: 15,
                  display: "flex",
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {tag.label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 36px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              color: "#0a0b14",
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: -0.3,
              boxShadow: "0 8px 28px -8px rgba(251,191,36,0.7)",
            }}
          >
            Beat the crash
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
