import { NextResponse } from "next/server";
import { readSupply } from "@/lib/supply";

/**
 * Supply disclosure: total, circulating, what is excluded and why, and the balances of
 * project-operated wallets. The plain-number endpoints /api/supply/total and
 * /api/supply/circulating serve the same figures for aggregators.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await readSupply();
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[supply]", (err as Error).message);
    return NextResponse.json(
      { error: "supply unavailable", detail: "an on-chain read failed; no figure is published rather than a wrong one" },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
