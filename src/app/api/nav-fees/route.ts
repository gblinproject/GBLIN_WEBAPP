/**
 * GET /api/nav-fees
 *
 * Answers: how much of the fee paid by buyers has stayed in the reserves and
 * lifted the NAV for every holder?
 *
 * The vault splits its 0.10% mint fee in two halves. The protocol half is minted
 * as shares to the fee recipient and leaves the holders' side. The stability
 * half is not paid to anyone: it stays in the vault, so it lifts the NAV of
 * every share. Nothing announces it on its own, so it is computed from what
 * does: each `Minted(receiver, value, shares)` carries the deposit value, and
 * the stability rate is read from the vault.
 *
 * This is a FLOOR, not an estimate. An in-kind deposit pays more than the ETH
 * rate — the in-kind floor plus a deviation tax — and all of that surplus also
 * stays in the vault. Counting every mint at the ETH rate therefore understates
 * the true figure and never overstates it.
 *
 * Logs come from Blockscout, which serves the whole history in a single call.
 * There is deliberately no eth_getLogs fallback: every public Base RPC caps a
 * log query at 10k blocks or less, so covering the contract's life would take
 * hundreds of sequential calls per request — too slow, and too expensive in
 * function CPU. When Blockscout is unavailable the route falls back to the last
 * live figure, and then to a hand-verified baseline, both flagged `stale`. A
 * zero is never synthesised: an incomplete scan is an outage, not "no fees
 * yet". This figure leads the home page, so it has to degrade into an older
 * truth rather than into a wrong number or a blank.
 *
 * Cache: 15 minutes in memory, plus the platform fetch cache, so the upstream
 * sees roughly one request per window regardless of traffic.
 */

import { formatEther } from "viem";
import { blockscoutFetch, blockscoutLegacyUrl, blockscoutSource } from "@/lib/blockscout";
import { client, ETH_USD_FEED, GBLIN, GBLIN_LENS } from "@/lib/x402-helpers";

export const runtime = "nodejs";

/** keccak256("Minted(address,uint256,uint256)") — the vault's mint event. */
const MINTED_TOPIC =
  "0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff";

/** The stability rate lives in the Lens, beside the other fee settings. */
const CONFIG_ABI = [
  {
    name: "configFees",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [
      { name: "protocolFee", type: "uint256" },
      { name: "stabilityFee", type: "uint256" },
      { name: "minDeposit", type: "uint256" },
      { name: "oracleAge", type: "uint256" },
      { name: "oracleAgeTrade", type: "uint256" },
      { name: "sellCooldown", type: "uint256" },
      { name: "basketCap", type: "uint256" },
    ],
  },
] as const;


/** Block that created the vault in service: there is nothing to read before it. */
const DEPLOY_BLOCK = 51_563_253n;

/**
 * Last figure verified by hand against the chain, used when the log source is
 * throttling or down. The sum only ever grows, so a stale baseline understates
 * the truth and can never overstate it — the safe direction for a self-reported
 * number. Refresh it once the live value has moved well past.
 *
 * The vault in service started with no history, so the hand-verified baseline
 * is zero. It is only ever served with `stale: true` and a reason, so a reader
 * can still tell an outage from a real zero.
 */
const BASELINE = { weth: 0, events: 0 };

const FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export interface NavFeesPayload {
  /** Fees that stayed in the reserves, in WETH. */
  weth: number;
  /** The same amount in US dollars, at the current Chainlink ETH/USD price. */
  usd: number;
  /** How many times the contract has distributed a fee into the reserves. */
  events: number;
  ethUsd: number;
  updatedAt: number;
  /** True when the log source was unreachable and the verified baseline is served. */
  stale?: boolean;
  /** Why the read failed (e.g. "log source answered HTTP 429"). Never a URL, never a key. */
  reason?: string;
  /** Which source is serving the logs: `pro` (key configured), `custom`, or `public`. */
  log_source?: string;
}

const CACHE_TTL_MS = 15 * 60 * 1_000;
let cache: { at: number; payload: NavFeesPayload } | null = null;

/**
 * Full history in one request.
 *
 * Throws rather than returning zero when the upstream refuses (rate limit,
 * outage, malformed answer): the caller must be able to tell "nothing was
 * distributed" apart from "we could not read the chain".
 */
