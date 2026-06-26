import { ImageResponse } from "next/og";
import { getCrash } from "@/lib/crash-data";

/**
 * Dynamic, personalised share image (1200x800, 3:2) for the wallet stress test.
 * Params: you=<portfolio drawdown %>, gblin=<gblin drawdown %>, crash=<id>, u=<username>
 * With no params it renders a generic promo card.
 */
export const runtime = "edge";

const LOGO = "https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const you = parseFloat(searchParams.get("you") || "");
  const gblin = parseFloat(searchParams.get("gblin") || "");
  const crash = getCrash(searchParams.get("crash") || "");
  const user = searchParams.get("u");
  const hasResult = Number.isFinite(you) && Number.isFinite(gblin);

  const max = Math.max(you || 0, gblin || 0, 1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "800px",
          display: "flex",
          flexDirection: "column",
          background: "#050505",
          color: "#f4f1e9",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={72} height={72} alt="GBLIN" style={{ borderRadius: "16px" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "34px", fontWeight: 800, color: "#e9cd6b" }}>GBLIN</div>
            <div style={{ fontSize: "20px", color: "#8a8780" }}>Crash Shield · Wallet stress test</div>
          </div>
        </div>

        {hasResult ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: "40px" }}>
            <div style={{ fontSize: "30px", color: "#cbd5e1", display: "flex" }}>
              {user ? `@${user}'s portfolio in ${crash?.short ?? "a real crash"}` : `This portfolio in ${crash?.short ?? "a real crash"}`}
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: "34px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "30px", marginBottom: "10px" }}>
                <span style={{ color: "#ffffff" }}>Your portfolio</span>
                <span style={{ color: "#f87171", fontWeight: 800 }}>{`-${you}%`}</span>
              </div>
              <div style={{ display: "flex", width: "100%", height: "34px", background: "#141417", borderRadius: "99px" }}>
                <div style={{ display: "flex", width: `${(you / max) * 100}%`, height: "34px", background: "#f87171", borderRadius: "99px" }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: "26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "30px", marginBottom: "10px" }}>
                <span style={{ color: "#ffffff" }}>🛡️ GBLIN basket</span>
                <span style={{ color: "#fbbf24", fontWeight: 800 }}>{`-${gblin}%`}</span>
              </div>
              <div style={{ display: "flex", width: "100%", height: "34px", background: "#141417", borderRadius: "99px" }}>
                <div style={{ display: "flex", width: `${(gblin / max) * 100}%`, height: "34px", background: "#fbbf24", borderRadius: "99px" }} />
              </div>
            </div>

            <div style={{ display: "flex", fontSize: "24px", color: "#8a8780", marginTop: "40px" }}>
              gblin.digital · backed basket on Base · 0 admin keys
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: "70px" }}>
            <div style={{ display: "flex", fontSize: "64px", fontWeight: 800, lineHeight: 1.1, color: "#ffffff" }}>
              How hard would your wallet have crashed?
            </div>
            <div style={{ display: "flex", fontSize: "30px", color: "#cbd5e1", marginTop: "28px", maxWidth: "900px" }}>
              Stress-test your real BTC / ETH holdings against the crypto crashes — and see how little the GBLIN basket fell.
            </div>
            <div style={{ display: "flex", fontSize: "24px", color: "#8a8780", marginTop: "54px" }}>
              gblin.digital · backed basket on Base · 0 admin keys
            </div>
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
