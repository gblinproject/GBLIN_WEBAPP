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

const SEMPLICI = ["attestation", "catalog", "governance", "seal", "treasury-state"];
const GUARDATI = {
  quote: "direction=buy&amount=100",
  jit: "usdc=10&wallet=0x0000000000000000000000000000000000000001",
  invest: "usdc=10&wallet=0x0000000000000000000000000000000000000001",
  health: "wallet=0x0000000000000000000000000000000000000001",
};
const METODI = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];

let diversi = 0, totale = 0;
for (const metodo of METODI) {
  for (const nome of [...SEMPLICI, ...Object.keys(GUARDATI)]) {
    const q = GUARDATI[nome] ? "?" + GUARDATI[nome] : "";
    const url = `https://gblin.digital/api/x402/${nome}${q}`;
    const bordo = await fetch(url, { method: metodo, headers: { accept: "application/json" } });
    // Un pagamento non valido non matcha la regola di riscrittura: arriva all'origin.
    const origin = await fetch(url, { method: metodo, headers: { accept: "application/json", "x-payment": "non-valido" } });
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
