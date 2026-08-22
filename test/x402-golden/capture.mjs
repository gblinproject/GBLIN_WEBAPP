#!/usr/bin/env node
// Cattura la "golden fixture" delle risposte non pagate degli endpoint x402.
// Serve perche' il catalogo Bazaar di Coinbase INDICIZZA la sfida 402: se cambia
// un byte senza che ce ne accorgiamo, spariamo dal catalogo o pubblichiamo termini
// sbagliati. Da qui in poi ogni modifica al percorso non pagato va confrontata con
// questi file: `node verify.mjs` fallisce se qualcosa e' cambiato.
//
//   node capture.mjs            # riscrive le fixture (solo quando il cambio E' voluto)
//   node verify.mjs [base]      # confronta il live con le fixture (CI / pre-deploy)
import { writeFileSync } from "node:fs";
import { PATHS, BASE, fetchOne, fixtureName } from "./common.mjs";

const base = process.argv[2] || BASE;
for (const p of PATHS) {
  for (const flavor of ["json", "html"]) {
    const r = await fetchOne(base, p, flavor);
    writeFileSync(fixtureName(p, flavor), JSON.stringify(r, null, 2) + "\n");
    console.log(`${String(p).padEnd(16)} ${flavor.padEnd(5)} ${r.status}  ${r.bytes} byte`);
  }
}
console.log("\nFixture riscritte. Committarle SOLO se il cambiamento e' voluto.");
