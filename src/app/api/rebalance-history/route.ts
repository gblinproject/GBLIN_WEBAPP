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

// I DUE DEPLOY EMETTONO EVENTI DIVERSI: V6 ha aggiunto `bounty` in coda, quindi la firma —
// e con essa il topic0 — non coincide con quella di V5. Cercando solo la vecchia, questa
// rotta non avrebbe MAI mostrato un rebalance di V6 (oggi non si nota perché su V6 sono
// ancora zero, ma al primo vero la pagina sarebbe rimasta muta). Fix 13/08/2026.
const REBALANCED_TOPIC_V5 = ethers.id('Rebalanced(address,address,address,uint256,uint256)');
const REBALANCED_TOPIC_V6 = ethers.id('Rebalanced(address,address,address,uint256,uint256,uint256)');
const TOPIC_FOR: Record<string, string> = { V5: REBALANCED_TOPIC_V5, V6: REBALANCED_TOPIC_V6 };
const iface = new ethers.Interface([
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
  'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 bounty)',
]);

// Next.js route segment config.
//
// 30/08/2026 — QUESTA ROTTA HA FATTO FALLIRE UN DEPLOY. Con `revalidate` e nessuna API
// dinamica, Next la PRE-RENDERIZZA durante il build: la generazione statica su Vercel ha un
// tetto di 60 secondi, e qui dentro si parla con Blockscout e, se Blockscout non risponde, si
// pagina attraverso 5,18 milioni di blocchi via eth_getLogs. Il build dipendeva quindi dalla
// velocita' di un servizio terzo, e un giorno quel servizio e' stato lento.
//
// `force-dynamic` toglie la pre-renderizzazione: il build non parla piu' con la catena. La
// cache non si perde, si sposta sulla CDN con gli header qui sotto (stesso effetto sulla CPU
// che cercavamo il 03/08 alzando revalidate a 600s), e `stale-while-revalidate` fa servire la
// copia vecchia mentre quella nuova si ricostruisce, quindi nessuno aspetta la scansione.
export const dynamic = 'force-dynamic';

// Oltre questo, la richiesta si arrende e risponde in modo degradato ma DICHIARATO, invece di
// restare appesa: appeso costa CPU fatturata e, al build, faceva fallire tutto.
const DEADLINE_MS = 20_000;

const CACHE_OK = 'public, s-maxage=600, stale-while-revalidate=3600';
const CACHE_DEGRADATO = 'public, s-maxage=30'; // riprova presto, non cristallizzare un vuoto

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
        const url = `${BLOCKSCOUT_API}/addresses/${address}/logs?topic=${TOPIC_FOR[label] ?? REBALANCED_TOPIC_V6}`;
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
/**
 * Ripiego RPC quando Blockscout non risponde. Copre solo una finestra RECENTE, e va detto.
 *
 * 30/08/2026 — com'era prima: 5.184.000 blocchi (30 giorni) a finestre di 9.000, IN SEQUENZA.
 * Sono 576 chiamate eth_getLogs una dopo l'altra, e cercavano solo su CONTRACT_ADDRESS, cioe' il
 * deploy attuale, che di rebalance ne ha ZERO. Quindi il ripiego impiegava piu' di un minuto per
 * garantirsi di non trovare niente, e con Blockscout giu' era l'unica cosa che girava: e' lui che
 * faceva sforare il tetto di 60 secondi della generazione statica e faceva fallire il build.
 *
 * Ora: ~2 giorni di blocchi, in PARALLELO. Dieci chiamate invece di 576. La storia completa la sa
 * solo Blockscout (nessun RPC pubblico regge una scansione di mesi), quindi quando ripieghiamo lo
 * dichiariamo con `partial: true` invece di far sembrare "zero rebalance" cio' che e' "non ho
 * potuto guardare abbastanza indietro".
 */
const FALLBACK_BLOCKS = 86_400; // ~2 giorni su Base (~2s a blocco)

async function fetchFromAlchemy(fromBlock: number, toBlock: number): Promise<RawLog[]> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const WINDOW = 9_000;
  const finestre: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += WINDOW) {
    finestre.push([start, Math.min(start + WINDOW - 1, toBlock)]);
  }
  const risultati = await Promise.all(
    finestre.map(async ([start, end]) => {
      try {
        const logs = await provider.getLogs({
          address: CONTRACT_ADDRESS,
          topics: [REBALANCED_TOPIC_V6],   // il fallback RPC scansiona CONTRACT_ADDRESS = V6
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
        // Una finestra andata male non deve uccidere le altre.
        return [] as RawLog[];
      }
    }),
  );
  return risultati.flat();
}

export async function GET() {
  const scaduto = Symbol('scaduto');
  const deadline = new Promise<typeof scaduto>((r) =>
    setTimeout(() => r(scaduto), DEADLINE_MS),
  );
  try {
    const esito = await Promise.race([raccogli(), deadline]);
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

async function raccogli() {
  {
    let raw: RawLog[] = [];
    let source: 'blockscout' | 'alchemy' = 'blockscout';

    try {
      raw = await fetchFromBlockscout();
    } catch {
      // Blockscout unavailable — fall back to Alchemy over the last ~30 days.
      source = 'alchemy';
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - FALLBACK_BLOCKS);
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

    return {
      events: decoded.filter(Boolean),
      source,
      count: decoded.length,
      // Con Blockscout giu' vediamo solo ~2 giorni indietro: un elenco vuoto qui significa
      // "niente di recente", NON "non ci sono mai stati rebalance".
      ...(source === 'alchemy'
        ? {
            partial: true,
            covers: `last ~${Math.round((FALLBACK_BLOCKS * 2) / 86400)} days only (Blockscout unavailable; full history needs it)`,
          }
        : {}),
      _source: SOURCE,
    };
  }
}

