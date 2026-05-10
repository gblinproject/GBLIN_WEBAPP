import { ImageResponse } from "next/og";
import { getCrashById } from "@/lib/historical-crashes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/**
 * Dynamic OG image for the Crash Shield game.
 *
 * Modes:
 *   - No params           → "Survive the Crash" hero (CTA preview).
 *   - ?crash=jan2026&saved=1390&direct=25.8&gblin=11.9
 *                         → personalised result image (used in share embed).
 *
 * Image is 1200x800 to match the rest of the GBLIN frame imagery.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const crashId = searchParams.get("crash") ?? "";
  const savedRaw = searchParams.get("saved");
  const directRaw = searchParams.get("direct");
  const gblinRaw = searchParams.get("gblin");

  const crash = getCrashById(crashId);
  const saved = savedRaw ? parseFloat(savedRaw) : null;
  const directLoss = directRaw ? parseFloat(directRaw) : null;
  const gblinLoss = gblinRaw ? parseFloat(gblinRaw) : null;

  const hasResult =
    crash !== null &&
    saved !== null &&
    directLoss !== null &&
    gblinLoss !== null &&
    !Number.isNaN(saved) &&
    !Number.isNaN(directLoss) &&
    !Number.isNaN(gblinLoss);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #050505 0%, #1a1408 50%, #050505 100%)",
          color: "#f5d77a",
          padding: "44px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                letterSpacing: -1.5,
                color: "#f5d77a",
                display: "flex",
              }}
            >
              SURVIVE THE CRASH
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#9a8a5c",
                marginTop: 4,
                letterSpacing: 1.5,
                display: "flex",
              }}
            >
              GBLIN CRASH SHIELD · BACKTEST
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
              color: "#7fdb8a",
              border: "1px solid #2d4a30",
              borderRadius: 999,
              padding: "8px 16px",
              background: "#0a1a0d",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#7fdb8a",
              }}
            />
            on-chain · live
          </div>
        </div>

        {/* body */}
        {hasResult ? (
          <ResultBody
            crashLabel={crash.label}
            saved={saved}
            directLoss={directLoss}
            gblinLoss={gblinLoss}
          />
        ) : (
          <HeroBody />
        )}

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            color: "#9a8a5c",
            borderTop: "1px solid #2a2418",
            paddingTop: 14,
          }}
        >
          <div style={{ display: "flex" }}>
            cbBTC · WETH · USDC · autonomous rebalance · 0 admin keys
          </div>
          <div style={{ display: "flex", color: "#f5d77a" }}>gblin.digital/game</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

function HeroBody() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 28,
          color: "#f5d77a",
          maxWidth: 900,
          display: "flex",
          textAlign: "center",
        }}
      >
        Pick a historical crash. See what GBLIN&apos;s autonomous Crash Shield
        would have done to your portfolio.
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 14,
          color: "#9a8a5c",
          fontSize: 18,
          letterSpacing: 1,
        }}
      >
        <span style={{ display: "flex" }}>JAN 2026</span>
        <span style={{ display: "flex" }}>·</span>
        <span style={{ display: "flex" }}>MAY 2021</span>
        <span style={{ display: "flex" }}>·</span>
        <span style={{ display: "flex" }}>MAR 2020</span>
      </div>
    </div>
  );
}

function ResultBody({
  crashLabel,
  saved,
  directLoss,
  gblinLoss,
}: {
  crashLabel: string;
  saved: number;
  directLoss: number;
  gblinLoss: number;
}) {
  const savedColor = saved > 0 ? "#7fdb8a" : "#f5d77a";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: 22,
          color: "#9a8a5c",
          letterSpacing: 1.2,
          display: "flex",
        }}
      >
        {crashLabel.toUpperCase()}
      </div>

      <div style={{ display: "flex", gap: 18 }}>
        <PortfolioCard
          label="DIRECT HOLD"
          subtitle="no rebalance"
          loss={directLoss}
          accent="#e57676"
        />
        <PortfolioCard
          label="GBLIN BASKET"
          subtitle="crash shield armed"
          loss={gblinLoss}
          accent="#7fdb8a"
        />
      </div>

      <div
        style={{
          padding: "20px 24px",
          borderRadius: 14,
          background:
            saved > 0
              ? "rgba(127, 219, 138, 0.08)"
              : "rgba(245,215,122,0.06)",
          border: `1px solid ${saved > 0 ? "rgba(127,219,138,0.3)" : "rgba(245,215,122,0.18)"}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            color: "#9a8a5c",
            fontSize: 16,
            letterSpacing: 1.2,
            display: "flex",
          }}
        >
          GBLIN SAVED
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: savedColor,
            letterSpacing: -1.5,
            display: "flex",
            marginTop: 4,
          }}
        >
          {saved > 0 ? "+" : ""}
          {fmtUsd(saved)}
        </div>
        <div style={{ color: "#9a8a5c", fontSize: 14, display: "flex", marginTop: 4 }}>
          on a $10,000 starting basket
        </div>
      </div>
    </div>
  );
}

function PortfolioCard({
  label,
  subtitle,
  loss,
  accent,
}: {
  label: string;
  subtitle: string;
  loss: number;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "18px 22px",
        borderRadius: 14,
        background: "rgba(245,215,122,0.04)",
        border: "1px solid rgba(245,215,122,0.15)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          color: "#9a8a5c",
          fontSize: 16,
          letterSpacing: 1.2,
          display: "flex",
        }}
      >
        {label}
      </div>
      <div style={{ color: "#7a6f4f", fontSize: 14, display: "flex", marginTop: 2 }}>
        {subtitle}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: accent,
          letterSpacing: -1,
          display: "flex",
          marginTop: 12,
        }}
      >
        -{loss.toFixed(1)}%
      </div>
    </div>
  );
}
