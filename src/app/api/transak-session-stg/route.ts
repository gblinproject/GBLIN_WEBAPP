import { NextRequest, NextResponse } from "next/server";

/*
 * POST /api/transak-session-stg
 *
 * Same as /api/transak-session but for Transak STAGING environment.
 * Used to open a Transak staging widget (e.g. for support / recovery).
 *
 * Env vars required on Vercel:
 *   TRANSAK_API_SECRET_STG  – staging partner api-secret
 */

const TRANSAK_API_KEY_STG = "84b36c5b-0c95-4241-a1eb-0f8dd87a8a03";
const REFERRER_DOMAIN = "gblin.digital";
const API_BASE_STG = "https://api-stg.transak.com";
const GATEWAY_BASE_STG = "https://api-gateway-stg.transak.com";

// ── In-memory access-token cache (staging) ──
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken(apiSecret: string): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 3600_000) {
    return cachedAccessToken;
  }

  const res = await fetch(`${API_BASE_STG}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey: TRANSAK_API_KEY_STG }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[transak-stg] refresh-token failed:", res.status, errBody);
    throw new Error(`Transak STG refresh-token ${res.status}: ${errBody}`);
  }

  const json = await res.json();
  const token = json?.data?.accessToken as string | undefined;
  const expiresAt = json?.data?.expiresAt as number | undefined;

  if (!token) throw new Error("No accessToken in STG response");

  cachedAccessToken = token;
  cachedTokenExpiresAt = expiresAt ? expiresAt * 1000 : Date.now() + 6 * 24 * 3600_000;

  return token;
}

export async function POST(req: NextRequest) {
  const TRANSAK_API_SECRET = process.env.TRANSAK_API_SECRET_STG;

  if (!TRANSAK_API_SECRET) {
    return NextResponse.json(
      { error: "TRANSAK_API_SECRET_STG not configured" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();
    const walletAddress = body.walletAddress as string;
    const cryptoAmount = body.cryptoAmount as number | undefined;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Valid walletAddress required" }, { status: 400 });
    }

    const accessToken = await getAccessToken(TRANSAK_API_SECRET);

    const widgetParams: Record<string, unknown> = {
      apiKey: TRANSAK_API_KEY_STG,
      referrerDomain: REFERRER_DOMAIN,
      productsAvailed: "SELL",
      cryptoCurrencyCode: "ETH",
      network: "base",
      fiatCurrency: "EUR",
      walletAddress,
      disableWalletAddressForm: true,
      themeColor: "f59e0b",
      hideMenu: true,
    };
    if (cryptoAmount && cryptoAmount > 0) {
      widgetParams.cryptoAmount = cryptoAmount;
    }

    const sessionRes = await fetch(`${GATEWAY_BASE_STG}/api/v2/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": accessToken,
      },
      body: JSON.stringify({ widgetParams }),
    });

    if (!sessionRes.ok) {
      const errBody = await sessionRes.text();
      console.error("[transak-stg] create-session failed:", sessionRes.status, errBody);
      if (sessionRes.status === 401) {
        cachedAccessToken = null;
        cachedTokenExpiresAt = 0;
      }
      return NextResponse.json({ error: "Failed to create STG widget session" }, { status: 502 });
    }

    const sessionData = await sessionRes.json();
    const widgetUrl = sessionData?.data?.widgetUrl as string | undefined;
    if (!widgetUrl) {
      console.error("[transak-stg] no widgetUrl in response:", JSON.stringify(sessionData));
      return NextResponse.json({ error: "No widgetUrl returned" }, { status: 502 });
    }

    return NextResponse.json({ widgetUrl });
  } catch (err) {
    console.error("[transak-stg] session error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
