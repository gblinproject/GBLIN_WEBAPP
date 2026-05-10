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

type FramePageProps = {
  searchParams: Promise<{
    holders?: string;
    saved?: string;
    crash?: string;
  }>;
};

// Build the OG image URL, optionally personalised via query params for shared casts.
// Spec: https://miniapps.farcaster.xyz/docs/guides/sharing#dynamic-embed-images
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

  // Mini App embed — opens the dApp. Spec allows exactly one button.
  const miniappEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_miniapp",
        name: "GBLIN",
        url: SITE_URL,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
      },
    },
  };

  // Legacy fc:frame embed for older Warpcast clients.
  const frameEmbed = {
    version: "1",
    imageUrl: frameImage,
    button: {
      title: "Open GBLIN",
      action: {
        type: "launch_frame",
        name: "GBLIN",
        url: SITE_URL,
        splashImageUrl: SPLASH_IMAGE,
        splashBackgroundColor: "#050505",
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
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245,215,122,0.10) 0%, rgba(245,215,122,0) 60%), #050505",
        color: "#f5d77a",
        padding: "24px 16px 80px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* Hero */}
        <section
          className="gblin-fade-up"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            textAlign: "center",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, rgba(245,215,122,0.25), rgba(245,215,122,0.06))",
              border: "1px solid rgba(245,215,122,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 32px -12px rgba(245,215,122,0.4)",
            }}
          >
            <Shield size={30} strokeWidth={1.8} color="#f5d77a" />
          </div>
          <h1
            style={{
              fontSize: 38,
              margin: 0,
              letterSpacing: -1.2,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            GBLIN
          </h1>
          <p
            style={{
              color: "#9a8a5c",
              margin: 0,
              maxWidth: 520,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Autonomous on-chain basket on Base. cbBTC + WETH + USDC, with a
            Crash Shield that rotates risk into stables when drawdowns exceed
            20%. 0 admin keys, fully open source.
          </p>
        </section>

        {/* Frame OG preview */}
        <section
          style={{
            ...glassCard,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FRAME_IMAGE_BASE}
            alt="GBLIN live stats — cast embed preview"
            style={{
              width: "100%",
              borderRadius: 16,
              display: "block",
              border: "1px solid rgba(245,215,122,0.10)",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: "#7a6f4f",
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            This is what the embed looks like when this URL is cast on Warpcast.
          </div>
        </section>

        {/* Action grid */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <ActionCard
            href="/buy-gblin"
            icon={<Sparkles size={18} />}
            title="Mint GBLIN"
            subtitle="Buy the basket with ETH"
            primary
          />
          <ActionCard
            href="/game"
            icon={<Shield size={18} />}
            title="Play Crash Shield"
            subtitle="Backtest the autonomy"
          />
          <ActionCard
            href="/rebalance"
            icon={<Gauge size={18} />}
            title="Trigger rebalance"
            subtitle="Earn keeper bounty"
          />
          <ActionCard
            href={DASHBOARD_URL}
            external
            icon={<BarChart3 size={18} />}
            title="Live dashboard"
            subtitle="On-chain analytics on Dune"
          />
        </section>
      </div>
    </main>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  external = false,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  external?: boolean;
  primary?: boolean;
}) {
  const content = (
    <div
      style={{
        ...glassCard,
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        textDecoration: "none",
        cursor: "pointer",
        transition: "transform 0.18s ease, border-color 0.18s ease",
        border: primary
          ? "1px solid rgba(245,215,122,0.35)"
          : "1px solid rgba(245,215,122,0.12)",
        background: primary
          ? "linear-gradient(180deg, rgba(245,215,122,0.10) 0%, rgba(245,215,122,0.02) 100%)"
          : "linear-gradient(180deg, rgba(245,215,122,0.04) 0%, rgba(245,215,122,0.015) 100%)",
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
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(245,215,122,0.10)",
            border: "1px solid rgba(245,215,122,0.18)",
            color: "#f5d77a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        {external ? (
          <ExternalLink size={14} color="#9a8a5c" />
        ) : (
          <ArrowRight size={14} color="#9a8a5c" />
        )}
      </div>
      <div>
        <div
          style={{
            color: "#f5d77a",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </div>
        <div style={{ color: "#9a8a5c", fontSize: 12, marginTop: 4 }}>
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

const glassCard: React.CSSProperties = {
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(245,215,122,0.04) 0%, rgba(245,215,122,0.015) 100%)",
  border: "1px solid rgba(245,215,122,0.12)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow:
    "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.6)",
};
