import { NextRequest, NextResponse } from "next/server";

/*
 * POST /api/transak-session
 *
 * Official Transak integration (docs.transak.com):
 *  1. POST /partners/api/v2/refresh-token  → accessToken  (cached, valid 7 days)
 *  2. POST /api/v2/auth/session            → widgetUrl    (valid 5 min, single-use)
 *
 * Env vars required on Vercel:
 *   TRANSAK_API_SECRET  – partner api-secret (server-only, never expose to client)
 *
 * The API key is hardcoded because it is a public identifier.
 */

const TRANSAK_API_KEY = "84b36c5b-0c95-4241-a1eb-0f8dd87a8a03";
const REFERRER_DOMAIN = "gblin.digital";
// Using staging until KYB is approved for production
const API_BASE = "https://api-stg.transak.com";
const GATEWAY_BASE = "https://api-gateway-stg.transak.com";

// ── In-memory access-token cache (token valid 7 days per Transak docs) ──
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0; // unix ms

async function getAccessToken(apiSecret: string): Promise<string> {
  // Return cached token if still valid (with 1 hour safety margin)
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 3600_000) {
    return cachedAccessToken;
  }

  const res = await fetch(`${API_BASE}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey: TRANSAK_API_KEY }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[transak] refresh-token failed:", res.status, errBody);
    throw new Error(`Transak refresh-token ${res.status}: ${errBody}`);
  }

  const json = await res.json();
  const token = json?.data?.accessToken as string | undefined;
  const expiresAt = json?.data?.expiresAt as number | undefined;

  if (!token) throw new Error("No accessToken in response");

  cachedAccessToken = token;
  // expiresAt from Transak is a unix timestamp in seconds
  cachedTokenExpiresAt = expiresAt ? expiresAt * 1000 : Date.now() + 6 * 24 * 3600_000;

  return token;
}

export async function POST(req: NextRequest) {
  const TRANSAK_API_SECRET = process.env.TRANSAK_API_SECRET;

  if (!TRANSAK_API_SECRET) {
    return NextResponse.json(
      { error: "TRANSAK_API_SECRET not configured" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();
    const walletAddress = body.walletAddress as string;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Valid walletAddress required" }, { status: 400 });
    }

    // Step 1 — get (cached) partner access token
    const accessToken = await getAccessToken(TRANSAK_API_SECRET);

    // Step 2 — create single-use widgetUrl with sessionId
    const sessionRes = await fetch(`${GATEWAY_BASE}/api/v2/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": accessToken,
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey: TRANSAK_API_KEY,
          referrerDomain: REFERRER_DOMAIN,
          productsAvailed: "SELL",
          cryptoCurrencyCode: "ETH",
          network: "base",
          defaultFiatCurrency: "EUR",
          walletAddress,
          disableWalletAddressForm: true,
          themeColor: "f59e0b",
          hideMenu: true,
          redirectURL: "https://gblin.digital/account",
        },
      }),
    });

    if (!sessionRes.ok) {
      const errBody = await sessionRes.text();
      console.error("[transak] create-session failed:", sessionRes.status, errBody);
      // If token was stale, clear cache so next call retries
      if (sessionRes.status === 401) {
        cachedAccessToken = null;
        cachedTokenExpiresAt = 0;
      }
      return NextResponse.json({ error: "Failed to create widget session" }, { status: 502 });
    }

    const sessionData = await sessionRes.json();
    const widgetUrl = sessionData?.data?.widgetUrl as string | undefined;
    if (!widgetUrl) {
      console.error("[transak] no widgetUrl in response:", JSON.stringify(sessionData));
      return NextResponse.json({ error: "No widgetUrl returned" }, { status: 502 });
    }

    return NextResponse.json({ widgetUrl });
  } catch (err) {
    console.error("[transak] session error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
