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
 * Dynamic OG image for the Crash Shield game (1200x800).
 *
 * - No params:        hero CTA preview
 * - With ?crash=&saved=&direct=&gblin=  personalised result share image
 *
 * Style: warm dark gradient, bold typography, glassmorphism cards,
 * matches the in-app design system.
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
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,215,122,0.10) 0%, rgba(245,215,122,0) 60%), #050505",
          color: "#f5d77a",
          padding: "44px 56px",
          fontFamily: "sans-serif",
        }}
      >
        <Header />
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
        <FooterStrip />
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

function Header() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Shield-like brand mark */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background:
              "linear-gradient(135deg, rgba(245,215,122,0.25), rgba(245,215,122,0.04))",
            border: "1px solid rgba(245,215,122,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            color: "#f5d77a",
            fontWeight: 700,
          }}
        >
          ⛨
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: -1,
              color: "#f5d77a",
              display: "flex",
              lineHeight: 1.05,
            }}
          >
            Survive the Crash
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#9a8a5c",
              marginTop: 4,
              letterSpacing: 1.4,
              display: "flex",
              textTransform: "uppercase",
            }}
          >
            GBLIN Crash Shield · live backtest
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 16,
          color: "#7fdb8a",
          border: "1px solid rgba(127,219,138,0.35)",
          borderRadius: 999,
          padding: "8px 16px",
          background: "rgba(10,26,13,0.6)",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#7fdb8a",
          }}
        />
        on-chain · live
      </div>
    </div>
  );
}

function FooterStrip() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 16,
        color: "#9a8a5c",
        borderTop: "1px solid rgba(245,215,122,0.10)",
        paddingTop: 14,
        letterSpacing: 0.6,
      }}
    >
      <div style={{ display: "flex" }}>
        cbBTC · WETH · USDC · autonomous rebalance · 0 admin keys
      </div>
      <div style={{ display: "flex", color: "#f5d77a", fontWeight: 600 }}>
        gblin.digital/game
      </div>
    </div>
  );
}

function HeroBody() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        flex: 1,
        marginTop: 8,
      }}
    >
      <div
        style={{
          fontSize: 48,
          color: "#f5d77a",
          fontWeight: 700,
          letterSpacing: -1.5,
          lineHeight: 1.15,
          maxWidth: 980,
          display: "flex",
        }}
      >
        How would your portfolio survive a real crypto crash?
      </div>
      <div
        style={{
          fontSize: 22,
          color: "#9a8a5c",
          maxWidth: 900,
          lineHeight: 1.5,
          display: "flex",
        }}
      >
        Pick an allocation. Run it through the Jan 2026, May 2021 or Mar 2020
        cascade. See what GBLIN&apos;s autonomous Crash Shield would have done.
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        {["JAN 2026 · -28% / -34%", "MAY 2021 · -48% / -58%", "MAR 2020 · -50% / -45%"].map((tag) => (
          <div
            key={tag}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(245,215,122,0.06)",
              border: "1px solid rgba(245,215,122,0.18)",
              color: "#f5d77a",
              fontSize: 18,
              letterSpacing: 0.5,
              display: "flex",
            }}
          >
            {tag}
          </div>
        ))}
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
  const positive = saved > 0;
  const accent = positive ? "#7fdb8a" : "#f5d77a";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        flex: 1,
        marginTop: 6,
      }}
    >
      <div
        style={{
          fontSize: 22,
          color: "#9a8a5c",
          letterSpacing: 1.4,
          display: "flex",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {crashLabel}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
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
          highlight
        />
      </div>

      <div
        style={{
          padding: "22px 26px",
          borderRadius: 18,
          background: positive
            ? "linear-gradient(135deg, rgba(127,219,138,0.18), rgba(127,219,138,0.04))"
            : "rgba(245,215,122,0.06)",
          border: `1px solid ${positive ? "rgba(127,219,138,0.35)" : "rgba(245,215,122,0.18)"}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            color: "#9a8a5c",
            fontSize: 18,
            letterSpacing: 1.2,
            display: "flex",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          GBLIN saved you
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: accent,
            letterSpacing: -2,
            display: "flex",
            marginTop: 4,
            lineHeight: 1.05,
          }}
        >
          {positive ? "+" : ""}
          {fmtUsd(saved)}
        </div>
        <div
          style={{
            color: "#9a8a5c",
            fontSize: 16,
            display: "flex",
            marginTop: 4,
          }}
        >
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
  highlight = false,
}: {
  label: string;
  subtitle: string;
  loss: number;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "20px 24px",
        borderRadius: 16,
        background: highlight
          ? "linear-gradient(135deg, rgba(127,219,138,0.10), rgba(127,219,138,0.02))"
          : "rgba(245,215,122,0.04)",
        border: `1px solid ${highlight ? "rgba(127,219,138,0.28)" : "rgba(245,215,122,0.15)"}`,
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
      <div
        style={{
          color: "#7a6f4f",
          fontSize: 14,
          display: "flex",
          marginTop: 2,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: accent,
          letterSpacing: -1.5,
          display: "flex",
          marginTop: 14,
          lineHeight: 1.05,
        }}
      >
        -{loss.toFixed(1)}%
      </div>
    </div>
  );
}
