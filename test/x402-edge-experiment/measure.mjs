#!/usr/bin/env node
// Measures the success criteria of the experiment on a PREVIEW deployment.
//   node measure.mjs https://gblin-git-<branch>-....vercel.app
// It pays nothing: it sends a FAKE payment header only to see WHERE the request ends up
// (it must reach the real handler and fail verification, not receive the static 402).
import { readFileSync } from "node:fs";

const base = process.argv[2];
if (!base) { console.error("usage: node measure.mjs <preview-url>"); process.exit(2); }
const fx = JSON.parse(readFileSync(new URL("../x402-golden/attestation.json.json", import.meta.url).pathname, "utf8"));
const url = `${base}/api/x402/attestation`;
let fail = 0;
const check = (ok, label, extra = "") => { console.log(`${ok ? "ok      " : "FAILED  "} ${label}${extra ? "  - " + extra : ""}`); if (!ok) fail++; };

// 1) NOT PAYING: it must return the 402 identical to the fixture, served by the edge.
{
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const body = await r.text();
  check(r.status === 402, "not paying: status 402", `received ${r.status}`);
  check(body === fx.body, "not paying: body IDENTICAL to the fixture",
        `${Buffer.byteLength(body)} bytes vs ${Buffer.byteLength(fx.body)} expected`);
  check(r.headers.get("payment-required") === fx.headers["payment-required"],
        "not paying: payment-required header identical");
  const cache = r.headers.get("x-vercel-cache") || "(absent)";
  const mw = r.headers.get("x-middleware-rewrite") || r.headers.get("x-middleware-next");
  console.log(`         x-vercel-cache: ${cache}   middleware hints: ${mw || "none"}`);
}
// 2) WITH A (FAKE) PAYMENT HEADER: it must NOT receive the static 402.
{
  const r = await fetch(url, { headers: { accept: "application/json", "x-payment": "test-not-valid" } });
  const body = await r.text();
  check(body !== fx.body, "paying: does NOT receive the static 402 (it reaches the real handler)",
        body === fx.body ? "it received the static copy: payments would be broken" : `status ${r.status}`);
}
console.log(`\n${fail === 0 ? "ALL CRITERIA PASSED" : fail + " CRITERIA FAILED"}`);
console.log("The decisive proof is still missing: check on Vercel Observability > Functions and");
console.log("Usage > Invocations (Type tab) that NON-paying requests generate neither middleware");
console.log("nor function invocations. Without that data the experiment does not conclude.");
process.exit(fail ? 1 : 0);
