/**
 * GET /api/x402/attestation-sample
 *
 * FREE integration-testing sample of the paid Risk Attestation
 * (/api/x402/attestation, $0.003 USDC via x402).
 *
 * WHY: the standard integration pattern in the agent economy is "free preview,
 * then pay" — a developer wires up parsing/verification against this sample,
 * then switches the URL to the paid route. Same shape, same EIP-712 schema,
 * same field names. The payload is UNUSABLE as a live risk signal: expires_at
 * is fixed in the past and `sample: true` is set at the top level.
 *
 * This route is deliberately NOT in the x402 paywall matcher (src/middleware.ts)
 * and does no chain reads — static data, hashed at request time so the
 * tamper-evident `attestation_id` flow can be exercised end-to-end for free.
 */

import { GBLIN, jsonResponse } from "@/lib/x402-helpers";
import { hashTypedData } from "viem";

export const runtime = "nodejs";

// MUST mirror /api/x402/attestation byte-for-byte (same schema as the MCP
// verifier). Do not reorder fields.
const EIP712_DOMAIN = {
  name: "GBLIN Risk Attestation",
  version: "1",
  chainId: 8453,
  verifyingContract: GBLIN,
} as const;

const EIP712_TYPES = {
  RiskAttestation: [
    { name: "regime", type: "uint8" },
    { name: "severityBps", type: "uint16" },
    { name: "defensiveCashBps", type: "uint16" },
    { name: "blockNumber", type: "uint64" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "basketHash", type: "bytes32" },
  ],
} as const;

// Frozen snapshot (calm regime, July 2026). expires_at is permanently in the
// past: every correct consumer MUST treat this attestation as expired.
const SAMPLE = {
  regimeCode: 0 as const,
  severityBps: 0,
  defensiveCashBps: 1000,
  blockNumber: 49150000,
  issuedAt: 1753500000, // 2026-07-26T02:40:00Z
  expiresAt: 1753500600, // issued + 600s — long expired, by design
  basketHash:
    "0x1111111111111111111111111111111111111111111111111111111111111111" as const,
};

// Deterministic — the sample is frozen, so compute the tamper-evident id ONCE at
// module load instead of per request. Combined with the long Cache-Control below,
// repeated polls are served from the CDN and never re-run viem's hashTypedData.
const SIGN_MESSAGE = {
  regime: SAMPLE.regimeCode,
  severityBps: SAMPLE.severityBps,
  defensiveCashBps: SAMPLE.defensiveCashBps,
  blockNumber: BigInt(SAMPLE.blockNumber),
  issuedAt: BigInt(SAMPLE.issuedAt),
  expiresAt: BigInt(SAMPLE.expiresAt),
  basketHash: SAMPLE.basketHash,
} as const;

const ATTESTATION_ID = hashTypedData({
  domain: EIP712_DOMAIN,
  types: EIP712_TYPES,
  primaryType: "RiskAttestation",
  message: SIGN_MESSAGE,
});

export async function GET() {
  const attestationId = ATTESTATION_ID;

  const res = jsonResponse({
    sample: true,
    attestation: {
      regime: "calm",
      regime_code: SAMPLE.regimeCode,
      risk_posture: "risk_on",
      severity_pct: 0,
      severity_bps: SAMPLE.severityBps,
      defensive_cash_pct: SAMPLE.defensiveCashBps / 100,
      defensive_cash_bps: SAMPLE.defensiveCashBps,
      shield_active: false,
      assets: [],
      block_number: SAMPLE.blockNumber,
      issued_at: SAMPLE.issuedAt,
      expires_at: SAMPLE.expiresAt,
      ttl_seconds: 600,
      basket_hash: SAMPLE.basketHash,
      chain_id: 8453,
      contract: GBLIN,
    },
    eip712: {
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "RiskAttestation" as const,
      message: {
        regime: SAMPLE.regimeCode,
        severityBps: SAMPLE.severityBps,
        defensiveCashBps: SAMPLE.defensiveCashBps,
        blockNumber: SAMPLE.blockNumber,
        issuedAt: SAMPLE.issuedAt,
        expiresAt: SAMPLE.expiresAt,
        basketHash: SAMPLE.basketHash,
      },
    },
    attestation_id: attestationId,
    signature: null,
    attestor: null,
    signed: false,
    verify: {
      how: "Recompute hashTypedData over `eip712` and compare to `attestation_id` (tamper-evident). Then check expires_at > now — for this sample that check MUST fail: it is permanently expired.",
      free_mcp_tool:
        "npx @gblin-protocol/mcp-server → verify_risk_attestation (pass this whole object)",
    },
    meta: {
      note: "FREE static sample for integration testing. Shape and EIP-712 schema are identical to the paid attestation; the data is frozen and expired, never a live risk signal.",
      live_endpoint:
        "GET https://gblin.digital/api/x402/attestation — $0.003 USDC via x402 (HTTP 402 flow), fresh 10-minute attestation",
    },
  });
  // Static, immutable payload — let the CDN absorb repeat polls so the function
  // is not invoked (and viem is not re-run) on every request.
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate=604800",
  );
  return res;
}
