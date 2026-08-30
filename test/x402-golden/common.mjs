// NOTA: contiamo i BYTE con Buffer.byteLength, non body.length — quest'ultimo conta i
// caratteri UTF-16, e la sfida contiene trattini lunghi da 3 byte: le due misure
// differiscono di una dozzina e sembrerebbe una sfida instabile quando non lo e'.
export const BASE = "https://gblin.digital";
// I nove percorsi coperti dal middleware x402 (stesso elenco del matcher).
export const PATHS = ["catalog","treasury-state","quote","jit","invest","health","governance","attestation","seal"];
// Header che fanno parte del contratto pubblico: la sfida x402 vive nell'header
// PAYMENT-REQUIRED oltre che nel corpo, e il tipo di contenuto decide il "flavor".
const CONTRACT_HEADERS = ["payment-required", "www-authenticate", "content-type", "x-payment-required"];

export const fixtureName = (p, flavor) => new URL(`./${p}.${flavor}.json`, import.meta.url).pathname;

// `daOrigin` serve alla CATTURA e solo a lei. Dal 22/08/2026 la sfida 402 anonima la serve il
// Worker al bordo: una GET normale legge quindi il BORDO, non l'origine. Catturare cosi' fa
// mordere la coda allo strumento — le fixture non imparano mai le modifiche fatte su Vercel, e
// il generatore del bordo le rigenera identiche a se stesse. Successo apparente, zero effetto.
// (Preso il 30/08/2026: la dichiarazione Bazaar su seal e catalog non entrava mai nel bordo.)
// Un `x-payment` non valido non matcha la regola di riscrittura, quindi arriva all'origine, che
// ripropone la STESSA sfida byte per byte. La VERIFICA invece deve restare anonima: li' vogliamo
// misurare proprio cio' che vede il mondo.
export async function fetchOne(base, path, flavor, daOrigin = false) {
  const accept = flavor === "html" ? "text/html,application/xhtml+xml" : "application/json";
  const richiesta = daOrigin ? { accept, "x-payment": "non-valido" } : { accept };
  const res = await fetch(`${base}/api/x402/${path}`, { headers: richiesta });
  const body = await res.text();
  const headers = {};
  for (const h of CONTRACT_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v; }
  return { path: `/api/x402/${path}`, accept, status: res.status, headers, bytes: Buffer.byteLength(body, "utf8"), body };
}
