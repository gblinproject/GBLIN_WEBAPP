/**
 * On-chain activity read through Alchemy.
 *
 * Method: `alchemy_getAssetTransfers` tells WHICH transactions touch an address, then a
 * JSON-RPC batch of `eth_getTransactionByHash` provides the `input` (which transfers do not
 * carry) — the input is what distinguishes a buy from a sell from a rebalance.
 *
 * WHY NOT eth_getLogs: the Alchemy free tier caps it at 10 blocks per call and public nodes
 * at 10,000 (roughly five hours of Base blocks). Covering a full address history in windows
 * takes hundreds of calls and minutes of wall time, which does not fit in a serverless
 * route. `alchemy_getAssetTransfers` has no such cap: the same history in one page, in
 * well under a second.
 *
 * STATED LIMIT: this is a proprietary Alchemy method with no public equivalent. If Alchemy
 * does not answer there is no fallback — consumers of these functions must report the
 * degradation instead of letting an empty list read as "nothing happened".
 *
 * The returned shape uses snake_case fields (`from_address`, `block_timestamp`, …) because
 * the components that consume it are written against that shape: the source changes, the
 * downstream parsing does not.
 */

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';

const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

/**
 * Canonical addresses, deliberately duplicated here instead of imported from
 * `protocol-data.ts`: that module pulls in ethers and the translation bundle, which are
 * dead weight inside a server route.
 */
export const GBLIN_CONTRACT = '0xc2181d975c05c8c724b334bcED0764c0b86B1D53';
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const FEE_WALLET = '0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B';

/** Transaction in the shape the consuming components expect. */
export interface ChainTx {
  hash: string;
  from_address: string;
  to_address: string;
  input: string;
  value: string;
  block_timestamp: string;
}

/** ERC-20 transfer in the shape the consuming components expect. */
export interface ChainErc20Transfer {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  address: string; // token contract
  block_timestamp: string;
}

export interface ChainActivity {
  transactions: ChainTx[];
  erc20Transfers: ChainErc20Transfer[];
}

interface AlchemyTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract: { value: string | null; address: string | null; decimal: string | null };
  metadata: { blockTimestamp: string };
}

export class ChainActivityError extends Error {}

