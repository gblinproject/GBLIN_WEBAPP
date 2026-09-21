#!/usr/bin/env node
// Compares the live UNPAID responses against the committed fixtures.
// Exits 1 on the first deviation: status, contract header or body byte-for-byte.
import { readFileSync } from "node:fs";
import { PATHS, BASE, fetchOne, fixtureName } from "./common.mjs";

const base = process.argv[2] || BASE;
let bad = 0, checked = 0;
for (const p of PATHS) {
  for (const flavor of ["json", "html"]) {
    let want;
    try { want = JSON.parse(readFileSync(fixtureName(p, flavor), "utf8")); }
    catch { console.log(`MISSING FIXTURE  ${p} ${flavor}`); bad++; continue; }
    const got = await fetchOne(base, p, flavor);
    const diffs = [];
    if (got.status !== want.status) diffs.push(`status ${want.status} -> ${got.status}`);
    for (const k of new Set([...Object.keys(want.headers), ...Object.keys(got.headers)])) {
      if (want.headers[k] !== got.headers[k]) diffs.push(`header ${k}`);
    }
    if (got.body !== want.body) diffs.push(`body (${want.body.length} -> ${got.bytes} bytes)`);
    checked++;
    if (diffs.length) { console.log(`DIFFERENT ${p} ${flavor}: ${diffs.join(", ")}`); bad++; }
    else console.log(`ok        ${p} ${flavor}  ${got.status}  ${got.bytes} bytes`);
  }
}
console.log(`\n${checked - bad}/${checked} identical.`);
if (bad) { console.log("The unpaid challenge HAS CHANGED. If the change is intended: node capture.mjs and re-commit."); process.exit(1); }
