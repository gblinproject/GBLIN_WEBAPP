import { NextResponse } from 'next/server';
import { blockscoutFetch, blockscoutLegacyUrl, blockscoutSource, blockscoutV2Url } from '@/lib/blockscout';
import promise from '../../../../public/promises/P2-honest-counters.json';

/**
 * Protocol-operated wallets, read from the published honest-counters promise rather than copied
 * here, so the split between protocol activity and third-party activity stays reproducible against
 * a single source. A rebalance executed by a protocol-operated bot is not third-party demand.
 */
const OUR_WALLETS = new Set((promise.our_wallets ?? []).map((w: string) => w.toLowerCase()));
import { ethers } from 'ethers';

// Server-side only: prefer the secret ALCHEMY_API_KEY, fall back to the public
// one so the route still works if only the NEXT_PUBLIC_ var is configured.
const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
/**
 * Plain reads (block number, block timestamp) may go through the managed provider.
 * The log fallback may not: its free tier caps `eth_getLogs` at TEN blocks per call, so wide
 * windows fail inside a catch and the route reports "0 rebalances" without having looked at
 * anything. Public nodes accept 10,000-block windows, so the log scan uses those instead.
 */
const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org';
const RPC_LOGS = ['https://base.drpc.org', 'https://mainnet.base.org'];
// Blockscout Base (open-source, free, no block-range limit, decodes events for us).
// The base URL (and the API key, when BLOCKSCOUT_API_URL carries one) is resolved in a single
// place, so no endpoint is hardcoded here.

/**
 * Rebalance history is read from every deployment on purpose.
 *
 * The mechanism itself changed: the previous contracts paid a bounty out of a buffer to whoever
 * called `incentivizedRebalance`, and the vault in service holds a Dutch auction instead — whoever
 * trades toward the target weights is paid by the premium on the oracle price, and nothing leaves the
 * vault for calling it. Both kinds of event are read and labelled, because hiding the older history
 * would make a working mechanism look untested. Everything is verifiable on Basescan.
 */
const CONTRACTS = [
  { label: 'vault', address: '0xc2181d975c05c8c724b334bcED0764c0b86B1D53', current: true },
  { label: 'previous', address: '0x36C81d7E1966310F305eA637e761Cf77F90852f0', current: false },
  { label: 'older', address: '0x38DcDB3A381677239BBc652aed9811F2f8496345', current: false },
] as const;

const CONTRACT_ADDRESS = CONTRACTS[0].address; // current deployment
const WETH = '0x4200000000000000000000000000000000000006';
const cbBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const TOKEN_NAMES: Record<string, string> = {
  [WETH.toLowerCase()]: 'WETH',
  [cbBTC.toLowerCase()]: 'cbBTC',
  [USDC.toLowerCase()]: 'USDC',
};

// Each deployment emits a different event, so each one needs its own topic0: the previous
// contract appended a `bounty` argument to `Rebalanced`, which changes the signature hash, and
// the vault in service emits `AuctionFill` instead. Filtering on a single topic would silently
// return nothing for the other deployments.
const AUCTION_FILL_TOPIC = ethers.id('AuctionFill(address,address,address,uint256,uint256)');
const REBALANCED_TOPIC_OLDER = ethers.id('Rebalanced(address,address,address,uint256,uint256)');
const REBALANCED_TOPIC_PREVIOUS = ethers.id('Rebalanced(address,address,address,uint256,uint256,uint256)');
const TOPIC_FOR: Record<string, string> = {
  vault: AUCTION_FILL_TOPIC,
  previous: REBALANCED_TOPIC_PREVIOUS,
  older: REBALANCED_TOPIC_OLDER,
};
const iface = new ethers.Interface([
  // The vault in service: a bid filled at the auction price. All three arguments are indexed, and no
  // bounty is paid — the premium is the whole reward.
  'event AuctionFill(address indexed bidder, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)',
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 bounty)',
]);

// Next.js route segment config.
//
// A route that declares `revalidate` and uses no dynamic API is pre-rendered at build time.
// Static generation is capped at 60 seconds, while this handler talks to an indexer and, when the
// indexer is unavailable, paginates through millions of blocks via eth_getLogs, which makes the
// build depend on the latency of a third-party service and fail when that service is slow.
//
// `force-dynamic` removes the pre-render, so the build never touches the chain. Caching is not
// lost, it moves to the CDN through the headers below, and `stale-while-revalidate` serves the
// previous copy while a fresh one is built, so no request waits for the scan.
export const dynamic = 'force-dynamic';

