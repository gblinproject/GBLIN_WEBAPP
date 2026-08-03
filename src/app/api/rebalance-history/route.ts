import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Server-side only: prefer the secret ALCHEMY_API_KEY, fall back to the public
// one so the route still works if only the NEXT_PUBLIC_ var is configured.
const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org';
// Blockscout Base (open-source, free, no block-range limit, decodes events for us).
const BLOCKSCOUT_API = 'https://base.blockscout.com/api/v2';

/**
 * Rebalance history is read from BOTH deployments on purpose.
 *
 * The incentivized-rebalance mechanism ran 35 times on the previous contract
 * between April and June 2026 before the migration. Hiding that history would
 * make a working mechanism look untested, so each event carries the contract it
 * came from and the UI labels it. Everything is verifiable on Basescan.
 */
const CONTRACTS = [
  { label: 'V6', address: '0x36C81d7E1966310F305eA637e761Cf77F90852f0', current: true },
  { label: 'V5', address: '0x38DcDB3A381677239BBc652aed9811F2f8496345', current: false },
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

const REBALANCED_TOPIC = ethers.id('Rebalanced(address,address,address,uint256,uint256)');
const iface = new ethers.Interface([
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
]);

// Next.js route segment config — let Next cache the response so we don't
// hammer Basescan/RPC when multiple users hit the protocol page at once.
// 10 min: rebalances happen roughly daily (incentivizedRebalance is a daily
// keeper poke), so 30s revalidation was pure CPU burn — the log-scan fallback
// pages through eth_getLogs on every regeneration.
export const revalidate = 600;

// Attribution block — additive, consumed by third parties citing our data.
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
  /** Which deployment emitted this event ('V5' | 'V6'). */
  contract?: string;
  contractAddress?: string;
  isCurrentContract?: boolean;
};

// Blockscout returns a richer, pre-decoded payload. We normalise it into RawLog
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
  const blockNumber =
    typeof log.blockNumber === 'string' ? parseInt(log.blockNumber, 16) || Number(log.blockNumber) : log.blockNumber;

  const tsSource = log.timeStamp ?? blockTimestampHint ?? 0;
  const ts = typeof tsSource === 'string' ? parseInt(tsSource, 16) || Number(tsSource) : tsSource;

  return {
    executor: parsed.args.executor as string,
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
        const url = `${BLOCKSCOUT_API}/addresses/${address}/logs?topic=${REBALANCED_TOPIC}`;
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
          next: { revalidate: 30 },
        });
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
 * Fallback fetcher: paginated Alchemy getLogs. Used only if Blockscout fails.
 * Base RPC providers typically cap eth_getLogs at ~10k blocks per call,
 * so we paginate in 9_000-block windows.
 *
 * Current deployment only, by design: this path already costs ~600 RPC calls
 * for a 30-day window, and doubling it for the historical contract would make a
 * degraded fallback slower than the failure it replaces. Events surfaced here
 * are therefore always tagged as the current contract, which is accurate.
 */
async function fetchFromAlchemy(fromBlock: number, toBlock: number): Promise<RawLog[]> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const WINDOW = 9_000;
  const out: RawLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += WINDOW) {
    const end = Math.min(start + WINDOW - 1, toBlock);
    try {
      const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        topics: [REBALANCED_TOPIC],
        fromBlock: start,
        toBlock: end,
      });
      for (const l of logs) {
        out.push({
          topics: l.topics as string[],
          data: l.data,
          transactionHash: l.transactionHash,
          blockNumber: l.blockNumber,
        });
      }
    } catch {
      // Swallow per-window errors so a single bad RPC call doesn't kill the whole history.
      continue;
    }
  }
  return out;
}

export async function GET() {
  try {
    let raw: RawLog[] = [];
    let source: 'blockscout' | 'alchemy' = 'blockscout';

    try {
      raw = await fetchFromBlockscout();
    } catch {
      // Blockscout unavailable — fall back to Alchemy over the last ~30 days.
      source = 'alchemy';
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5_184_000);
      raw = await fetchFromAlchemy(fromBlock, currentBlock);
    }

    // Blockscout returns newest-first already; for Alchemy we sort by block desc.
    const sorted =
      source === 'blockscout'
        ? raw
        : [...raw].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

    // Keep the 5 most recent events.
    const mostRecent = sorted.slice(0, 5);

    // When the source is Alchemy we lack timestamps — fetch blocks only for the
    // subset we return so we don't over-query RPC.
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

    return NextResponse.json({
      events: decoded.filter(Boolean),
      source,
      count: decoded.length,
      _source: SOURCE,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history';
    return NextResponse.json({ error: message, events: [] }, { status: 500 });
  }
}

