import { NextRequest, NextResponse } from "next/server";

const TRANSAK_API_KEY = "0bafda03-0ae5-4a65-849e-54971b453ab2";
const API_BASE = "https://api.transak.com";

// Reuse cached token from session route via module-level (separate cache here)
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken(apiSecret: string): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 3600_000) {
    return cachedAccessToken;
  }
  const res = await fetch(`${API_BASE}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-secret": apiSecret },
    body: JSON.stringify({ apiKey: TRANSAK_API_KEY }),
  });
  if (!res.ok) throw new Error(`Transak refresh-token ${res.status}`);
  const json = await res.json();
  const token = json?.data?.accessToken as string | undefined;
  if (!token) throw new Error("No accessToken in response");
  const expiresAt = json?.data?.expiresAt as number | undefined;
  cachedAccessToken = token;
  cachedTokenExpiresAt = expiresAt ? expiresAt * 1000 : Date.now() + 6 * 24 * 3600_000;
  return token;
}

export async function GET(req: NextRequest) {
  const TRANSAK_API_SECRET = process.env.TRANSAK_API_SECRET;
  if (!TRANSAK_API_SECRET) {
    return NextResponse.json({ error: "TRANSAK_API_SECRET not configured" }, { status: 501 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(TRANSAK_API_SECRET);
    const res = await fetch(`${API_BASE}/partners/api/v2/order/${orderId}`, {
      headers: {
        "access-token": accessToken,
        "api-key": TRANSAK_API_KEY,
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[transak-order] fetch failed:", res.status, errBody);
      return NextResponse.json({ error: "Failed to fetch order" }, { status: 502 });
    }

    const data = await res.json();
    const status = data?.data?.status as string | undefined;
    return NextResponse.json({ status, raw: data?.data });
  } catch (err) {
    console.error("[transak-order] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