// Past this point the request gives up and answers in a degraded but DECLARED way instead of
// hanging: a hanging request burns billed CPU and can stall anything waiting on it.
const DEADLINE_MS = 20_000;

const CACHE_OK = 'public, s-maxage=600, stale-while-revalidate=3600';
// Short TTL: retry soon instead of freezing an empty answer for ten minutes.
const CACHE_DEGRADATO = 'public, s-maxage=30';

// Attribution block: additive, consumed by third parties citing this data.
const SOURCE = {
  name: 'GBLIN Agent Economy Observatory',
  url: 'https://gblin.digital/observatory',
  data_endpoint: 'https://gblin.digital/api/rebalance-history',
  docs: 'https://gblin.digital/llms.txt',
  license: "CC BY 4.0 — cite 'GBLIN Agent Economy Observatory'",
  disclosure:
    'GBLIN operates 11 paid x402 endpoints; own traffic is excluded from organic counts; methodology is public',
} as const;

type RawLog = {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string | number;
  timeStamp?: string | number;
  logIndex?: number;
  /** Which deployment emitted this event. */
  contract?: string;
  contractAddress?: string;
  isCurrentContract?: boolean;
};

// The indexer returns a richer, pre-decoded payload. It is normalised into RawLog
// so the rest of the pipeline stays identical.
type BlockscoutLogItem = {
  block_number: number;
  block_timestamp: string;
  data: string;
  topics: (string | null)[];
  transaction_hash: string;
  index?: number;
  log_index?: number;
};

function tokenLabel(addr: string): string {
  return TOKEN_NAMES[addr.toLowerCase()] || addr.slice(0, 10);
}

function decodeLog(log: RawLog, blockTimestampHint?: number) {
  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return null;

  const tokenIn = parsed.args.tokenIn as string;
  const tokenOut = parsed.args.tokenOut as string;
  // The auction calls the counterparty a bidder; the previous contracts called it an executor.
  const actor = (parsed.args.bidder ?? parsed.args.executor) as string;
  const blockNumber =
    typeof log.blockNumber === 'string' ? parseInt(log.blockNumber, 16) || Number(log.blockNumber) : log.blockNumber;

  const tsSource = log.timeStamp ?? blockTimestampHint ?? 0;
  const ts = typeof tsSource === 'string' ? parseInt(tsSource, 16) || Number(tsSource) : tsSource;

  // Only the previous contract paid a bounty, and only its six-argument event carries it. On the vault
  // in service nothing is paid out: `null` here means "no bounty exists", and the reader must not
  // invent an estimate.
  let bounty: string | null = null;
  try {
    const raw = parsed.args.bounty as bigint | undefined;
    if (raw !== undefined) bounty = raw.toString();
  } catch {
    // signature without a bounty: stays null
  }

  const executor = actor;

  return {
    executor,
    /** True when the rebalance was executed by a protocol-operated wallet, not a third party. */
    executorIsOurs: OUR_WALLETS.has(executor.toLowerCase()),
    /** Bounty actually paid, in wei. `null` on the oldest deployment, which did not emit it. */
    bounty,
    tokenIn: tokenLabel(tokenIn),
    tokenOut: tokenLabel(tokenOut),
    amountIn: parsed.args.amountIn.toString(),
    amountOut: parsed.args.amountOut.toString(),
    txHash: log.transactionHash,
    blockNumber,
    timestamp: ts || 0,
    date: ts ? new Date(ts * 1000).toISOString() : '',
    // Which deployment this rebalance ran on — surfaced as a badge in the UI.
    contract: log.contract ?? 'V6',
    contractAddress: log.contractAddress ?? CONTRACT_ADDRESS,
    isCurrentContract: log.isCurrentContract ?? true,
  };
}

/**
 * Primary fetcher: Blockscout's logs endpoint (free, no block-range limit,
 * returns pre-decoded event data plus block timestamp in one call).
 * Docs: https://docs.blockscout.com/devs/apis/rest#/Addresses/get_address_logs
 */
