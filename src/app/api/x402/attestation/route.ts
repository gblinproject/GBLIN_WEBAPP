/**
 * GET /api/x402/attestation
 *
 * GBLIN Risk Attestation — a perishable (10-minute), verifiable snapshot of the
 * on-chain BTC/ETH risk regime (calm | elevated | crash) derived from GBLIN's
 * Crash Shield on Base mainnet.
 *
 * WHY THIS EXISTS (the agent hook — novel):
 *   An autonomous agent can ATTACH this attestation to its own actions as portable
 *   proof-of-diligence ("I checked market risk before moving capital"), and any
 *   counterparty / vault / peer agent can verify it in ONE step — without
 *   re-reading the chain. Because it expires in 10 minutes, any workflow that
 *   gates on a *fresh* attestation forces the agent to re-fetch each cycle →
 *   recurring, compounding call volume. No other x402 endpoint sells a reusable,
 *   attachable "proof you checked risk".
 *
 * TRUST MODEL (keyless by default, cryptographic when configured):
 *   • attestation_id = the EIP-712 digest of the canonical struct. ANYONE can
 *     recompute it from `eip712` and detect tampering — no key required.
 *   • If GBLIN_ATTESTOR_PRIVATE_KEY is set (Vercel env), the response ALSO carries
 *     an EIP-712 `signature` from GBLIN's published attestor address, so verifiers
 *     recover the signer in a single ecrecover.
 *   • The private key lives ONLY in the server env. This route never exposes it,
 *     and degrades gracefully (unsigned, still tamper-evident) when it is absent.
 *
 * Paywall: $0.003 USDC per call (src/middleware.ts). Read-only on-chain.
 * Free verifier: `verify_risk_attestation` in @gblin-protocol/mcp-server.
 */

import {
  GBLIN_V5,
  client,
  getBasketState,
  jsonResponse,
} from "@/lib/x402-helpers";
import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const runtime = "nodejs";

const TTL_SECONDS = 600; // 10 minutes — perishable by design

// ── EIP-712 schema ──────────────────────────────────────────────────────────
// MUST stay byte-for-byte identical to the MCP verifier
// (@gblin-protocol/mcp-server → verify_risk_attestation). Do not reorder fields.
const EIP712_DOMAIN = {
  name: "GBLIN Risk Attestation",
  version: "1",
  chainId: 8453,
  verifyingContract: GBLIN_V5, // GBLIN_V6 production contract on Base
} as const;

const EIP712_TYPES = {
  RiskAttestation: [
    { name: "regime", type: "uint8" }, // 0 calm, 1 elevated, 2 crash
    { name: "severityBps", type: "uint16" }, // max drawdown-driven weight cut, bps
    { name: "defensiveCashBps", type: "uint16" }, // USDC dynamic weight, bps
    { name: "blockNumber", type: "uint64" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "basketHash", type: "bytes32" }, // binds to exact on-chain weights
  ],
} as const;

const REGIME_LABEL = ["calm", "elevated", "crash"] as const;
const POSTURE_LABEL = ["risk_on", "reduce", "risk_off"] as const;

