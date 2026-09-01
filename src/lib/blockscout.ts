/**
 * Un solo posto da cui esce l'indirizzo di Blockscout.
 *
 * 01/09/2026: Blockscout senza chiave è intermittente (misurati 200, 500, 500, 200, 429 su
 * cinque tentativi) e blocca l'IP per minuti dopo poche richieste ravvicinate. Con una chiave
 * gratuita di dev.blockscout.com il tetto si alza, ma le due rotte che lo interrogano usano
 * due API diverse — `/api` in stile etherscan per nav-fees, `/api/v2` REST per
 * rebalance-history — quindi non basta incollare un URL in una costante.
 *
 * `BLOCKSCOUT_API_URL` è tollerante di proposito: accetta l'origin nudo, con `/api`, con
 * `/api/v2`, e con la chiave già attaccata come query. Qualunque forma sia stata configurata,
 * qui viene normalizzata e la query (dove vive `apikey`) viene sempre conservata.
 *
 * Il valore può contenere un segreto: non finisce mai in una risposta pubblica né in un log.
 */

const DEFAULT_ORIGIN = 'https://base.blockscout.com';

/**
 * Host della PRO API e prefisso della catena. La chiave gratuita di dev.blockscout.com NON
 * vale su `base.blockscout.com`: la PRO API vive su un host diverso e vuole il chain id nel
 * percorso (Base = 8453). Verificato: senza chiave risponde
 * `402 "Proceed with API key or make a X402 payment to continue"`.
 */
const PRO_ORIGIN = 'https://api.blockscout.com';
const PRO_PREFIX = '/8453';

interface Sorgente {
  origin: string;
  /** Prefisso di percorso da conservare prima di `/api` (per la PRO API è `/8453`). */
  prefix: string;
  /** Parametri già presenti nella configurazione, tipicamente `apikey`. */
  query: URLSearchParams;
}

const PUBBLICA: Sorgente = { origin: DEFAULT_ORIGIN, prefix: '', query: new URLSearchParams() };

function leggiSorgente(): Sorgente {
  const raw = (process.env.BLOCKSCOUT_API_URL ?? '').trim();
  const key = (process.env.BLOCKSCOUT_API_KEY ?? '').trim();

  // Solo la chiave, senza URL: si sa già dove va usata, non serve farlo scrivere a mano.
  if (!raw) {
    if (!key) return PUBBLICA;
    const query = new URLSearchParams();
    query.set('apikey', key);
    return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
  }

  // Il valore è la CHIAVE, non un URL. Capita, ed è un errore silenzioso da incubo: senza
  // questo controllo `new URL('https://proapi_xxx')` è formalmente valido, quindi ogni
  // richiesta partirebbe verso un host inesistente invece di segnalare l'errore.
  if (/^proapi_/i.test(raw) || !/[./]/.test(raw)) {
    const query = new URLSearchParams();
    query.set('apikey', raw);
    return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
  }

  try {
    // Senza schema `new URL` fallisce: lo mettiamo noi invece di rifiutare il valore.
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const query = new URLSearchParams(url.search);
    if (key && !query.has('apikey')) query.set('apikey', key);

    // Il percorso configurato va CONSERVATO fino a `/api`: buttarlo via cancellerebbe il
    // `/8453` della PRO API e manderebbe ogni richiesta su una rotta che non esiste.
    let prefix = url.pathname.replace(/\/api(\/v2)?(\/.*)?\/?$/i, '').replace(/\/+$/, '');
    if (prefix === '/') prefix = '';

    // Host PRO senza chain id: lo mettiamo noi, altrimenti la richiesta non è indirizzata.
    if (url.origin === PRO_ORIGIN && prefix === '') prefix = PRO_PREFIX;

    // Chiave PRO puntata sull'host per-instance: lì non vale nulla e verrebbe ignorata in
    // silenzio. È l'errore di configurazione più facile da fare, quindi lo correggiamo
    // invece di lasciare che si manifesti come un rate limit inspiegabile.
    if (url.origin === DEFAULT_ORIGIN && query.has('apikey')) {
      return { origin: PRO_ORIGIN, prefix: PRO_PREFIX, query };
    }

    return { origin: url.origin, prefix, query };
  } catch {
    // Un valore malformato non deve spegnere le letture on-chain: si torna al pubblico.
    return PUBBLICA;
  }
}

/**
 * URL per l'API in stile etherscan (`/api?module=…&action=…`).
 * I parametri passati qui vincono su quelli configurati, tranne `apikey`.
 */
export function blockscoutLegacyUrl(params: Record<string, string>, pubblico = false): string {
  const { origin, prefix, query } = pubblico ? PUBBLICA : leggiSorgente();
  const url = new URL(`${prefix}/api`, origin);
  for (const [k, v] of query) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * URL per l'API REST v2 (`/api/v2/<percorso>`).
 * `path` è la parte dopo `/api/v2/`, senza barra iniziale.
 */
export function blockscoutV2Url(
  path: string,
  params: Record<string, string> = {},
  pubblico = false,
): string {
  const { origin, prefix, query } = pubblico ? PUBBLICA : leggiSorgente();
  const url = new URL(`${prefix}/api/v2/${path.replace(/^\/+/, '')}`, origin);
  for (const [k, v] of query) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Vero se è configurata una sorgente diversa da quella pubblica senza chiave. */
export function blockscoutConfigurato(): boolean {
  const { origin, query } = leggiSorgente();
  return origin !== DEFAULT_ORIGIN || query.has('apikey');
}

/** Etichetta della sorgente in uso, senza mai rivelare URL o chiave. */
export function blockscoutSorgente(): 'pro' | 'custom' | 'public' {
  const { origin, query } = leggiSorgente();
  if (origin === PRO_ORIGIN || query.has('apikey')) return 'pro';
  return origin === DEFAULT_ORIGIN ? 'public' : 'custom';
}

/**
 * Stessa richiesta, prima con la sorgente configurata e — solo se quella fallisce e solo se
 * è diversa dal pubblico — una seconda volta sul Blockscout pubblico.
 *
 * Serve a garantire un'invariante: **una variabile d'ambiente sbagliata non deve poter
 * peggiorare il servizio rispetto a non averla messa affatto.** Un URL con un refuso, una
 * chiave scaduta o un'istanza spenta si manifesterebbero altrimenti come un guasto
 * permanente e silenzioso, indistinguibile da un Blockscout giù.
 *
 * `costruisci` riceve la funzione che genera l'URL per la sorgente da provare.
 */
export async function blockscoutFetch(
  costruisci: (pubblico: boolean) => string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<{ res: Response; usatoPubblico: boolean }> {
  const haConfigurazione = blockscoutConfigurato();

  if (haConfigurazione) {
    try {
      const res = await fetch(costruisci(false), init);
      if (res.ok) return { res, usatoPubblico: false };
    } catch {
      // rete o URL inutilizzabile: si prova il pubblico
    }
  }

  const res = await fetch(costruisci(haConfigurazione ? true : false), init);
  return { res, usatoPubblico: haConfigurazione };
}
