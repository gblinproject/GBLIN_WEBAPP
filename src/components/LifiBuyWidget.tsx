"use client";

import { useMemo } from "react";
import { ethers } from "ethers";
import { LiFiWidget, type WidgetConfig } from "@lifi/widget";

// GBLIN V6 vault (also the ERC20 token itself) and USDC on Base
const GBLIN_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;

const GBLIN_IFACE = new ethers.Interface([
  "function buyGBLINInKind(address token, uint256 amountIn, uint256 minGblinOut)",
]);

interface LifiBuyWidgetProps {
  /** USDC needed on Base for the buy, in USDC wei (6 decimals) */
  usdcAmount: bigint;
  /** Minimum GBLIN out (18 decimals), already slippage-buffered */
  minGblinOut: bigint;
}

/**
 * LI.FI Widget configured as a cross-chain "zap" into GBLIN.
 *
 * The user pays with ANY token on ANY supported chain (no per-token allowlist —
 * LI.FI auto-routes anything with liquidity). LI.FI delivers the exact USDC
 * amount on Base to its executor, which approves it to the GBLIN vault and
 * calls buyGBLINInKind. GBLIN mints to the executor (msg.sender), and because
 * `toTokenAddress` is set to GBLIN, the executor forwards the minted GBLIN to
 * the user's wallet. If anything fails after bridging, funds fall back to the
 * user (sending address), never to us. Non-custodial end to end.
 */
export default function LifiBuyWidget({ usdcAmount, minGblinOut }: LifiBuyWidgetProps) {
  const config = useMemo<WidgetConfig>(() => {
    const callData = GBLIN_IFACE.encodeFunctionData("buyGBLINInKind", [
      USDC_BASE,
      usdcAmount,
      minGblinOut,
    ]);
    return {
      integrator: "gblin",
      // Optional key from the LI.FI partner portal (higher rate limits).
      apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
      variant: "compact",
      appearance: "dark",
      // Destination is fixed: exact USDC amount on Base, then the vault call.
      toChain: BASE_CHAIN_ID,
      toToken: USDC_BASE,
      toAmount: ethers.formatUnits(usdcAmount, 6),
      formUpdateKey: usdcAmount.toString(),
      contractCalls: [
        {
          fromAmount: usdcAmount.toString(),
          fromTokenAddress: USDC_BASE,
          toContractAddress: GBLIN_ADDRESS,
          toContractCallData: callData,
          toContractGasLimit: "900000",
          // The executor approves USDC to the vault before calling it.
          toApprovalAddress: GBLIN_ADDRESS,
          // GBLIN (the vault IS the ERC20) is the call's output token:
          // the executor forwards the minted GBLIN to the user.
          toTokenAddress: GBLIN_ADDRESS,
        },
      ],
      contractComponent: (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(245,158,11,0.25)",
            background: "rgba(245,158,11,0.06)",
            color: "#fbbf24",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Buy GBLIN</strong> — pay with any token on any chain. Your
          payment is routed to USDC on Base and minted into GBLIN at NAV by the
          vault. The GBLIN arrives in your wallet.
        </div>
      ),
      theme: {
        container: {
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "16px",
        },
      },
    };
  }, [usdcAmount, minGblinOut]);

  return <LiFiWidget integrator="gblin" config={config} />;
}
