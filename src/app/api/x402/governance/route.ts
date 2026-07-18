/**
 * GET /api/x402/governance
 *
 * Verifies GBLIN protocol governance state: confirms whether GBLIN is
 * owned by the 48h Timelock, reads the timelock's min delay, and reports
 * the founder wallet. Use to gate trust-sensitive agent actions.
 *
 * Paywall: $0.001 USDC per call.
 */

import { getAddress } from "viem";
import {
  EXPECTED_MIN_DELAY_SECONDS,
  GBLIN_ABI,
  GBLIN_TIMELOCK,
  GBLIN,
  TIMELOCK_ABI,
  client,
  jsonResponse,
} from "@/lib/x402-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [owner, founder] = await Promise.all([
      client.readContract({
        address: GBLIN,
        abi: GBLIN_ABI,
        functionName: "owner",
      }),
      client.readContract({
        address: GBLIN,
        abi: GBLIN_ABI,
        functionName: "founderWallet",
      }),
    ]);

    const ownerNorm = getAddress(owner);
    const timelockNorm = getAddress(GBLIN_TIMELOCK);
    const ownerIsTimelock = ownerNorm === timelockNorm;
    const ownerIsRenounced =
      ownerNorm === "0x0000000000000000000000000000000000000000";

    let timelockState: Record<string, unknown>;
    try {
      const minDelay = await client.readContract({
        address: GBLIN_TIMELOCK,
        abi: TIMELOCK_ABI,
        functionName: "getMinDelay",
      });
      timelockState = {
        address: timelockNorm,
        min_delay_seconds: Number(minDelay),
        min_delay_hours: Number(minDelay) / 3600,
        min_delay_matches_expected: minDelay === EXPECTED_MIN_DELAY_SECONDS,
        expected_min_delay_seconds: Number(EXPECTED_MIN_DELAY_SECONDS),
      };
    } catch (err) {
      timelockState = {
        address: timelockNorm,
        error: `Could not read timelock state: ${(err as Error).message}`,
      };
    }

    return jsonResponse({
      contract: GBLIN,
      owner: ownerNorm,
      owner_is_timelock: ownerIsTimelock,
      owner_is_renounced: ownerIsRenounced,
      founder_wallet: getAddress(founder),
      trust_summary: ownerIsRenounced
        ? "Ownership fully renounced — no admin can touch the contract."
        : ownerIsTimelock
          ? "Ownership held by the 48h Timelock. All admin actions are delay-enforced on-chain."
          : "WARNING: owner is an EOA / unknown contract — admin actions are NOT timelocked.",
      timelock: timelockState,
      verification: {
        contract_basescan: `https://basescan.org/address/${GBLIN}#readContract`,
        timelock_basescan: `https://basescan.org/address/${GBLIN_TIMELOCK}#readContract`,
      },
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}