async function fetchFromBlockscout(): Promise<RawLog[]> {
  // Query every deployment and merge. A failure on the historical contract must
  // never hide the current one, so each fetch is isolated.
  const perContract = await Promise.all(
    CONTRACTS.map(async ({ label, address, current }) => {
      try {
        // Configured host first, falling back to the public indexer when it does not answer.
        const { res } = await blockscoutFetch(
          (usePublic) =>
            blockscoutV2Url(
              `addresses/${address}/logs`,
              { topic: TOPIC_FOR[label] ?? AUCTION_FILL_TOPIC },
              usePublic,
            ),
          {
            headers: { accept: 'application/json' },
            next: { revalidate: 30 },
            // Explicit per-call timeout: without it a single slow call consumes the deadline of
            // the whole route and the public-node fallback is never reached.
            //
            // Six seconds, not four: successful responses land between 0.6 and 4.4 seconds, so a
            // four-second cutoff discards valid answers and pushes the route onto the fallback
            // with only a fraction of the history. The deadline budget still holds: two APIs in
            // parallel, at most two attempts of 6s each, is 12s, plus ~3s of public nodes,
            // against a 20s ceiling.
            signal: AbortSignal.timeout(6_000),
          },
        );
        if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);

        const json = (await res.json()) as { items?: BlockscoutLogItem[] };
        if (!Array.isArray(json.items)) return [];

        return json.items.map((item) => ({
          topics: item.topics.filter((t): t is string => typeof t === 'string'),
          data: item.data,
          transactionHash: item.transaction_hash,
          blockNumber: item.block_number,
          timeStamp: Math.floor(new Date(item.block_timestamp).getTime() / 1000),
          logIndex: item.index ?? item.log_index,
          contract: label,
          contractAddress: address,
          isCurrentContract: current,
        })) as RawLog[];
      } catch {
        return [] as RawLog[];
      }
    })
  );

  const merged = perContract.flat();
  if (merged.length === 0) throw new Error('Blockscout returned no logs');

  // A single tx can emit more than one Rebalanced event, so dedupe on
  // tx hash + log index rather than tx hash alone.
  const seen = new Set<string>();
  const unique = merged.filter((l) => {
    const key = `${l.transactionHash}#${l.logIndex ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
}

/**
 * Fallback fetcher: paginated `eth_getLogs`, used only when the indexer fails.
 * Base RPC providers typically cap `eth_getLogs` at ~10k blocks per call, so the
 * scan is split into block windows.
 *
 * Current deployment only, by design: a 30-day window already costs hundreds of RPC
 * calls on this path, and repeating it for the historical contracts would make a
 * degraded fallback slower than the failure it replaces. Events surfaced here are
 * therefore always tagged as the current contract, which is accurate.
 */
/**
 * RPC fallback, used when the indexer does not answer. It covers only a RECENT window, and that
 * has to be stated in the response.
 *
 * A 30-day window scanned sequentially in 9,000-block steps is ~576 chained `eth_getLogs` calls
 * and takes more than a minute, which is enough on its own to blow through a 60-second budget.
 * Scanning ~2 days of blocks in parallel is ten calls instead.
 *
 * Only the indexer knows the complete history (no public RPC sustains a multi-month scan), so
 * the fallback declares `partial: true` rather than letting "could not look far enough back" be
 * read as "there were no rebalances".
 */
const FALLBACK_BLOCKS = 86_400; // ~2 days on Base (~2s per block)

/**
 * Second channel on the same indexer: its legacy, etherscan-style API.
 *
 * The two APIs of the same indexer fail at different times: `/api/v2/.../logs` can answer 500 on
 * every contract in a window where `/api?module=logs` still returns the logs. Trying it before
 * dropping to RPC is worth the COMPLETE history instead of a two-day window: with `fromBlock=0`
 * it has no block-range limit.
 *
 * It already returns newest-first, like the v2 API, so the rest of the pipeline is unchanged.
 */
async function fetchFromBlockscoutLegacy(): Promise<RawLog[]> {
  const perContract = await Promise.all(
    CONTRACTS.map(async ({ label, address, current }) => {
      const { res } = await blockscoutFetch(
        (usePublic) =>
          blockscoutLegacyUrl(
            {
              module: 'logs',
              action: 'getLogs',
              fromBlock: '0',
              toBlock: 'latest',
              address,
              topic0: TOPIC_FOR[label] ?? AUCTION_FILL_TOPIC,
            },
            usePublic,
          ),
        {
            headers: { accept: 'application/json' },
            next: { revalidate: 30 },
            // Explicit per-call timeout: without it a single slow call consumes the deadline of
            // the whole route and the public-node fallback is never reached.
            //
            // Six seconds, not four: successful responses land between 0.6 and 4.4 seconds, so a
            // four-second cutoff discards valid answers and pushes the route onto the fallback
            // with only a fraction of the history. The deadline budget still holds: two APIs in
            // parallel, at most two attempts of 6s each, is 12s, plus ~3s of public nodes,
            // against a 20s ceiling.
            signal: AbortSignal.timeout(6_000),
          },
      );
      if (!res.ok) throw new Error(`Blockscout legacy HTTP ${res.status}`);

      const json = (await res.json()) as { result?: unknown; message?: string };
      // "No records found" comes back with status 0: a valid answer that means zero logs.
      if (!Array.isArray(json.result)) {
        if ((json.message ?? '').toLowerCase().includes('no records')) return [];
        throw new Error(`Blockscout legacy: ${json.message ?? 'risposta inattesa'}`);
      }

      return (json.result as Array<Record<string, unknown>>).map((item) => ({
        topics:
          (item.topics as string[] | undefined)?.filter((t): t is string => typeof t === 'string') ??
          [],
        data: String(item.data ?? '0x'),
        transactionHash: String(item.transactionHash ?? ''),
        blockNumber: String(item.blockNumber ?? '0'),
        timeStamp: String(item.timeStamp ?? '0'),
        contract: label,
        contractAddress: address,
        isCurrentContract: current,
      })) as RawLog[];
    }),
  );

  return perContract
    .flat()
    .sort((a, b) => Number(BigInt(String(b.blockNumber))) - Number(BigInt(String(a.blockNumber))));
}

/**
 * Log fallback against PUBLIC NODES (not the managed provider, whose free tier accepts only 10
 * blocks per call). Windows of 10,000 blocks in parallel, with a second node as backup.
 *
 * It also returns how many windows failed: when every window fails, the caller must not be able
 * to mistake an empty list for "no rebalances".
 */
async function fetchFromRpc(
  fromBlock: number,
  toBlock: number,
): Promise<{ logs: RawLog[]; finestre: number; fallite: number }> {
  const WINDOW = 10_000;
  const finestre: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += WINDOW) {
    finestre.push([start, Math.min(start + WINDOW - 1, toBlock)]);
  }

  let fallite = 0;
  const risultati = await Promise.all(
    finestre.map(async ([start, end], i) => {
      // Nodes rotate per window, and on error the next one is tried.
      for (let tentativo = 0; tentativo < RPC_LOGS.length; tentativo++) {
        const url = RPC_LOGS[(i + tentativo) % RPC_LOGS.length];
        try {
          const provider = new ethers.JsonRpcProvider(url);
          const logs = await provider.getLogs({
            address: CONTRACT_ADDRESS,
            topics: [AUCTION_FILL_TOPIC],   // the fallback only looks at the current deployment
            fromBlock: start,
            toBlock: end,
          });
          return logs.map((l) => ({
            topics: l.topics as string[],
            data: l.data,
            transactionHash: l.transactionHash,
            blockNumber: l.blockNumber,
          })) as RawLog[];
        } catch {
          // try the next node
        }
      }
      fallite += 1;
      return [] as RawLog[];
    }),
  );

  return { logs: risultati.flat(), finestre: finestre.length, fallite };
}

export async function GET(request: Request) {
  const scaduto = Symbol('scaduto');
  const deadline = new Promise<typeof scaduto>((r) =>
    setTimeout(() => r(scaduto), DEADLINE_MS),
  );
  try {
    // `limit` exists for the keeper leaderboard, which needs every event and not only the five
    // shown on the landing page. The upper bound keeps the route inside its deadline.
    const richiesti = Number(new URL(request.url).searchParams.get('limit') ?? '5');
    const limit = Number.isFinite(richiesti)
      ? Math.min(Math.max(Math.trunc(richiesti), 1), 200)
      : 5;
    const esito = await Promise.race([raccogli(limit), deadline]);
    if (esito === scaduto) {
      return NextResponse.json(
        {
          events: [],
          source: null,
          count: 0,
          degraded: true,
          reason: `upstream did not answer within ${DEADLINE_MS / 1000}s (Blockscout, then the RPC log scan); this is a timeout on our side, not a statement that there are no rebalances`,
          _source: SOURCE,
        },
        { status: 200, headers: { 'cache-control': CACHE_DEGRADATO } },
      );
    }
    return NextResponse.json(esito, { headers: { 'cache-control': CACHE_OK } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history';
    return NextResponse.json(
      { error: message, events: [] },
      { status: 500, headers: { 'cache-control': CACHE_DEGRADATO } },
    );
  }
}

async function raccogli(limit: number) {
  {
    let raw: RawLog[] = [];
    let source: 'blockscout' | 'rpc' = 'blockscout';
    let windowsFailed = 0;
    let windowsTotal = 0;

    // The two indexer APIs are queried TOGETHER, not one after the other: they fail at different
    // times, and in sequence the worst case (two APIs x two hosts, each with its own fallback)
    // overruns the 20s deadline, and the route answers `degraded` without ever reaching the public
    // nodes. In parallel the worst case is halved.
    // `allSettled` rather than `any`: the v2 API can SUCCEED while returning an empty list, and
    // between two valid answers the one that saw more events wins, not the one that arrived first.
    const v2 = fetchFromBlockscout();
    const legacy = fetchFromBlockscoutLegacy();

    // Work resumes as soon as ONE of the two brings logs: waiting for both pushes the route to
    // ~20 seconds, on the edge of the deadline, even when the good answer was already in hand
    // after two. An EMPTY answer does not win the race (the v2 API can succeed with zero items):
    // in that case the other one is awaited as well.
    const conLog = (p: Promise<RawLog[]>) =>
      p.then((r) => {
        if (r.length === 0) throw new Error('nessun log');
        return r;
      });

    let riuscite: RawLog[][] = [];
    try {
      raw = await Promise.any([conLog(v2), conLog(legacy)]);
      riuscite = [raw];
    } catch {
      // Neither brought logs: this can mean "genuinely zero" or "both failed". Only inspecting
      // how each one settled tells the two apart.
      const esiti = await Promise.allSettled([v2, legacy]);
      riuscite = esiti
        .filter((e): e is PromiseFulfilledResult<RawLog[]> => e.status === 'fulfilled')
        .map((e) => e.value);
      if (riuscite.length > 0) raw = riuscite[0];
    }

    if (riuscite.length === 0) {
      // Fall back to the public nodes, over a recent window.
      source = 'rpc';
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - FALLBACK_BLOCKS);
      const esito = await fetchFromRpc(fromBlock, currentBlock);
      raw = esito.logs;
      windowsFailed = esito.fallite;
      windowsTotal = esito.finestre;
    }

    // The indexer already returns newest-first; RPC results are sorted by descending block.
    const sorted =
      source === 'blockscout'
        ? raw
        : [...raw].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

    // If the fallback could not read a SINGLE window, nothing was observed at all: an empty list
    // here would be a claim, not a measurement.
    const blind = source === 'rpc' && windowsTotal > 0 && windowsFailed === windowsTotal;

    // The most recent events: five for the landing page, all of them when the keeper
    // leaderboard asks for them.
    const mostRecent = sorted.slice(0, limit);

    // RPC logs carry no timestamp, so blocks are fetched only for the subset that is
    // returned, to avoid over-querying the nodes.
    let decoded: ReturnType<typeof decodeLog>[] = [];
    if (source === 'blockscout') {
      decoded = mostRecent.map((l) => decodeLog(l));
    } else {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      decoded = await Promise.all(
        mostRecent.map(async (l) => {
          const bn =
            typeof l.blockNumber === 'string'
              ? parseInt(l.blockNumber, 16) || Number(l.blockNumber)
              : l.blockNumber;
          const block = await provider.getBlock(bn).catch(() => null);
          return decodeLog(l, block?.timestamp ?? 0);
        })
      );
    }

    return {
      events: decoded.filter(Boolean),
      source,
      /** Which source served the logs: `pro` (API key configured), `custom`, or `public`. */
      log_source: blockscoutSource(),
      count: decoded.length,
      // With the indexer down only ~2 days back are visible: an empty list here means
      // "nothing recent", NOT "there have never been any rebalances".
      ...(source === 'rpc'
        ? {
            partial: true,
            covers: blind
              ? 'nothing: every log window failed, so this list means "we could not look", not "no rebalances"'
              : `last ~${Math.round((FALLBACK_BLOCKS * 2) / 86400)} days only (Blockscout unavailable; full history needs it)`,
            windows_failed: windowsFailed,
            windows_total: windowsTotal,
            ...(blind ? { degraded: true } : {}),
          }
        : {}),
      _source: SOURCE,
    };
  }
}

