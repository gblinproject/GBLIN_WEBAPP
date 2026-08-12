import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min — adequate for CoinGecko polling

const CONTRACT_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0"; // V6

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";

// Free public RPCs first; Alchemy only as a last-resort backstop so aggregator
// polling of this endpoint doesn't drain the Alchemy plan.
const RPC_URLS = [
  "https://base.publicnode.com",
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  ALCHEMY_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "",
].filter(Boolean);

// keccak256("totalSupply()")[0:4]
const SEL_TOTAL_SUPPLY = "0x18160ddd";
// keccak256("balanceOf(address)")[0:4]
const SEL_BALANCE_OF = "0x70a08231";

function padAddress(addr: string): string {
  return addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

async function ethCallOne(url: string, data: string, timeoutMs = 4000): Promise<string> {
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
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; error?: { message: string } };
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
      console.warn("[supply/circulating] RPC fail:", (e as Error).message);
    }
  }
  return "0x";
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x" || hex === "0x0") return 0n;
  return BigInt(hex);
}

function bigIntToDecimalEther(wei: bigint): string {
  if (wei <= 0n) return "0";
  const intPart = wei / 10n ** 18n;
  const fracPart = wei % 10n ** 18n;
  const fracStr = fracPart.toString().padStart(18, "0");
  const trimmed = fracStr.replace(/0+$/, "") || "00";
  return `${intPart}.${trimmed}`;
}

export async function GET() {
  try {
    // Fetch totalSupply and contract's own GBLIN balance in parallel.
    // Circulating = totalSupply - balanceOf(contractAddress)
    // The contract holds un-distributed / reserve tokens, so subtracting
    // gives the supply actually circulating in external wallets.
    const [totalHex, contractBalHex] = await Promise.all([
      safeCall(SEL_TOTAL_SUPPLY),
      safeCall(SEL_BALANCE_OF + padAddress(CONTRACT_ADDRESS)),
    ]);

    const total = hexToBigInt(totalHex);
    const contractBal = hexToBigInt(contractBalHex);
    const circulating = total > contractBal ? total - contractBal : total;

    return new NextResponse(bigIntToDecimalEther(circulating), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[supply/circulating] error:", err);
    return new NextResponse("0", { status: 500 });
  }
}