async function sumViaBlockscout(): Promise<{ total: bigint; events: number }> {
  // The endpoint (and any key) comes from BLOCKSCOUT_API_URL — see
  // src/lib/blockscout.ts. If the configured source does not answer, the public
  // Blockscout is retried: a misconfigured variable must never leave the service
  // worse off than not setting it at all.
  const { res } = await blockscoutFetch(
    (usePublic) =>
      blockscoutLegacyUrl(
        {
          module: "logs",
          action: "getLogs",
          fromBlock: String(DEPLOY_BLOCK),
          toBlock: "latest",
          address: GBLIN,
          topic0: MINTED_TOPIC,
        },
        usePublic,
      ),
    { signal: AbortSignal.timeout(10_000), next: { revalidate: 900 } },
  );
  if (!res.ok) throw new Error(`log source answered HTTP ${res.status}`);

  const body = (await res.json()) as { status?: string; message?: string; result?: unknown };
  if (!Array.isArray(body.result)) {
    // status "0" carries a reason: "Too many requests", "No records found", …
    throw new Error(body.message ?? "log source returned no usable result");
  }

  // `Minted` carries (value, shares) in its data, value first; the receiver is indexed.
  const logs = body.result as Array<{ data?: string }>;
  const stabilityBps = await client
    .readContract({ address: GBLIN_LENS, abi: CONFIG_ABI, functionName: "configFees", args: [GBLIN] })
    .then((c) => (c as readonly bigint[])[1])
    .catch(() => 5n);

  let total = 0n;
  for (const log of logs) {
    if (typeof log.data !== "string" || log.data.length < 66) continue;
    const value = BigInt("0x" + log.data.slice(2, 66));
    total += (value * stabilityBps) / 10_000n;
  }
  return { total, events: logs.length };
}

async function build(): Promise<NavFeesPayload> {
  const [feed, sum] = await Promise.all([
    client.readContract({
      address: ETH_USD_FEED,
      abi: FEED_ABI,
      functionName: "latestRoundData",
    }),
    sumViaBlockscout(),
  ]);

  const ethUsd = Number(feed[1]) / 1e8;
  if (!Number.isFinite(ethUsd) || ethUsd <= 0) {
    throw new Error("ETH/USD feed returned a non-positive answer");
  }

  const weth = Number(formatEther(sum.total));

  return {
    weth,
    usd: weth * ethUsd,
    events: sum.events,
    ethUsd,
    updatedAt: Date.now(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Response.json({ ...cache.payload, log_source: blockscoutSource() }, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  }

  try {
    const payload = await build();
    cache = { at: Date.now(), payload };
    // `log_source` states which source is serving the logs (pro | custom |
    // public), so an external reader can confirm that a configured key is
    // actually in use. It discloses nothing else.
    return Response.json({ ...payload, log_source: blockscoutSource() }, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    });
  } catch (err) {
    // The log source is throttling or down. Serve the last live figure if this
    // instance has one, otherwise the hand-verified baseline. Both are real
    // measurements; neither is a synthesised zero.
    // `reason` states WHY (HTTP 429, 500, 401…): without it, an upstream outage
    // and a misconfiguration are indistinguishable from the outside. It never
    // contains a URL or a key.
    const reason = (err as Error)?.message ?? "unknown";
    if (cache) {
      return Response.json(
        { ...cache.payload, stale: true, reason, log_source: blockscoutSource() },
        { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
      );
    }

    try {
      const feed = await client.readContract({
        address: ETH_USD_FEED,
        abi: FEED_ABI,
        functionName: "latestRoundData",
      });
      const ethUsd = Number(feed[1]) / 1e8;
      if (Number.isFinite(ethUsd) && ethUsd > 0) {
        return Response.json(
          {
            weth: BASELINE.weth,
            usd: BASELINE.weth * ethUsd,
            events: BASELINE.events,
            ethUsd,
            updatedAt: Date.now(),
            stale: true,
            reason,
            log_source: blockscoutSource(),
          } satisfies NavFeesPayload,
          { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
        );
      }
    } catch {
      // Price feed unreachable too: fall through to the error below.
    }

    return Response.json({ error: "log source unavailable" }, { status: 503 });
  }
}
