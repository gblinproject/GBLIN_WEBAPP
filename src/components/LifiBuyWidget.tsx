"use client";

import { useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { LiFiWidget, WidgetEvent, useWidgetEvents, type WidgetConfig } from "@lifi/widget";
import { EthereumProvider } from "@lifi/widget-provider-ethereum";

/**
 * Console diagnostics for the execution flow ("Buy does nothing" debugging).
 * Kept in a separate component per LI.FI docs (avoids re-rendering the widget).
 */
function LifiEventsLogger() {
  const widgetEvents = useWidgetEvents();
  useEffect(() => {
    const log = (name: string) => (data: unknown) =>
      console.log(`[LI.FI] ${name}`, data);
    const subs: Array<[WidgetEvent, (d: never) => void]> = [
      [WidgetEvent.RouteSelected, log("RouteSelected")],
      [WidgetEvent.RouteExecutionStarted, log("RouteExecutionStarted")],
      [WidgetEvent.RouteExecutionUpdated, log("RouteExecutionUpdated")],
      [WidgetEvent.RouteExecutionCompleted, log("RouteExecutionCompleted")],
      [WidgetEvent.RouteExecutionFailed, log("RouteExecutionFailed")],
      [WidgetEvent.RouteHighValueLoss, log("RouteHighValueLoss")],
      [WidgetEvent.AvailableRoutes, log("AvailableRoutes")],
    ];
    subs.forEach(([e, h]) => widgetEvents.on(e, h as never));
    return () => subs.forEach(([e, h]) => widgetEvents.off(e, h as never));
  }, [widgetEvents]);
  return null;
}

// GBLIN V6 vault (also the ERC20 token itself) and USDC on Base
const GBLIN_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;

const WETH_BASE = "0x4200000000000000000000000000000000000006";

const GBLIN_IFACE = new ethers.Interface([
  "function buyGBLINWithToken(bytes path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut)",
]);

// Uniswap V3 path: USDC --0.05% pool--> WETH (same 500-fee pool the vault's own
// basket config uses for USDC). 20b token + 3b fee + 20b token.
const USDC_TO_WETH_PATH = ethers.hexlify(
  ethers.concat([
    ethers.getBytes(USDC_BASE),
    ethers.getBytes(ethers.toBeHex(500, 3)),
    ethers.getBytes(WETH_BASE),
  ])
);

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
    // buyGBLINWithToken: the vault pulls the USDC, swaps it USDC->WETH on the
    // 0.05% Uniswap pool, then runs the FULL mint mechanics (_mintGBLIN):
    // keeper reserve top-up via _splitFee, on-buy diversification into the
    // 45/45/10 basket, and NAV accretion — unlike buyGBLINInKind, which skips
    // the fee split and diversification. minWethOut is 0 because minGblinOut
    // already bounds the whole output (a sandwiched inner swap lowers gblinOut
    // below the floor and reverts). If the call reverts for any reason, the
    // LI.FI executor's fallback delivers the USDC to the user's wallet.
    const callData = GBLIN_IFACE.encodeFunctionData("buyGBLINWithToken", [
      USDC_TO_WETH_PATH,
      usdcAmount,
      0n,
      minGblinOut,
    ]);
    return {
      integrator: "gblin",
      // Optional key from the LI.FI partner portal (higher rate limits).
      apiKey: process.env.NEXT_PUBLIC_LIFI_API_KEY || undefined,
      variant: "compact",
      appearance: "dark",
      // REQUIRED for contract calls: without mode "custom" the widget ignores
      // `contractCalls` and behaves as a plain exchange (user saw USDT->USDC
      // with no GBLIN step). "checkout" = fixed destination amount (the user
      // already picked the amount in our UI), source side is computed.
      mode: "custom",
      modeOptions: { custom: { type: "checkout" } },
      // REQUIRED: without an explicit wallet provider the widget has NO
      // connectors and shows "Available wallets not found". EVM connectors
      // cover MetaMask, Coinbase Wallet and any injected (EIP-6963) wallet.
      providers: [EthereumProvider({ metaMask: true, coinbase: true })],
      // REQUIRED in practice: the widget's default public RPCs (publicnode)
      // died with ERR_CONNECTION_CLOSED in testing — with no reachable RPC on
      // the source chain the Buy click can't even build the transaction and
      // does nothing. Official fix per LI.FI docs: pass our own rpcUrls.
      // Multiple endpoints per chain = automatic fallback.
      sdkConfig: {
        rpcUrls: {
          1: ["https://cloudflare-eth.com", "https://eth.drpc.org", "https://1rpc.io/eth"],
          8453: ["https://mainnet.base.org", "https://base.drpc.org", "https://1rpc.io/base"],
          42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org"],
          10: ["https://mainnet.optimism.io", "https://optimism.drpc.org"],
          137: ["https://polygon-rpc.com", "https://1rpc.io/matic"],
        },
      },
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
          // Higher than the in-kind path: covers the internal USDC->WETH swap
          // plus the on-buy diversification swaps inside _mintGBLIN.
          toContractGasLimit: "1200000",
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

  return (
    <>
      <LifiEventsLogger />
      <LiFiWidget integrator="gblin" config={config} />
    </>
  );
}