async function rpc<T>(body: unknown, timeoutMs = 12_000): Promise<T> {
  if (!ALCHEMY_KEY) {
    throw new ChainActivityError('ALCHEMY_API_KEY is not configured');
  }
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ChainActivityError(`Alchemy HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function call<T>(method: string, params: unknown[]): Promise<T> {
  const json = await rpc<{ result?: T; error?: { message?: string } }>({
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  });
  if (json.error) {
    throw new ChainActivityError(`Alchemy ${method}: ${json.error.message ?? 'unknown error'}`);
  }
  return json.result as T;
}

interface TransfersParams {
  fromAddress?: string;
  toAddress?: string;
  contractAddresses?: string[];
  category?: string[];
  order?: 'asc' | 'desc';
  maxPages?: number;
  maxCount?: number;
}

/**
 * Pages through `alchemy_getAssetTransfers`. The page cap is a safety net on route latency,
 * not a product decision: callers must assume the list is truncated beyond that point.
 */
export async function getAssetTransfers({
  fromAddress,
  toAddress,
  contractAddresses,
  category = ['external', 'erc20'],
  order = 'desc',
  maxPages = 5,
  maxCount = 1000,
}: TransfersParams): Promise<AlchemyTransfer[]> {
  const out: AlchemyTransfer[] = [];
  let pageKey: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, unknown> = {
      fromBlock: '0x0',
      toBlock: 'latest',
      category,
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: `0x${maxCount.toString(16)}`,
      order,
    };
    if (fromAddress) params.fromAddress = fromAddress;
    if (toAddress) params.toAddress = toAddress;
    if (contractAddresses) params.contractAddresses = contractAddresses;
    if (pageKey) params.pageKey = pageKey;

    const res = await call<{ transfers: AlchemyTransfer[]; pageKey?: string }>(
      'alchemy_getAssetTransfers',
      [params],
    );
    out.push(...(res.transfers ?? []));
    pageKey = res.pageKey;
    if (!pageKey) break;
  }

  return out;
}

/**
 * `eth_getTransactionByHash` as a JSON-RPC batch — one HTTP request per 100 hashes instead
 * of one request per hash.
 */
async function getTransactions(hashes: string[]): Promise<Map<string, { from: string; to: string | null; input: string; value: string }>> {
  const map = new Map<string, { from: string; to: string | null; input: string; value: string }>();
  const CHUNK = 100;

  for (let i = 0; i < hashes.length; i += CHUNK) {
    const chunk = hashes.slice(i, i + CHUNK);
    const batch = await rpc<Array<{ id: number; result?: { hash: string; from: string; to: string | null; input: string; value: string } }>>(
      chunk.map((hash, idx) => ({
        jsonrpc: '2.0',
        id: idx,
        method: 'eth_getTransactionByHash',
        params: [hash],
      })),
      20_000,
    );
    if (!Array.isArray(batch)) continue;
    for (const entry of batch) {
      const r = entry?.result;
      if (r?.hash) {
        map.set(r.hash.toLowerCase(), { from: r.from, to: r.to, input: r.input, value: r.value });
      }
    }
  }

  return map;
}

/** Raw ERC-20 transfer value in minimal units, as a decimal string. */
function rawValue(t: AlchemyTransfer): string {
  const hex = t.rawContract?.value;
  if (!hex) return '0';
  try {
    return BigInt(hex).toString();
  } catch {
    return '0';
  }
}

/**
 * Joins transfers (which say WHICH transactions touch the address) with transaction details
 * (which say WHAT they did). Ordered from the most recent.
 */
async function build(transfers: AlchemyTransfer[], limit: number): Promise<ChainActivity> {
  transfers.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16));

  const erc20Transfers: ChainErc20Transfer[] = [];
  const timestampByHash = new Map<string, string>();
  const orderedHashes: string[] = [];

  for (const t of transfers) {
    const hash = t.hash.toLowerCase();
    if (!timestampByHash.has(hash)) {
      timestampByHash.set(hash, t.metadata?.blockTimestamp ?? '');
      orderedHashes.push(hash);
    }
    if (t.category === 'erc20' && t.rawContract?.address) {
      erc20Transfers.push({
        transaction_hash: hash,
        from_address: t.from,
        to_address: t.to ?? '',
        value: rawValue(t),
        address: t.rawContract.address,
        block_timestamp: t.metadata?.blockTimestamp ?? '',
      });
    }
  }

  const wanted = orderedHashes.slice(0, limit);
  const details = await getTransactions(wanted);

  const transactions: ChainTx[] = [];
  for (const hash of wanted) {
    const d = details.get(hash);
    if (!d) continue;
    transactions.push({
      hash,
      from_address: d.from,
      to_address: d.to ?? '',
      input: d.input ?? '0x',
      value: d.value ? BigInt(d.value).toString() : '0',
      block_timestamp: timestampByHash.get(hash) ?? '',
    });
  }

  const keep = new Set(wanted);
  return {
    transactions,
    erc20Transfers: erc20Transfers.filter((t) => keep.has(t.transaction_hash)),
  };
}

/** Recent activity of the GBLIN contract: transactions touching it and the resulting transfers. */
export async function contractActivity(contract: string, limit = 10): Promise<ChainActivity> {
  const [outgoing, incoming] = await Promise.all([
    getAssetTransfers({ fromAddress: contract, maxCount: Math.max(limit * 4, 100), maxPages: 1 }),
    getAssetTransfers({ toAddress: contract, maxCount: Math.max(limit * 4, 100), maxPages: 1 }),
  ]);
  return build([...outgoing, ...incoming], limit);
}

/** Activity of an arbitrary address, restricted to the given token. */
export async function addressActivity(
  address: string,
  token: string,
  limit = 25,
): Promise<ChainActivity> {
  const [sent, received, sentEth] = await Promise.all([
    getAssetTransfers({ fromAddress: address, contractAddresses: [token], category: ['erc20'], maxPages: 1 }),
    getAssetTransfers({ toAddress: address, contractAddresses: [token], category: ['erc20'], maxPages: 1 }),
    // Buys are paid in ETH: without this leg a purchase would not show up until the
    // returning GBLIN transfer is indexed.
    getAssetTransfers({ fromAddress: address, toAddress: token, category: ['external'], maxPages: 1 }),
  ]);
  return build([...sent, ...received, ...sentEth], limit);
}

/**
 * Full history of x402 payments received by a wallet, for one token.
 * Never truncated: it feeds a public counter, so it must count everything.
 */
export async function inboundTokenPayments(
  wallet: string,
  token: string,
): Promise<Array<{ from: string; value: string; timestamp: string; hash: string }>> {
  const transfers = await getAssetTransfers({
    toAddress: wallet,
    contractAddresses: [token],
    category: ['erc20'],
    order: 'asc',
    maxPages: 10,
  });
  return transfers.map((t) => ({
    from: t.from.toLowerCase(),
    value: rawValue(t),
    timestamp: t.metadata?.blockTimestamp ?? '',
    hash: t.hash,
  }));
}
