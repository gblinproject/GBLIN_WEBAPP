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

interface Sorgente {
  origin: string;
  /** Parametri già presenti nella configurazione, tipicamente `apikey`. */
  query: URLSearchParams;
}

function leggiSorgente(): Sorgente {
  const raw = (process.env.BLOCKSCOUT_API_URL ?? '').trim();
  if (!raw) {
    return { origin: DEFAULT_ORIGIN, query: new URLSearchParams() };
  }

  try {
    // Senza schema `new URL` fallisce: lo mettiamo noi invece di rifiutare il valore.
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const query = new URLSearchParams(url.search);

    // Chiave passata a parte, se qualcuno preferisce tenerla in una env sua.
    const key = (process.env.BLOCKSCOUT_API_KEY ?? '').trim();
    if (key && !query.has('apikey')) query.set('apikey', key);

    return { origin: url.origin, query };
  } catch {
    // Un valore malformato non deve spegnere le letture on-chain: si torna al pubblico.
    return { origin: DEFAULT_ORIGIN, query: new URLSearchParams() };
  }
}

/**
 * URL per l'API in stile etherscan (`/api?module=…&action=…`).
 * I parametri passati qui vincono su quelli configurati, tranne `apikey`.
 */
export function blockscoutLegacyUrl(params: Record<string, string>, pubblico = false): string {
  const { origin, query } = pubblico
    ? { origin: DEFAULT_ORIGIN, query: new URLSearchParams() }
    : leggiSorgente();
  const url = new URL('/api', origin);
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
  const { origin, query } = pubblico
    ? { origin: DEFAULT_ORIGIN, query: new URLSearchParams() }
    : leggiSorgente();
  const url = new URL(`/api/v2/${path.replace(/^\/+/, '')}`, origin);
  for (const [k, v] of query) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Vero se è configurata una sorgente diversa da quella pubblica senza chiave. */
export function blockscoutConfigurato(): boolean {
  const { origin, query } = leggiSorgente();
  return origin !== DEFAULT_ORIGIN || query.has('apikey');
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
