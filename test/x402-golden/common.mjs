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

export async function fetchOne(base, path, flavor) {
  const accept = flavor === "html" ? "text/html,application/xhtml+xml" : "application/json";
  const res = await fetch(`${base}/api/x402/${path}`, { headers: { accept } });
  const body = await res.text();
  const headers = {};
  for (const h of CONTRACT_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v; }
  return { path: `/api/x402/${path}`, accept, status: res.status, headers, bytes: Buffer.byteLength(body, "utf8"), body };
}