export async function GET() {
  try {
    const [basket, blockNumber] = await Promise.all([
      getBasketState(),
      client.getBlockNumber(),
    ]);

    // ── Regime math — IDENTICAL to the MCP get_market_risk_regime tool ───────
    const riskAssets = basket.entries.filter((e) => !e.isStable);
    const assets = riskAssets.map((e) => {
      const cut =
        e.baseWeightBps > 0
          ? Math.max(
              0,
              ((e.baseWeightBps - e.dynamicWeightBps) / e.baseWeightBps) * 100
            )
          : 0;
      return {
        token: e.token,
        shielded: e.isSlashed,
        base_weight_pct: e.baseWeightBps / 100,
        dynamic_weight_pct: e.dynamicWeightBps / 100,
        weight_cut_pct: Number(cut.toFixed(2)),
      };
    });

    const maxCut = assets.reduce((m, a) => Math.max(m, a.weight_cut_pct), 0);
    const usdcEntry = basket.entries.find((e) => e.isStable);
    const defensiveCashBps = usdcEntry ? usdcEntry.dynamicWeightBps : 0;

    let regimeCode: 0 | 1 | 2;
    if (maxCut <= 0) regimeCode = 0;
    else if (maxCut < 40) regimeCode = 1;
    else regimeCode = 2;

    const severityBps = Math.min(65535, Math.round(maxCut * 100));

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + TTL_SECONDS;

    // basketHash binds the attestation to the exact on-chain weights it summarizes.
    const basketHash = keccak256(
      encodeAbiParameters(
        [
          {
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "base", type: "uint256" },
              { name: "dyn", type: "uint256" },
            ],
          },
        ],
        [
          basket.entries.map((e) => ({
            token: e.token,
            base: BigInt(e.baseWeightBps),
            dyn: BigInt(e.dynamicWeightBps),
          })),
        ]
      )
    );

    // Message signed / hashed (uint64 fields as bigint for viem).
    const signMessage = {
      regime: regimeCode,
      severityBps,
      defensiveCashBps,
      blockNumber,
      issuedAt: BigInt(issuedAt),
      expiresAt: BigInt(expiresAt),
      basketHash,
    } as const;

    const attestationId = hashTypedData({
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "RiskAttestation",
      message: signMessage,
    });

    // Optional cryptographic signature (only when the attestor key is configured).
    let signature: Hex | null = null;
    let attestor: string | null = null;
    const rawKey = process.env.GBLIN_ATTESTOR_PRIVATE_KEY;
    if (rawKey && /^0x[0-9a-fA-F]{64}$/.test(rawKey)) {
      const account = privateKeyToAccount(rawKey as Hex);
      attestor = account.address;
      signature = await account.signTypedData({
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: "RiskAttestation",
        message: signMessage,
      });
    }

    // JSON-safe EIP-712 payload a verifier recomputes / recovers over.
    const eip712Public = {
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "RiskAttestation" as const,
      message: {
        regime: regimeCode,
        severityBps,
        defensiveCashBps,
        blockNumber: Number(blockNumber),
        issuedAt,
        expiresAt,
        basketHash,
      },
    };

    return jsonResponse({
      attestation: {
        regime: REGIME_LABEL[regimeCode],
        regime_code: regimeCode,
        risk_posture: POSTURE_LABEL[regimeCode],
        severity_pct: Number(maxCut.toFixed(2)),
        severity_bps: severityBps,
        defensive_cash_pct: defensiveCashBps / 100,
        defensive_cash_bps: defensiveCashBps,
        shield_active: basket.crashShieldActive,
        assets,
        block_number: Number(blockNumber),
        issued_at: issuedAt,
        expires_at: expiresAt,
        ttl_seconds: TTL_SECONDS,
        basket_hash: basketHash,
        chain_id: 8453,
        contract: GBLIN_V5,
      },
      eip712: eip712Public,
      attestation_id: attestationId,
      signature,
      attestor,
      signed: signature !== null,
      verify: {
        how: signature
          ? "Recover the EIP-712 signer from `signature` over `eip712`; check it equals `attestor` AND GBLIN's published attestor address, then check expires_at > now."
          : "Recompute hashTypedData over `eip712` and compare to `attestation_id` (tamper-evident); authenticity relies on the gblin.digital TLS origin until an attestor key is configured. Then check expires_at > now.",
        free_mcp_tool:
          "npx @gblin-protocol/mcp-server → verify_risk_attestation (pass this whole object)",
        basescan:
          "https://basescan.org/address/0x36C81d7E1966310F305eA637e761Cf77F90852f0#readContract",
      },
      meta: {
        note: "Attach this to your action as proof you checked market risk. Re-fetch when expired.",
        source:
          "GBLIN on-chain Crash Shield (Base mainnet, Chainlink-oracle drawdown)",
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: (err as Error).message,
        hint: "Check RPC connectivity and oracle freshness.",
      },
      500
    );
  }
}
