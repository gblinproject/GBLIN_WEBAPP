import { NextResponse } from 'next/server';
import { blockscoutFetch, blockscoutLegacyUrl, blockscoutV2Url } from '@/lib/blockscout';
import promise from '../../../../public/promises/P2-honest-counters.json';

/**
 * I nostri wallet, letti dalla promessa P2 e non ricopiati: e' la stessa lista che rende
 * riproducibile lo split fra attivita' nostra ed esterna sui contatori dei pagamenti.
 * Un rebalance eseguito da un nostro bot non e' "un agente che guadagna dal protocollo".
 */
const OUR_WALLETS = new Set((promise.our_wallets ?? []).map((w: string) => w.toLowerCase()));
import { ethers } from 'ethers';

// Server-side only: prefer the secret ALCHEMY_API_KEY, fall back to the public
// one so the route still works if only the NEXT_PUBLIC_ var is configured.
const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
/**
 * Le letture normali (numero di blocco, timestamp) possono passare da Alchemy.
 * Il ripiego a LOG no: dal 2026 il piano gratuito di Alchemy limita `eth_getLogs` a DIECI
 * blocchi, quindi ogni finestra da 9.000 falliva dentro un catch e la rotta pubblicava
 * "0 rebalance" senza aver guardato niente. I nodi pubblici accettano 10.000 blocchi.
 */
const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org';
const RPC_LOGS = ['https://base.drpc.org', 'https://mainnet.base.org'];
// Blockscout Base (open-source, free, no block-range limit, decodes events for us).
// L'indirizzo (ed eventuale chiave, se configurata in BLOCKSCOUT_API_URL) esce da un solo
// posto: src/lib/blockscout.ts.

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

  // La V6 emette anche la taglia pagata; la V5 no (evento a cinque argomenti).
  let bounty: string | null = null;
  try {
    const raw = parsed.args.bounty as bigint | undefined;
    if (raw !== undefined) bounty = raw.toString();
  } catch {
    // firma senza bounty: resta null, e chi legge non deve inventarsi una stima
  }

  const executor = parsed.args.executor as string;

  return {
    executor,
    /** Vero se a ribilanciare e' stato un nostro wallet (lista in P2), non un terzo. */
    executorIsOurs: OUR_WALLETS.has(executor.toLowerCase()),
    /** Taglia realmente pagata, in wei. `null` sulla V5, che non la emetteva. */
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
        // Sorgente configurata, con ricaduta sul Blockscout pubblico se non risponde.
        const { res } = await blockscoutFetch(
          (pubblico) =>
            blockscoutV2Url(
              `addresses/${address}/logs`,
              { topic: TOPIC_FOR[label] ?? REBALANCED_TOPIC_V6 },
              pubblico,
            ),
          { headers: { accept: 'application/json' }, next: { revalidate: 30 } },
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

/**
 * Secondo canale su Blockscout: la vecchia API in stile etherscan.
 *
 * 01/09/2026 — misurato: le due API dello stesso Blockscout cadono in momenti diversi. In una
 * finestra in cui `/api/v2/.../logs` rispondeva 500 su entrambi i contratti, `/api?module=logs`
 * restituiva regolarmente i log. Provarla prima di scendere all'RPC vale la storia COMPLETA
 * invece di una finestra di due giorni: con `fromBlock=0` non ha limiti di intervallo.
 *
 * Restituisce gia' dal piu' recente, come la v2, cosi' il resto della pipeline non cambia.
 */
async function fetchFromBlockscoutLegacy(): Promise<RawLog[]> {
  const perContract = await Promise.all(
    CONTRACTS.map(async ({ label, address, current }) => {
      const { res } = await blockscoutFetch(
        (pubblico) =>
          blockscoutLegacyUrl(
            {
              module: 'logs',
              action: 'getLogs',
              fromBlock: '0',
              toBlock: 'latest',
              address,
              topic0: TOPIC_FOR[label] ?? REBALANCED_TOPIC_V6,
            },
            pubblico,
          ),
        { headers: { accept: 'application/json' }, next: { revalidate: 30 } },
      );
      if (!res.ok) throw new Error(`Blockscout legacy HTTP ${res.status}`);

      const json = (await res.json()) as { result?: unknown; message?: string };
      // "No records found" arriva con status 0: e' una risposta valida che vale zero log.
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
 * Ripiego a log su NODI PUBBLICI (non Alchemy, che sul piano gratuito accetta 10 blocchi per
 * chiamata). Finestre da 10.000 blocchi in parallelo, con un secondo nodo di scorta.
 *
 * Restituisce anche quante finestre hanno fallito: se falliscono tutte, chi chiama NON deve
 * poter scambiare la lista vuota per "nessun rebalance". Era il difetto vecchio.
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
      // I nodi si alternano per finestra, e su errore si prova l'altro.
      for (let tentativo = 0; tentativo < RPC_LOGS.length; tentativo++) {
        const url = RPC_LOGS[(i + tentativo) % RPC_LOGS.length];
        try {
          const provider = new ethers.JsonRpcProvider(url);
          const logs = await provider.getLogs({
            address: CONTRACT_ADDRESS,
            topics: [REBALANCED_TOPIC_V6],   // il ripiego guarda solo il deploy attuale
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
          // si prova il nodo successivo
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
    // `limit` serve alla classifica dei keeper, che ha bisogno di tutti gli eventi e non
    // dei soli cinque mostrati in home. Il tetto tiene la rotta dentro la sua deadline.
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
    let finestreFallite = 0;
    let finestreTotali = 0;

    try {
      raw = await fetchFromBlockscout();
    } catch {
      // La v2 non risponde: prima di rinunciare alla storia completa si prova l'altra API
      // dello stesso Blockscout, che cade in momenti diversi (verificato).
      let legacyRiuscita = false;
      try {
        raw = await fetchFromBlockscoutLegacy();
        legacyRiuscita = true; // `source` resta 'blockscout': stessa fonte, stessa completezza
      } catch {
        // e solo ora i nodi pubblici, che vedono indietro molto meno
      }

      if (!legacyRiuscita) {
        // Ripiego sui nodi pubblici, su una finestra recente.
        source = 'rpc';
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - FALLBACK_BLOCKS);
        const esito = await fetchFromRpc(fromBlock, currentBlock);
        raw = esito.logs;
        finestreFallite = esito.fallite;
        finestreTotali = esito.finestre;
      }
    }

    // Blockscout returns newest-first already; for Alchemy we sort by block desc.
    const sorted =
      source === 'blockscout'
        ? raw
        : [...raw].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

    // Se il ripiego non e' riuscito a leggere NEMMENO una finestra, non abbiamo guardato
    // niente: una lista vuota qui sarebbe una bugia, non una misura.
    const cieco = source === 'rpc' && finestreTotali > 0 && finestreFallite === finestreTotali;

    // I piu' recenti: cinque per la home, tutti quando li chiede la classifica keeper.
    const mostRecent = sorted.slice(0, limit);

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
      ...(source === 'rpc'
        ? {
            partial: true,
            covers: cieco
              ? 'nothing: every log window failed, so this list means "we could not look", not "no rebalances"'
              : `last ~${Math.round((FALLBACK_BLOCKS * 2) / 86400)} days only (Blockscout unavailable; full history needs it)`,
            windows_failed: finestreFallite,
            windows_total: finestreTotali,
            ...(cieco ? { degraded: true } : {}),
          }
        : {}),
      _source: SOURCE,
    };
  }
}

