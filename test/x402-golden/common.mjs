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

// `daOrigin` serve alla CATTURA e solo a lei, e usa un header di pagamento VUOTO.
//
// PERCHE' VUOTO e non un valore finto: dal 22/08/2026 la sfida 402 anonima la serve il Worker al
// bordo, quindi una GET normale legge il BORDO e lo strumento si morde la coda (preso il 30/08:
// lo script diceva "18/18 identiche" senza aver fatto nulla). Per raggiungere l'origine bisogna
// aggirare la routing rule, che scatta sull'ASSENZA degli header di pagamento. Ma dal 30/08 la
// guardia sui parametri scatta sulla loro PRESENZA NON VUOTA. Le due condizioni non coincidono, e
// nella fessura ci sta esattamente un header vuoto:
//   Vercel  -> l'header c'e' -> la regola non matcha -> va all'origine
//   noi     -> req.headers.get() da "" (falsy) -> non sta pagando -> sfida anonima, niente guardia
// Misurato: 8 colpi su 8 arrivano all'origine; e un valore di soli spazi e' equivalente al vuoto,
// perche' l'API Headers lo taglia per specifica. La VERIFICA resta anonima: li' vogliamo misurare
// cio' che vede il mondo.
//
// ATTENZIONE: e' comportamento OSSERVATO, non documentato da Vercel (la doc copre presenza e
// valore, non il valore vuoto). Per questo sotto ci sono due asserzioni che fanno fallire la
// cattura invece di scrivere fixture avvelenate.
export async function fetchOne(base, path, flavor, daOrigin = false) {
  const accept = flavor === "html" ? "text/html,application/xhtml+xml" : "application/json";
  const richiesta = daOrigin ? { accept, "x-payment": "" } : { accept };
  const res = await fetch(`${base}/api/x402/${path}`, { headers: richiesta });
  const body = await res.text();
  const headers = {};
  for (const h of CONTRACT_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v; }
  const daBordo = !!res.headers.get("x-gblin-edge-challenge");
  return { path: `/api/x402/${path}`, accept, status: res.status, headers, bytes: Buffer.byteLength(body, "utf8"), body, daBordo };
}

// Due asserzioni, non una. La prima da sola non basta: dice solo DA DOVE arriva la risposta, non
// che sia la forma canonica. La seconda serve perche' la sfida echeggia l'URL completo, query
// inclusa, e una cattura fatta per sbaglio con i parametri passerebbe indisturbata.
export function controllaCattura(path, r) {
  if (r.daBordo) {
    throw new Error(
      `${path}: ha risposto il BORDO, non l'origine. La cattura si sarebbe morsa la coda e le ` +
      `fixture sarebbero diventate una copia di se stesse. Probabile causa: Vercel non considera ` +
      `piu' "presente" un header di valore vuoto. NON committare nulla e rivedi il metodo.`
    );
  }
  let j = null;
  try { j = JSON.parse(r.body); } catch { return; }
  const u = j && j.resource && j.resource.url;
  if (typeof u === "string" && u.includes("?")) {
    throw new Error(
      `${path}: la sfida catturata dichiara resource.url CON query string (${u}). La forma ` +
      `canonica — quella che vedono crawler, validatore e Bazaar — non ne ha. Cattura senza parametri.`
    );
  }
}
