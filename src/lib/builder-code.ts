/**
 * ERC-8021 Builder Code suffix — on-chain attribution for Base.
 *
 * Appended to the calldata of every GBLIN-originated transaction so Base's
 * indexers attribute the volume to our registered app (dashboard.base.org,
 * app id 6a16deb1f4a52373ee3e7762). Contracts ignore the extra bytes.
 *
 * Layout, parsed backwards per the ERC-8021 spec:
 *   16-byte marker 0x80218021802180218021802180218021
 *   1-byte schemaId 0x00
 *   1-byte codesLength 0x0b (11)
 *   codes "bc_gbdo32j0" in ASCII
 * The full hex matches the "Encoded String" shown in the Base Dashboard
 * under Builder Codes for this app.
 *
 * Deliberately NOT applied to the heartbeat market-making bot: tagging our
 * own liquidity churn would inflate app-usage metrics (same integrity rule
 * we follow for the x402 Bazaar).
 */

export const BUILDER_CODE = "bc_gbdo32j0";

export const BUILDER_CODE_SUFFIX =
  "0x62635f6762646f33326a300b0080218021802180218021802180218021" as const;

/** Append the ERC-8021 suffix to already-encoded calldata. */
export function withBuilderSuffix(data: `0x${string}`): `0x${string}` {
  return (data + BUILDER_CODE_SUFFIX.slice(2)) as `0x${string}`;
}
