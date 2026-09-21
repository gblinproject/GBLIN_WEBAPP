#!/usr/bin/env node
// Captures the "golden fixture" of the unpaid responses of the x402 endpoints.
// It exists because Coinbase's Bazaar catalogue INDEXES the 402 challenge: if a byte
// changes without us noticing, we drop out of the catalogue or publish the wrong terms.
// From here on every change to the unpaid path must be compared against these files:
// `node verify.mjs` fails if anything changed.
//
//   node capture.mjs            # rewrites the fixtures (only when the change IS intended)
//   node verify.mjs [base]      # compares live against the fixtures (CI / pre-deploy)
import { writeFileSync } from "node:fs";
import { PATHS, BASE, fetchOne, fixtureName, assertCapture } from "./common.mjs";

const base = process.argv[2] || BASE;
for (const p of PATHS) {
  for (const flavor of ["json", "html"]) {
    const r = await fetchOne(base, p, flavor, true);
    assertCapture(`${p} ${flavor}`, r); // from the ORIGIN, never from the edge
    const { fromEdge, ...fixture } = r; // fromEdge is diagnostics, not contract
    writeFileSync(fixtureName(p, flavor), JSON.stringify(fixture, null, 2) + "\n");
    console.log(`${String(p).padEnd(16)} ${flavor.padEnd(5)} ${r.status}  ${r.bytes} bytes`);
  }
}
console.log("\nFixtures rewritten. Commit them ONLY if the change is intended.");
