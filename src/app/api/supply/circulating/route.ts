import { NextResponse } from "next/server";
import { readSupply } from "@/lib/supply";

/** Circulating supply of GBLIN as a plain decimal number (total minus shares that can never be redeemed; see /api/supply), for aggregators such as CoinGecko. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await readSupply();
    return new NextResponse(s.circulating_supply, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    // Never answer 0: a zero supply would be a figure this endpoint has not measured.
    console.error("[supply/circulating]", (err as Error).message);
    return new NextResponse("unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}
