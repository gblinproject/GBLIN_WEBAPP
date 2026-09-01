/**
 * Attività on-chain letta da Alchemy — sostituisce Moralis.
 *
 * 01/09/2026: Moralis ha spento il piano gratuito ("Your Moralis Free usage is paused",
 * HTTP 401 su ogni chiamata). Quattro superfici della webapp leggevano da lì.
 *
 * Metodo: `alchemy_getAssetTransfers` per sapere QUALI transazioni toccano un indirizzo,
 * poi un batch JSON-RPC di `eth_getTransactionByHash` per l'`input` (che i transfer non
 * portano) — è l'input che dice se una tx è un buy, un sell o un rebalance.
 *
 * PERCHE' NON eth_getLogs: dal 2026 il piano free di Alchemy lo limita a 10 blocchi per
 * chiamata e i nodi pubblici a 10.000 (~5 ore su Base). Coprire la storia del fee wallet
 * a chunk richiede ~270 chiamate e 125 secondi misurati: non sta in una rotta serverless.
 * `alchemy_getAssetTransfers` non ha quel limite: la stessa storia in una pagina, 871 ms.
 *
 * LIMITE DICHIARATO: è un metodo proprietario Alchemy, non ha un equivalente pubblico. Se
 * Alchemy non risponde non esiste un ripiego — chi consuma queste funzioni deve dichiarare
 * il degrado invece di far passare una lista vuota per "non è successo niente".
 *
 * Il formato restituito imita quello di Moralis (`from_address`, `block_timestamp`, …)
 * perché i componenti che lo consumano sono scritti su quella forma: cambia la fonte,
 * non il parsing a valle.
 */

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';

const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

/**
 * Indirizzi canonici, ripetuti qui e non importati da protocol-data.ts di proposito: quel
 * modulo tira dentro ethers e le traduzioni, che in una rotta server sono peso inutile.
 */
export const GBLIN_CONTRACT = '0x36C81d7E1966310F305eA637e761Cf77F90852f0';
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const FEE_WALLET = '0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B';

/** Transazione nel formato che i componenti si aspettavano da Moralis. */
export interface ChainTx {
  hash: string;
  from_address: string;
  to_address: string;
  input: string;
  value: string;
  block_timestamp: string;
}

/** Trasferimento ERC-20 nel formato che i componenti si aspettavano da Moralis. */
export interface ChainErc20Transfer {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  address: string; // contratto del token
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
    throw new ChainActivityError('ALCHEMY_API_KEY non configurata');
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
    throw new ChainActivityError(`Alchemy ${method}: ${json.error.message ?? 'errore'}`);
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
 * Pagina `alchemy_getAssetTransfers`. Il tetto di pagine è una rete di sicurezza sul tempo
 * della rotta, non una scelta di prodotto: chi chiama deve sapere che oltre quel punto la
 * lista è troncata.
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
 * `eth_getTransactionByHash` in batch JSON-RPC — una richiesta HTTP ogni 100 hash invece
 * di una per hash (misurato: 3 hash in 40 ms).
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

/** Valore grezzo di un trasferimento ERC-20 in unità minime, come stringa decimale. */
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
 * Unisce i trasferimenti (che dicono QUALI tx toccano l'indirizzo) con i dettagli delle tx
 * (che dicono COSA facevano). Ordine: dalla più recente.
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

/** Attività recente del contratto GBLIN: tx che lo toccano + trasferimenti che ne derivano. */
export async function contractActivity(contract: string, limit = 10): Promise<ChainActivity> {
  const [outgoing, incoming] = await Promise.all([
    getAssetTransfers({ fromAddress: contract, maxCount: Math.max(limit * 4, 100), maxPages: 1 }),
    getAssetTransfers({ toAddress: contract, maxCount: Math.max(limit * 4, 100), maxPages: 1 }),
  ]);
  return build([...outgoing, ...incoming], limit);
}

/** Attività di un indirizzo qualunque, limitata al token indicato. */
export async function addressActivity(
  address: string,
  token: string,
  limit = 25,
): Promise<ChainActivity> {
  const [sent, received, sentEth] = await Promise.all([
    getAssetTransfers({ fromAddress: address, contractAddresses: [token], category: ['erc20'], maxPages: 1 }),
    getAssetTransfers({ toAddress: address, contractAddresses: [token], category: ['erc20'], maxPages: 1 }),
    // I buy pagano in ETH: senza questa gamba una compera non comparirebbe finché il
    // trasferimento GBLIN di ritorno non viene indicizzato.
    getAssetTransfers({ fromAddress: address, toAddress: token, category: ['external'], maxPages: 1 }),
  ]);
  return build([...sent, ...received, ...sentEth], limit);
}

/**
 * Storia completa dei pagamenti x402 ricevuti da un wallet, per token.
 * Nessun troncamento: è un contatore pubblico, deve contare tutto.
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
