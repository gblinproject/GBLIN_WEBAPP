import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ExternalLink,
  Gauge,
  Shield,
  Sparkles,
} from "lucide-react";

const SITE_URL = "https://gblin.digital";
const FRAME_IMAGE_BASE = `${SITE_URL}/api/frame/image`;
const SPLASH_IMAGE = `${SITE_URL}/LOGO_GBLIN.png`;
const DASHBOARD_URL = "https://dune.com/gblin/dashboard";

// 2026 palette
const C = {
  text: "#ffffff",
  textDim: "#94a3b8",
  textMute: "#64748b",
  border: "rgba(148,163,184,0.14)",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#fbbf24",
  violet: "#a855f7",
};

type FramePageProps = {
  searchParams: Promise<{
    holders?: string;
    saved?: string;
    crash?: string;
  }>;
};

function buildFrameImageUrl(params: {
  holders?: string;
  saved?: string;
  crash?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.holders) qs.set("holders", params.holders);
  if (params.saved) qs.set("saved", params.saved);
  if (params.crash) qs.set("crash", params.crash);
  const tail = qs.toString();
  return tail ? `${FRAME_IMAGE_BASE}?${tail}` : FRAME_IMAGE_BASE;
}

export async function generateMetadata({
  searchParams,
}: FramePageProps): Promise<Metadata> {
  const params = await searchParams;
  const frameImage = buildFrameImageUrl(params);

  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_miniapp",
        name: "GBLIN",
        url: `${SITE_URL}/frame`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#0a0b14",
      },
    },
  };

  const frameEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_frame",
        name: "GBLIN",
        url: `${SITE_URL}/frame`,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#0a0b14",
      },
    },
  };

  return {
    title: "GBLIN — Autonomous Basket on Base",
    description:
      "Live on-chain stats for GBLIN. Autonomous rebalances, transparent NAV, no admin keys.",
    openGraph: {
      title: "GBLIN — Autonomous Basket on Base",
      description:
        "Autonomous on-chain basket. cbBTC + WETH + USDC. No admin keys.",
      images: [{ url: frameImage, width: 1200, height: 800 }],
      url: `${SITE_URL}/frame`,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniappEmbed),
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default function FramePage() {
  return (
    <main
      className="gblin-mesh"
      style={{
        minHeight: "100vh",
        color: C.text,
        padding: "20px 14px 32px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        {/* Single unified card */}
        <section
          className="gblin-fade-up gblin-glass"
          style={{
            ...glassCard,
            padding: "22px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Hero */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(244,63,94,0.10) 100%)",
                border: "1px solid rgba(251,191,36,0.32)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 12px 28px -10px rgba(251,191,36,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                padding: 9,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.png"
                alt="GBLIN logo"
                width={50}
                height={50}
                style={{ objectFit: "contain" }}
              />
            </div>
            <h1
              style={{
                fontSize: 32,
                margin: 0,
                letterSpacing: -1,
                fontWeight: 900,
                lineHeight: 1.05,
              }}
            >
              <span className="gblin-grad-text-amber">GBLIN</span>
            </h1>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 999,
                background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
                border: "1px solid rgba(16,185,129,0.35)",
                fontSize: 10,
                color: "#a7f3d0",
                letterSpacing: 0.8,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              <span
                className="gblin-blink"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: C.emerald,
                  boxShadow: `0 0 8px ${C.emerald}`,
                }}
              />
              live on base · 0 admin keys
            </div>
          </div>

          {/* Weekly challenge banner — moved above description for max visibility */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(244,63,94,0.06) 100%)",
              border: "1px solid rgba(251,191,36,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow:
                "0 0 0 1px rgba(251,191,36,0.10) inset, 0 12px 28px -12px rgba(251,191,36,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(251,191,36,0.22)",
                    border: "1px solid rgba(251,191,36,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={14} color="#fbbf24" />
                </div>
                <span
                  style={{
                    color: "#fbbf24",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: -0.2,
                  }}
                >
                  Sunday Challenge — Win $10
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: C.textMute,
                  letterSpacing: 0.6,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: "rgba(148,163,184,0.10)",
                  padding: "3px 8px",
                  borderRadius: 999,
                }}
              >
                weekly
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: C.textDim,
                lineHeight: 1.6,
              }}
            >
              Guess how GBLIN reallocated during a real crash. If you win,{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>
                post your result tagging @gblin on Farcaster or @GBLIN_Protocol on X.
              </span>{" "}
              Every Sunday one winner is drawn at random and receives{" "}
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>$10</span>{" "}
              directly in their wallet.
            </p>
            <Link
              href="/game"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "11px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.10) 100%)",
                border: "1px solid rgba(251,191,36,0.45)",
                color: "#fbbf24",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                letterSpacing: 0.2,
              }}
            >
              <Shield size={14} />
              Play &amp; Win
            </Link>
          </div>

          {/* Description */}
          <p
            style={{
              color: C.textDim,
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.55,
              textAlign: "center",
            }}
          >
            Autonomous on-chain basket on Base. cbBTC + WETH + USDC, with a
            Crash Shield that rotates risk into stables when drawdowns exceed 20%.
            Fully open source.
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "0 -4px" }} />

          {/* OG image preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/frame/image"
              alt="GBLIN live stats — cast embed preview"
              style={{
                width: "100%",
                borderRadius: 12,
                display: "block",
                border: `1px solid ${C.border}`,
                aspectRatio: "3 / 2",
                background: "rgba(255,255,255,0.03)",
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: C.textMute,
                textAlign: "center",
                letterSpacing: 0.4,
              }}
            >
              This is what the embed looks like when this URL is cast on Warpcast.
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "0 -4px" }} />

          {/* Action grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 9,
            }}
          >
            <ActionCard
              href="/buy-gblin"
              icon={<Sparkles size={16} />}
              title="Mint GBLIN"
              subtitle="Buy the basket with ETH"
              tone="amber"
              primary
            />
            <ActionCard
              href="/game"
              icon={<Shield size={16} />}
              title="Play Crash Shield"
              subtitle="Backtest the autonomy"
              tone="blue"
            />
            <ActionCard
              href="/rebalance"
              icon={<Gauge size={16} />}
              title="Trigger rebalance"
              subtitle="Earn keeper bounty"
              tone="emerald"
            />
            <ActionCard
              href={DASHBOARD_URL}
              external
              icon={<BarChart3 size={16} />}
              title="Live dashboard"
              subtitle="On-chain analytics on Dune"
              tone="violet"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

type Tone = "blue" | "emerald" | "amber" | "violet";

const TONE_MAP: Record<
  Tone,
  { from: string; to: string; ring: string; icon: string; iconBg: string }
> = {
  blue: {
    from: "rgba(59,130,246,0.18)",
    to: "rgba(6,182,212,0.06)",
    ring: "rgba(59,130,246,0.35)",
    icon: "#60a5fa",
    iconBg: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(6,182,212,0.10))",
  },
  emerald: {
    from: "rgba(16,185,129,0.16)",
    to: "rgba(34,211,238,0.06)",
    ring: "rgba(16,185,129,0.35)",
    icon: "#34d399",
    iconBg: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(34,211,238,0.10))",
  },
  amber: {
    from: "rgba(251,191,36,0.18)",
    to: "rgba(244,63,94,0.06)",
    ring: "rgba(251,191,36,0.4)",
    icon: "#fbbf24",
    iconBg: "linear-gradient(135deg, rgba(251,191,36,0.28), rgba(244,63,94,0.08))",
  },
  violet: {
    from: "rgba(168,85,247,0.18)",
    to: "rgba(59,130,246,0.06)",
    ring: "rgba(168,85,247,0.35)",
    icon: "#c084fc",
    iconBg: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(59,130,246,0.10))",
  },
};

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  external = false,
  primary = false,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  external?: boolean;
  primary?: boolean;
  tone: Tone;
}) {
  const t = TONE_MAP[tone];
  const content = (
    <div
      className="gblin-glass"
      style={{
        padding: "12px 12px",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        textDecoration: "none",
        cursor: "pointer",
        transition: "transform 0.18s ease, border-color 0.18s ease",
        border: `1px solid ${primary ? t.ring : C.border}`,
        background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
        boxShadow: primary
          ? `0 0 0 1px ${t.ring}, 0 12px 28px -14px ${t.ring}`
          : "0 1px 0 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: t.iconBg,
            border: `1px solid ${t.ring}`,
            color: t.icon,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        {external ? (
          <ExternalLink size={12} color={C.textMute} />
        ) : (
          <ArrowRight size={12} color={C.textMute} />
        )}
      </div>
      <div>
        <div
          style={{
            color: C.text,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </div>
        <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  );
}

// NOTE: backdrop-filter is applied via the `gblin-glass` className (see globals.css)
// instead of inline, so it can be disabled on mobile / foldables where it triggers
// GPU compositing crashes in Samsung Internet on Galaxy Z Fold.
const glassCard: React.CSSProperties = {
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
  border: `1px solid ${C.border}`,
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.7)",
};
