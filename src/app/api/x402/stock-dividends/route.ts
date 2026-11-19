/**
 * GET /api/x402/stock-dividends?address=0x… — PAID ($0.01 via x402, gated by src/middleware.ts).
 *
 * Distribution statement for Coinbase tokenized stocks on Base. A tokenized stock reinvests a cash
 * distribution by raising the token's share-to-token multiplier: the holder's token balance does not
 * change and no Transfer is emitted, so wallets, explorers and transfer-based tax tools record nothing.
 * This route lists, for one address, every applied multiplier update since the index start and the
 * underlying shares it credited to that address.
 *
 * Inputs: the public index of MultiplierUpdated / Announcement events kept by the GBLIN worker
 * (/stocks/corporate-actions, free), plus archive reads at the block before each update: the holder's
 * token balance and the token's multiplier. The multiplier read on-chain must equal the one the index
 * derives from the previous event; a mismatch is reported per action instead of being hidden.
 *
 * credited_shares = balance_before × (multiplier_after − multiplier_before) / 1e18, in underlying shares.
 * No price and no fiat value: the response carries amounts and proofs only.
 *
 * Invalid input answers 400 and a failed upstream 502: x402 settles only responses below 400, so
 * neither is charged.
 */
import {
  createPublicClient,
  fallback,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
} from "viem";
import { base } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKER = "https://gblin-mcp.gblin-mcp-worker.workers.dev";
const WAD = 10n ** 18n;
/** A multiplier change above this share of the previous value is flagged for review, not interpreted. */
const REVIEW_THRESHOLD_BPS = 500n;
const CONCURRENCY = 4;

const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function multiplier() view returns (uint256)",
]);

// Archive reads at past blocks. A configured private endpoint goes first; the public endpoints after it
// were checked to answer historical multicalls (the default public endpoint used elsewhere does not).
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
const ARCHIVE_URLS = [
  process.env.GBLIN_RPC_URL || "",
  ALCHEMY_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "",
  "https://base.drpc.org",
  "https://mainnet.base.org",
  "https://base-pokt.nodies.app",
].filter((u) => u !== "");

const archive = createPublicClient({
  chain: base,
  transport: fallback(ARCHIVE_URLS.map((u) => http(u, { timeout: 8_000, retryCount: 1 }))),
});

type IndexedAction = {
  token: string;
  symbol: string | null;
  decimals: number | null;
  block: number;
  log_index: number;
  tx: string;
  timestamp: number;
  multiplier_before: string;
  multiplier_after: string;
  announcement: { id: string; kind: string; record: string } | null;
};

type IndexFeed = {
  coverage: Record<string, unknown>;
  actions: IndexedAction[];
};

function bad(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const rawAddress = (params.get("address") ?? "").trim();
  if (!isAddress(rawAddress, { strict: false })) return bad("address must be a 20-byte hex address");
  const holder = getAddress(rawAddress);
  const tokenFilter = (params.get("token") ?? "").trim().toLowerCase();
  if (tokenFilter.length > 64) return bad("token must be a token address or symbol");

  let feed: IndexFeed;
  try {
    const r = await fetch(`${WORKER}/stocks/corporate-actions?limit=1000`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`index HTTP ${r.status}`);
    feed = (await r.json()) as IndexFeed;
    if (!Array.isArray(feed.actions)) throw new Error("malformed index answer");
  } catch (err) {
    return Response.json(
      { error: "corporate-action index unavailable", detail: (err as Error).message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const actions = feed.actions.filter(
    (a) => tokenFilter === "" || a.token === tokenFilter || (a.symbol ?? "").toLowerCase() === tokenFilter,
  );

  let rows: Array<{ action: IndexedAction; balance: bigint; onchainBefore: bigint }>;
  try {
    rows = await mapLimited(actions, CONCURRENCY, async (action) => {
      const token = getAddress(action.token) as Address;
      const [balance, onchainBefore] = await archive.multicall({
        allowFailure: false,
        blockNumber: BigInt(action.block - 1),
        contracts: [
          { address: token, abi: ABI, functionName: "balanceOf", args: [holder] },
          { address: token, abi: ABI, functionName: "multiplier" },
        ],
      });
      return { action, balance, onchainBefore };
    });
  } catch (err) {
    return Response.json(
      { error: "archive read failed", detail: (err as Error).message.split("\n")[0].slice(0, 200) },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const totals = new Map<string, { token: string; symbol: string | null; decimals: number; shares: bigint }>();
  const credits = [];
  for (const { action, balance, onchainBefore } of rows) {
    if (balance === 0n) continue;
    const decimals = action.decimals ?? 8;
    const before = BigInt(action.multiplier_before);
    const after = BigInt(action.multiplier_after);
    const credited = balance * (after - before); // token base units × 1e18
    const flags: string[] = [];
    if (onchainBefore !== before) flags.push("multiplier_before_mismatch");
    if (before > 0n && ((after - before) * 10_000n) / before > REVIEW_THRESHOLD_BPS) {
      flags.push("multiplier_change_above_5pct");
    }
    credits.push({
      token: action.token,
      symbol: action.symbol,
      corporate_action: action.announcement?.kind ?? null,
      record: action.announcement?.record ?? null,
      block: action.block,
      timestamp: action.timestamp,
      tx: action.tx,
      token_balance: formatUnits(balance, decimals),
      multiplier_before: formatUnits(before, 18),
      multiplier_after: formatUnits(after, 18),
      onchain_multiplier_before: formatUnits(onchainBefore, 18),
      credited_shares: formatUnits(credited, decimals + 18),
      shares_after: formatUnits(balance * after, decimals + 18),
      flags,
    });
    const t = totals.get(action.token) ?? { token: action.token, symbol: action.symbol, decimals, shares: 0n };
    t.shares += credited;
    totals.set(action.token, t);
  }

  return Response.json(
    {
      address: holder,
      scope: "Coinbase tokenized stocks on Base (address prefix 0xb200000000000000000000)",
      as_of: feed.coverage,
      actions_checked: actions.length,
      credits,
      totals: [...totals.values()].map((t) => ({
        token: t.token,
        symbol: t.symbol,
        credited_shares: formatUnits(t.shares, t.decimals + 18),
      })),
      method: {
        credited_shares:
          "token balance at the end of the block before the MultiplierUpdated event x (multiplier_after - multiplier_before) / 1e18, in underlying shares",
        sources:
          "MultiplierUpdated and Announcement events indexed by the GBLIN worker (free: " +
          `${WORKER}/stocks/corporate-actions); balance and multiplier read on Base at the block before each update`,
        flags: {
          multiplier_before_mismatch:
            "the multiplier read on-chain before the update differs from the one derived from the index",
          multiplier_change_above_5pct:
            "the update raised the multiplier by more than 5%; check the linked corporate-action record",
        },
        limits: [
          "Amounts are underlying shares, not fiat: no price is applied.",
          "The balance is the one at the end of the previous block; a transfer inside the update block itself is not reflected.",
          "Multipliers include distributions after taxes, fees and expenses as applied by the issuer.",
          "Coverage starts at the index start block; see as_of for the indexed range.",
          "Not tax or investment advice.",
        ],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
