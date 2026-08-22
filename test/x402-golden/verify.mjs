#!/usr/bin/env node
// Confronta le risposte NON PAGATE dal vivo con le fixture committate.
// Esce 1 al primo scostamento: status, header di contratto o corpo byte-per-byte.
import { readFileSync } from "node:fs";
import { PATHS, BASE, fetchOne, fixtureName } from "./common.mjs";

const base = process.argv[2] || BASE;
let bad = 0, checked = 0;
for (const p of PATHS) {
  for (const flavor of ["json", "html"]) {
    let want;
    try { want = JSON.parse(readFileSync(fixtureName(p, flavor), "utf8")); }
    catch { console.log(`MANCA FIXTURE  ${p} ${flavor}`); bad++; continue; }
    const got = await fetchOne(base, p, flavor);
    const diffs = [];
    if (got.status !== want.status) diffs.push(`status ${want.status} -> ${got.status}`);
    for (const k of new Set([...Object.keys(want.headers), ...Object.keys(got.headers)])) {
      if (want.headers[k] !== got.headers[k]) diffs.push(`header ${k}`);
    }
    if (got.body !== want.body) diffs.push(`corpo (${want.body.length} -> ${got.bytes} byte)`);
    checked++;
    if (diffs.length) { console.log(`DIVERSO  ${p} ${flavor}: ${diffs.join(", ")}`); bad++; }
    else console.log(`ok       ${p} ${flavor}  ${got.status}  ${got.bytes} byte`);
  }
}
console.log(`\n${checked - bad}/${checked} identiche.`);
if (bad) { console.log("La sfida non pagata E' CAMBIATA. Se il cambio e' voluto: node capture.mjs e ricommitta."); process.exit(1); }
