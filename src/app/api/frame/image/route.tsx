import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

const CONTRACT_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";
const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
const RPC_URLS = [
  ALCHEMY_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "",
  "https://mainnet.base.org",
  "https://base.publicnode.com",
  "https://base.llamarpc.com",
].filter(Boolean);

// Precomputed 4-byte function selectors (keccak256 first 4 bytes)
const SELECTORS = {
  totalSupply: "0x18160ddd",
  stabilityFund: "0xa60265fe",
  quoteBuyGBLIN: "0x38ae0605",
} as const;

// Strip "0x" prefix from selector when concatenating with params
function buildCallData(selector: string, paddedParams = ""): string {
  return selector + paddedParams;
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function toUint256Hex(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x" || hex === "0x0") return 0n;
  return BigInt(hex);
}

function formatEther(wei: bigint): number {
  // Avoid precision issues for large values by splitting
  const intPart = wei / 10n ** 18n;
  const fracPart = wei % 10n ** 18n;
  return Number(intPart) + Number(fracPart) / 1e18;
}

async function ethCallOne(url: string, data: string, timeoutMs = 3500): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CONTRACT_ADDRESS, data }, "latest"],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const json = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message);
    return json.result || "0x";
  } finally {
    clearTimeout(t);
  }
}

async function safeCall(data: string): Promise<string> {
  for (const url of RPC_URLS) {
    try {
      const r = await ethCallOne(url, data);
      if (r && r !== "0x") return r;
    } catch (e) {
      console.warn(`[frame/image] RPC fail ${url}:`, (e as Error).message);
    }
  }
  return "0x";
}

async function fetchFrameStats() {
  const oneEthHex = toUint256Hex(10n ** 18n);
  const [supplyHex, stabilityHex, quoteHex] = await Promise.all([
    safeCall(SELECTORS.totalSupply),
    safeCall(SELECTORS.stabilityFund),
    safeCall(buildCallData(SELECTORS.quoteBuyGBLIN, oneEthHex)),
  ]);

  const supply = formatEther(hexToBigInt(supplyHex));
  const stability = formatEther(hexToBigInt(stabilityHex));

  // quoteBuyGBLIN returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)
  // First 32-byte word is gblinOut
  let gblinPerEth = 0;
  if (quoteHex && quoteHex.length >= 66) {
    const firstWord = "0x" + quoteHex.slice(2, 66);
    gblinPerEth = formatEther(hexToBigInt(firstWord));
  }

  const keeperPayouts = stability > 0 ? Math.floor(stability / 0.0001) : 0;
  return { gblinPerEth, supply, stability, keeperPayouts };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const holdersOverride = searchParams.get("holders");
  const savedOverride = searchParams.get("saved");
  const crashOverride = searchParams.get("crash");

  let stats = { gblinPerEth: 0, supply: 0, stability: 0, keeperPayouts: 0 };
  try {
    stats = await fetchFrameStats();
  } catch (e) {
    console.error("[frame/image] failed to fetch stats", e);
  }

  const bountyDisplay =
    stats.stability > 0 ? `${fmt(stats.stability, stats.stability < 0.01 ? 6 : 4)} ETH` : "0 ETH";

  // Optional personalisation: when reshared with ?saved=...&crash=... query params,
  // the image gets a green "saved $X during {crash}" callout instead of the
  // KEEPER BOUNTY card. This lets share casts deep-link to a personalised image.
  const showSaved =
    savedOverride !== null && savedOverride !== "" && !Number.isNaN(parseFloat(savedOverride));
  const savedNumber = showSaved ? parseFloat(savedOverride!) : 0;
  const crashLabel = crashOverride ? crashOverride.toUpperCase() : "";

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
            "radial-gradient(45% 40% at 18% 18%, rgba(59,130,246,0.32) 0%, transparent 70%), " +
            "radial-gradient(40% 35% at 82% 12%, rgba(168,85,247,0.26) 0%, transparent 70%), " +
            "radial-gradient(50% 40% at 72% 82%, rgba(6,182,212,0.24) 0%, transparent 70%), " +
            "radial-gradient(40% 35% at 20% 88%, rgba(16,185,129,0.18) 0%, transparent 70%)",
          color: "#ffffff",
          padding: "48px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
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
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              G
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 900,
                  letterSpacing: -2.5,
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
                  fontSize: 18,
                  color: "#94a3b8",
                  marginTop: 6,
                  letterSpacing: 1.4,
                  display: "flex",
                  fontWeight: 600,
                }}
              >
                AUTONOMOUS BASKET · LIVE ON BASE
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 16,
              color: "#a7f3d0",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 999,
              padding: "9px 18px",
              background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))",
              fontWeight: 600,
              letterSpacing: 0.8,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#10b981",
                boxShadow: "0 0 12px #10b981",
              }}
            />
            ON-CHAIN · LIVE
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
            label={holdersOverride ? "HOLDERS" : "TOTAL SUPPLY"}
            value={
              holdersOverride
                ? holdersOverride
                : stats.supply > 0
                  ? `${fmt(stats.supply, 2)}`
                  : "—"
            }
            unit={holdersOverride ? "on-chain" : "GBLIN"}
          />
          {showSaved ? (
            <SavedCard saved={savedNumber} crashLabel={crashLabel} />
          ) : (
            <StatCard
              label="KEEPER BOUNTY"
              value={bountyDisplay.replace(" ETH", "")}
              unit="ETH"
              hint={`${stats.keeperPayouts} payouts ready`}
            />
          )}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 17,
            color: "#94a3b8",
            borderTop: "1px solid rgba(148,163,184,0.15)",
            paddingTop: 18,
            letterSpacing: 0.6,
          }}
        >
          <div style={{ display: "flex" }}>
            cbBTC · WETH · USDC · 0 admin keys · try /game
          </div>
          <div style={{ display: "flex", color: "#fbbf24", fontWeight: 700 }}>
            gblin.digital
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

function SavedCard({ saved, crashLabel }: { saved: number; crashLabel: string }) {
  const positive = saved > 0;
  const formatted = saved.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: positive
          ? "linear-gradient(135deg, rgba(16,185,129,0.20) 0%, rgba(34,211,238,0.06) 100%)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${positive ? "rgba(16,185,129,0.45)" : "rgba(148,163,184,0.2)"}`,
        borderRadius: 18,
        padding: "22px 24px",
        minHeight: 220,
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 15,
          color: positive ? "#a7f3d0" : "#cbd5e1",
          letterSpacing: 1.4,
          display: "flex",
          fontWeight: 700,
        }}
      >
        SAVED VS DIRECT HOLD
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: positive ? "#34d399" : "#ffffff",
            lineHeight: 1,
            letterSpacing: -1.8,
          }}
        >
          {positive ? "+" : ""}
          {formatted}
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#94a3b8",
          display: "flex",
          minHeight: 18,
        }}
      >
        {crashLabel ? `during ${crashLabel}` : "crash shield backtest"}
      </div>
    </div>
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
        background:
          "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(168,85,247,0.04) 100%)",
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: 18,
        padding: "22px 24px",
        minHeight: 220,
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: 15,
          color: "#cbd5e1",
          letterSpacing: 1.4,
          display: "flex",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1,
            letterSpacing: -1.8,
          }}
        >
          {value}
        </div>
        {unit && (
          <div
            style={{
              fontSize: 20,
              color: "#94a3b8",
              fontWeight: 600,
              display: "flex",
            }}
          >
            {unit}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#94a3b8",
          display: "flex",
          minHeight: 18,
        }}
      >
        {hint ?? ""}
      </div>
    </div>
  );
}
