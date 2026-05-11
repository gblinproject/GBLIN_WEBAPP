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
 * 2026 palette: midnight base + vibrant blue/cyan/emerald mesh.
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
          // Multi-layer vibrant mesh on deep midnight
          backgroundColor: "#0a0b14",
          backgroundImage:
            "radial-gradient(45% 40% at 18% 18%, rgba(59,130,246,0.35) 0%, transparent 70%), " +
            "radial-gradient(40% 35% at 82% 12%, rgba(168,85,247,0.28) 0%, transparent 70%), " +
            "radial-gradient(50% 40% at 72% 82%, rgba(6,182,212,0.26) 0%, transparent 70%), " +
            "radial-gradient(40% 35% at 20% 88%, rgba(16,185,129,0.20) 0%, transparent 70%)",
          color: "#ffffff",
          padding: "48px 60px",
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
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: "linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            color: "#ffffff",
            fontWeight: 800,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          ⛨
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: -1.5,
              color: "#ffffff",
              display: "flex",
              lineHeight: 1.05,
            }}
          >
            Survive the Crash
          </div>
          <div
            style={{
              fontSize: 17,
              color: "#94a3b8",
              marginTop: 4,
              letterSpacing: 1.4,
              display: "flex",
              textTransform: "uppercase",
              fontWeight: 600,
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
          gap: 10,
          fontSize: 15,
          color: "#a7f3d0",
          border: "1px solid rgba(16,185,129,0.4)",
          borderRadius: 999,
          padding: "8px 18px",
          background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))",
          fontWeight: 600,
          letterSpacing: 0.6,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#10b981",
            boxShadow: "0 0 12px #10b981",
          }}
        />
        ON-CHAIN · LIVE
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
        fontSize: 15,
        color: "#94a3b8",
        borderTop: "1px solid rgba(148,163,184,0.15)",
        paddingTop: 16,
        letterSpacing: 0.6,
      }}
    >
      <div style={{ display: "flex" }}>
        cbBTC · WETH · USDC · autonomous rebalance · 0 admin keys
      </div>
      <div style={{ display: "flex", color: "#fbbf24", fontWeight: 700 }}>
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
        gap: 20,
        flex: 1,
        marginTop: 8,
      }}
    >
      <div
        style={{
          fontSize: 52,
          color: "#ffffff",
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.1,
          maxWidth: 1000,
          display: "flex",
        }}
      >
        How would your portfolio survive a real crypto crash?
      </div>
      <div
        style={{
          fontSize: 22,
          color: "#cbd5e1",
          maxWidth: 920,
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
          gap: 12,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "JAN 2026 · -28% / -34%", from: "rgba(244,63,94,0.18)", ring: "rgba(244,63,94,0.4)" },
          { label: "MAY 2021 · -48% / -58%", from: "rgba(168,85,247,0.18)", ring: "rgba(168,85,247,0.4)" },
          { label: "MAR 2020 · -50% / -45%", from: "rgba(59,130,246,0.18)", ring: "rgba(59,130,246,0.4)" },
        ].map((tag) => (
          <div
            key={tag.label}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${tag.from}, rgba(10,11,20,0.4))`,
              border: `1px solid ${tag.ring}`,
              color: "#ffffff",
              fontSize: 18,
              letterSpacing: 0.5,
              display: "flex",
              fontWeight: 600,
            }}
          >
            {tag.label}
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
          color: "#fda4af",
          letterSpacing: 1.6,
          display: "flex",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {crashLabel}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <PortfolioCard
          label="DIRECT HOLD"
          subtitle="no rebalance"
          loss={directLoss}
          accent="#fb7185"
          ring="rgba(244,63,94,0.32)"
          from="rgba(244,63,94,0.14)"
          to="rgba(244,63,94,0.02)"
        />
        <PortfolioCard
          label="GBLIN BASKET"
          subtitle="crash shield armed"
          loss={gblinLoss}
          accent="#34d399"
          ring="rgba(16,185,129,0.45)"
          from="rgba(16,185,129,0.18)"
          to="rgba(34,211,238,0.06)"
          highlight
        />
      </div>

      <div
        style={{
          padding: "24px 28px",
          borderRadius: 20,
          background: positive
            ? "linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(34,211,238,0.10) 50%, rgba(59,130,246,0.06) 100%)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${positive ? "rgba(16,185,129,0.45)" : "rgba(148,163,184,0.2)"}`,
          display: "flex",
          flexDirection: "column",
          boxShadow: positive
            ? "0 0 0 1px rgba(16,185,129,0.18) inset"
            : "none",
        }}
      >
        <div
          style={{
            color: positive ? "#a7f3d0" : "#94a3b8",
            fontSize: 18,
            letterSpacing: 1.4,
            display: "flex",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          GBLIN saved you
        </div>
        <div
          style={{
            fontSize: 66,
            fontWeight: 900,
            color: positive ? "#34d399" : "#ffffff",
            letterSpacing: -2.5,
            display: "flex",
            marginTop: 6,
            lineHeight: 1.0,
          }}
        >
          {positive ? "+" : ""}
          {fmtUsd(saved)}
        </div>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 16,
            display: "flex",
            marginTop: 6,
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
  ring,
  from,
  to,
  highlight = false,
}: {
  label: string;
  subtitle: string;
  loss: number;
  accent: string;
  ring: string;
  from: string;
  to: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "22px 26px",
        borderRadius: 18,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        border: `1px solid ${ring}`,
        display: "flex",
        flexDirection: "column",
        boxShadow: highlight
          ? "0 0 0 1px rgba(16,185,129,0.16) inset"
          : "none",
      }}
    >
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 15,
          letterSpacing: 1.4,
          display: "flex",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 13,
          display: "flex",
          marginTop: 2,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          color: accent,
          letterSpacing: -1.8,
          display: "flex",
          marginTop: 14,
          lineHeight: 1.0,
        }}
      >
        -{loss.toFixed(1)}%
      </div>
    </div>
  );
}
