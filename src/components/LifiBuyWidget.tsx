"use client";

import { useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { LiFiWidget, NFT, WidgetEvent, useWidgetEvents, type WidgetConfig } from "@lifi/widget";
import { lifiEvmProvider } from "@/lib/lifi-evm";

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
const GBLIN_ADDRESS = "0xc2181d975c05c8c724b334bcED0764c0b86B1D53";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;


const GBLIN_IFACE = new ethers.Interface([
  "function buyGBLINInKind(address token, uint256 amountIn, uint256 minOut)",
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
    // The vault never swaps, and USDC is one of its basket rows: the executor's USDC goes in as an
    // in-kind deposit, priced at NAV by the oracle with no pool in the path. The fee is the in-kind
    // floor plus a deviation tax that only bites if the deposit pushes the row past its target, and
    // `minGblinOut` bounds the whole output. If the call reverts for any reason, the LI.FI executor's
    // fallback delivers the USDC to the user's wallet.
    // Single source of truth for the vault call: used for the QUOTE (static
    // `contractCalls` below) AND rebuilt at EXECUTION time by the
    // `getContractCalls` hook with the exact delivered USDC amount.
    const buildContractCall = (amountIn: bigint) => ({
      fromAmount: amountIn.toString(),
      fromTokenAddress: USDC_BASE,
      toContractAddress: GBLIN_ADDRESS,
      toContractCallData: GBLIN_IFACE.encodeFunctionData("buyGBLINInKind", [
        USDC_BASE,
        amountIn,
        minGblinOut,
      ]),
      // An in-kind deposit prices the basket and mints: no swap, no pool, so the ceiling is well above
      // what it needs and costs nothing when unused.
      toContractGasLimit: "900000",
      // The executor approves USDC to the vault before calling it.
      toApprovalAddress: GBLIN_ADDRESS,
      // GBLIN (the vault IS the ERC20) is the call's output token:
      // the executor forwards the minted GBLIN to the user.
      toTokenAddress: GBLIN_ADDRESS,
    });
    const contractCalls = [buildContractCall(usdcAmount)];
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
      // The custom sdkProvider wraps every wallet client with the EIP-5792
      // kill switch (see withoutBatching above).
      providers: [lifiEvmProvider],
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
        // REQUIRED for execution of contract-call routes: at execution time the
        // SDK re-derives the calls via executionOptions.getContractCalls with
        // the exact delivered amount (sdk-provider-ethereum/getUpdatedStep.ts
        // throws "Contract calls are not found." without it — the form's
        // contractCalls only feed the QUOTE). The widget's public type narrows
        // executionOptions to updateTransactionRequestHook only, but at runtime
        // it spreads the whole object into executeRoute (useRouteExecution.js),
        // hence the cast.
        executionOptions: {
          getContractCalls: async (params: { toAmount: bigint }) => ({
            // GUARD (verified live + via API repro): for contract-call routes
            // the SDK passes toAmount = BigInt(step.estimate.toAmount), and the
            // estimate is 0 (LI.FI cannot price the custom call's GBLIN
            // output). Rebuilding with 0 produced fromAmount "0", which
            // li.quest rejects with 400 isBigNumberish. Use the SDK amount
            // only when real; otherwise our exact-out usdcAmount.
            contractCalls: [
              buildContractCall(params.toAmount > 0n ? params.toAmount : usdcAmount),
            ],
          }),
        } as never,
      },
      // Destination is fixed: exact USDC amount on Base, then the vault call.
      toChain: BASE_CHAIN_ID,
      toToken: USDC_BASE,
      toAmount: ethers.formatUnits(usdcAmount, 6),
      formUpdateKey: usdcAmount.toString(),
      contractCalls,
      contractComponent: (
        <div>
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
            payment is routed to USDC on Base and minted into GBLIN at NAV by
            the vault. The GBLIN arrives in your wallet.
          </div>
          {/* CRITICAL: NFT (a generic "item + price" checkout card, despite the
              name) is the official component that writes toChain/toToken/
              toAmount AND `contractCalls` into the widget's internal form
              store. Without one of these components the form's contractCalls
              stays empty, no contract-call quote is ever fetched, routes stay
              empty and the Buy button silently no-ops (`if (!currentRoute)
              return`). It displays GBLIN as the purchased item, priced in
              USDC — the `token` prop is the PRICE (what LI.FI must deliver),
              not the item. */}
          <NFT
            imageUrl="https://raw.githubusercontent.com/gblinproject/GBLIN/main/LOGO_GBLIN.svg"
            collectionName="GBLIN Protocol"
            assetName="GBLIN — Global Balanced Liquidity Index"
            token={{
              address: USDC_BASE,
              chainId: BASE_CHAIN_ID,
              symbol: "USDC",
              decimals: 6,
              name: "USD Coin",
              priceUSD: "1",
              logoURI:
                "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
              amount: usdcAmount,
            }}
            contractCall={contractCalls[0]}
          />
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
