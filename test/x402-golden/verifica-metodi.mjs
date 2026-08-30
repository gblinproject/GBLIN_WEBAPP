// Confronta la sfida servita dal BORDO (Cloudflare, richiesta senza pagamento) con quella
// servita dall'ORIGIN (Vercel, richiesta con un pagamento non valido: la pipeline vera
// ripropone la stessa sfida) su TUTTI i metodi HTTP.
//
// Perche' esiste: le Project Routing Rule di Vercel NON sanno filtrare per metodo (le
// condizioni disponibili sono solo Header, Cookie, Query, Host), quindi al bordo arriva
// ogni metodo, non solo il GET delle fixture. Il 22/08/2026 questo ha prodotto una
// regressione vera: POST /api/x402/seal — l'endpoint a pagamento dei sigilli — rispondeva
// 404 invece della sfida. Trovata prima che la incontrasse un cliente.
//
// L'origin ECHEGGIA il metodo dentro la sfida (due campi Bazaar) e dentro l'header
// payment-required: qui si verifica che il bordo lo echeggi identico.
//
// Uso: node verifica-metodi.mjs

// 30/08/2026: quote/jit/invest/health erano interrogati CON i parametri d'esempio, perche' senza
// l'origin rispondeva 400. Ora la guardia scatta solo per chi paga, quindi l'anonimo riceve sempre
// la sfida e i parametri vanno TOLTI: la sfida echeggia l'URL completo in `resource.url`, quindi
// interrogare l'origin con la query e il bordo senza confrontava due domande diverse. Si vedeva
// dall'aritmetica: la differenza era esattamente la lunghezza della query, 25/58/58/50 byte.
const PERCORSI = ["attestation", "catalog", "governance", "seal", "treasury-state", "quote", "jit", "invest", "health"];
const METODI = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];

let diversi = 0, totale = 0;
for (const metodo of METODI) {
  for (const nome of PERCORSI) {
    const url = `https://gblin.digital/api/x402/${nome}`;
    const bordo = await fetch(url, { method: metodo, headers: { accept: "application/json" } });
    // Header di pagamento VUOTO: presente per la routing rule (quindi arriva all'origin), falsy per
    // il nostro middleware (quindi niente guardia sui parametri, e la sfida e' quella anonima).
    // Con un valore NON vuoto l'origin risponderebbe 400 sui quattro percorsi guardati.
    const origin = await fetch(url, { method: metodo, headers: { accept: "application/json", "x-payment": "" } });
    const [bb, ob] = [await bordo.text(), await origin.text()];
    const hb = bordo.headers.get("payment-required") || "";
    const ho = origin.headers.get("payment-required") || "";
    const uguali = bb === ob && bordo.status === origin.status && hb === ho;
    totale++;
    if (!uguali) diversi++;
    console.log(
      `${uguali ? "ok      " : "DIVERSO "}${metodo.padEnd(8)}${nome.padEnd(16)}` +
      `${bordo.status}/${origin.status}  ${Buffer.byteLength(bb)}/${Buffer.byteLength(ob)} byte  ` +
      `header ${hb === ho ? "=" : "DIVERSO"}`
    );
  }
}
console.log(`\n${totale - diversi}/${totale} identiche all'origin.`);
if (diversi) process.exitCode = 1;
