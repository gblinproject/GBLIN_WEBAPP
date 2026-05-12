import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min — adequate for CoinGecko polling

const CONTRACT_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";

const RPC_URLS = [
  ALCHEMY_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "",
  "https://mainnet.base.org",
  "https://base.publicnode.com",
  "https://base.llamarpc.com",
].filter(Boolean);

// keccak256("totalSupply()")[0:4]
const SEL_TOTAL_SUPPLY = "0x18160ddd";

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
      console.warn("[supply/total] RPC fail:", (e as Error).message);
    }
  }
  return "0x";
}

function hexToDecimalEther(hex: string): string {
  if (!hex || hex === "0x" || hex === "0x0") return "0";
  const wei = BigInt(hex);
  // Return with 18 decimal places as a plain decimal string
  const intPart = wei / 10n ** 18n;
  const fracPart = wei % 10n ** 18n;
  const fracStr = fracPart.toString().padStart(18, "0");
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fracStr.replace(/0+$/, "") || "00";
  return `${intPart}.${trimmed}`;
}

export async function GET() {
  try {
    const hex = await safeCall(SEL_TOTAL_SUPPLY);
    const supply = hexToDecimalEther(hex);

    return new NextResponse(supply, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[supply/total] error:", err);
    return new NextResponse("0", { status: 500 });
  }
}
