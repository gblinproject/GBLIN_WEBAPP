import { ImageResponse } from "next/og";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, GBLIN_ABI, RPC_URL } from "@/components/protocol/protocol-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60;

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

async function fetchFrameStats() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

  const oneEth = ethers.parseEther("1");
  const [supplyRaw, stabilityRaw, quoteRaw] = await Promise.all([
    contract.totalSupply().catch(() => 0n),
    contract.stabilityFund().catch(() => 0n),
    contract.quoteBuyGBLIN(oneEth).catch(() => null),
  ]);

  const gblinOut = quoteRaw && quoteRaw[0] ? quoteRaw[0] : 0n;
  const gblinPerEth = Number(ethers.formatEther(gblinOut));
  const supply = Number(ethers.formatEther(supplyRaw));
  const stability = Number(ethers.formatEther(stabilityRaw));
  const keeperPayouts = stability > 0 ? Math.floor(stability / 0.0001) : 0;

  return { gblinPerEth, supply, stability, keeperPayouts };
}

export async function GET() {
  let stats = { gblinPerEth: 0, supply: 0, stability: 0, keeperPayouts: 0 };
  try {
    stats = await fetchFrameStats();
  } catch (e) {
    console.error("[frame/image] failed to fetch stats", e);
  }

  const bountyDisplay =
    stats.stability > 0 ? `${fmt(stats.stability, stats.stability < 0.01 ? 6 : 4)} ETH` : "0 ETH";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #050505 0%, #1a1408 50%, #050505 100%)",
          color: "#f5d77a",
          padding: "44px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, color: "#f5d77a", display: "flex" }}>
              GBLIN
            </div>
            <div style={{ fontSize: 20, color: "#9a8a5c", marginTop: 2, letterSpacing: 1, display: "flex" }}>
              AUTONOMOUS BASKET · LIVE ON BASE
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 20,
              color: "#7fdb8a",
              border: "1px solid #2d4a30",
              borderRadius: 999,
              padding: "8px 18px",
              background: "#0a1a0d",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#7fdb8a" }} />
            on-chain · live
          </div>
        </div>

        {/* stats grid: 3 columns single row */}
        <div style={{ display: "flex", gap: 18 }}>
          <StatCard
            label="1 ETH BUYS"
            value={stats.gblinPerEth > 0 ? `${fmt(stats.gblinPerEth, 2)}` : "—"}
            unit="GBLIN"
          />
          <StatCard
            label="TOTAL SUPPLY"
            value={stats.supply > 0 ? `${fmt(stats.supply, 2)}` : "—"}
            unit="GBLIN"
          />
          <StatCard
            label="KEEPER BOUNTY"
            value={bountyDisplay.replace(" ETH", "")}
            unit="ETH"
            hint={`${stats.keeperPayouts} payouts ready`}
          />
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 20,
            color: "#9a8a5c",
            borderTop: "1px solid #2a2418",
            paddingTop: 16,
          }}
        >
          <div style={{ display: "flex" }}>cbBTC · WETH · USDC · 0 admin keys</div>
          <div style={{ display: "flex", color: "#f5d77a" }}>gblin.digital</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "rgba(245, 215, 122, 0.06)",
        border: "1px solid rgba(245, 215, 122, 0.18)",
        borderRadius: 16,
        padding: "22px 24px",
        minHeight: 220,
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 18, color: "#9a8a5c", letterSpacing: 1.5, display: "flex" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: "#f5d77a", lineHeight: 1 }}>{value}</div>
        {unit && (
          <div style={{ fontSize: 22, color: "#9a8a5c", fontWeight: 600, display: "flex" }}>
            {unit}
          </div>
        )}
      </div>
      <div style={{ fontSize: 16, color: "#7a6f4f", display: "flex", minHeight: 18 }}>
        {hint ?? ""}
      </div>
    </div>
  );
}
