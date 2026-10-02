import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * 1200×800 embed image (3:2) for the "Park your earnings" mini app at /frame/park.
 * Static copy only: the live numbers are shown inside the mini app, read from the vault.
 */
export async function GET() {
  const pill = (label: string, ring: string) => (
    <div
      key={label}
      style={{
        padding: "10px 20px",
        borderRadius: 999,
        border: `1px solid ${ring}`,
        color: "#e2e8f0",
        fontSize: 22,
        display: "flex",
        fontWeight: 600,
        letterSpacing: 0.3,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      {label}
    </div>
  );

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
            "radial-gradient(45% 55% at 12% 18%, rgba(16,185,129,0.30) 0%, transparent 70%), " +
            "radial-gradient(40% 45% at 88% 12%, rgba(59,130,246,0.30) 0%, transparent 70%), " +
            "radial-gradient(50% 50% at 78% 88%, rgba(251,191,36,0.20) 0%, transparent 70%)",
          color: "#ffffff",
          padding: "60px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0b14",
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            G
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, color: "#fbbf24", display: "flex", lineHeight: 1 }}>
              GBLIN
            </div>
            <div style={{ fontSize: 18, color: "#94a3b8", marginTop: 6, letterSpacing: 1.4, display: "flex", fontWeight: 600 }}>
              ONE TOKEN · cbBTC + WETH + USDC · ON BASE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 30, color: "#fbbf24", fontWeight: 800, letterSpacing: 2, display: "flex" }}>
            PARK YOUR EARNINGS
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: -2.5,
              lineHeight: 1.06,
              display: "flex",
              maxWidth: 1000,
            }}
          >
            Keep what you spend liquid. See what the rest would do.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            {pill("Amount at NAV", "rgba(16,185,129,0.5)")}
            {pill("Every fee", "rgba(59,130,246,0.5)")}
            {pill("Exit value today", "rgba(251,191,36,0.5)")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 24, color: "#cbd5e1", display: "flex" }}>Nothing executes until you sign.</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px 38px",
              borderRadius: 16,
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              color: "#0a0b14",
              fontWeight: 900,
              fontSize: 26,
            }}
          >
            Open the mini app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
