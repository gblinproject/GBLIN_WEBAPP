import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/transak-session
 * 
 * Generates a Transak widgetUrl with sessionId for iframe embedding.
 * Requires TRANSAK_API_KEY and TRANSAK_API_SECRET in env vars.
 * 
 * If no secret is configured, returns 501 so the frontend falls back
 * to opening Transak in a new browser tab.
 */
export async function POST(req: NextRequest) {
  const TRANSAK_API_KEY = process.env.TRANSAK_API_KEY || "0bafda03-0ae5-4a65-849e-54971b453ab2";
  const TRANSAK_API_SECRET = process.env.TRANSAK_API_SECRET;

  if (!TRANSAK_API_KEY || !TRANSAK_API_SECRET) {
    return NextResponse.json(
      { error: "Transak credentials not configured" },
      { status: 501 }
    );
  }

  const apiBase = "https://api.transak.com";
  const gatewayBase = "https://api-gateway.transak.com";

  try {
    const body = await req.json();
    const walletAddress = body.walletAddress as string;
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    // Step 1: Get partner access token
    const tokenRes = await fetch(`${apiBase}/partners/api/v2/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-secret": TRANSAK_API_SECRET,
      },
      body: JSON.stringify({ apiKey: TRANSAK_API_KEY }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Transak refresh-token failed:", err);
      return NextResponse.json({ error: "Failed to get access token" }, { status: 502 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.data?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token returned" }, { status: 502 });
    }

    // Step 2: Create widget URL with sessionId
    const sessionRes = await fetch(`${gatewayBase}/api/v2/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": accessToken,
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey: TRANSAK_API_KEY,
          referrerDomain: "gblin.digital",
          productsAvailed: "SELL",
          cryptoCurrencyCode: "ETH",
          network: "base",
          defaultFiatCurrency: "EUR",
          walletAddress,
          disableWalletAddressForm: true,
          themeColor: "f59e0b",
          hideMenu: true,
        },
      }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      console.error("Transak session failed:", err);
      return NextResponse.json({ error: "Failed to create widget session" }, { status: 502 });
    }

    const sessionData = await sessionRes.json();
    const widgetUrl = sessionData?.data?.widgetUrl;
    if (!widgetUrl) {
      return NextResponse.json({ error: "No widgetUrl returned" }, { status: 502 });
    }

    return NextResponse.json({ widgetUrl });
  } catch (err) {
    console.error("Transak session error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
