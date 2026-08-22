#!/usr/bin/env node
// Misura i criteri di successo dell'esperimento su un deploy di PREVIEW.
//   node misura.mjs https://gblin-git-<branch>-....vercel.app
// Non paga niente: manda un header di pagamento FINTO solo per vedere DOVE finisce
// la richiesta (deve arrivare all'handler vero e fallire la verifica, non prendere il 402 statico).
import { readFileSync } from "node:fs";

const base = process.argv[2];
if (!base) { console.error("uso: node misura.mjs <url-del-preview>"); process.exit(2); }
const fx = JSON.parse(readFileSync(new URL("../x402-golden/attestation.json.json", import.meta.url).pathname, "utf8"));
const url = `${base}/api/x402/attestation`;
let fail = 0;
const check = (ok, label, extra = "") => { console.log(`${ok ? "ok      " : "FALLITO "} ${label}${extra ? "  — " + extra : ""}`); if (!ok) fail++; };

// 1) NON PAGANTE: deve dare il 402 identico alla fixture, servito dal bordo.
{
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const body = await r.text();
  check(r.status === 402, "non pagante: status 402", `ricevuto ${r.status}`);
  check(body === fx.body, "non pagante: corpo IDENTICO alla fixture",
        `${Buffer.byteLength(body)} byte vs ${Buffer.byteLength(fx.body)} attesi`);
  check(r.headers.get("payment-required") === fx.headers["payment-required"],
        "non pagante: header payment-required identico");
  const cache = r.headers.get("x-vercel-cache") || "(assente)";
  const mw = r.headers.get("x-middleware-rewrite") || r.headers.get("x-middleware-next");
  console.log(`         x-vercel-cache: ${cache}   indizi middleware: ${mw || "nessuno"}`);
}
// 2) CON HEADER DI PAGAMENTO (finto): NON deve ricevere il 402 statico.
{
  const r = await fetch(url, { headers: { accept: "application/json", "x-payment": "test-non-valido" } });
  const body = await r.text();
  check(body !== fx.body, "pagante: NON riceve il 402 statico (arriva all'handler vero)",
        body === fx.body ? "ha ricevuto la copia statica: i pagamenti sarebbero rotti" : `status ${r.status}`);
}
console.log(`\n${fail === 0 ? "TUTTI I CRITERI PASSATI" : fail + " CRITERI FALLITI"}`);
console.log("Manca ancora la prova decisiva: guardare su Vercel Observability > Functions e");
console.log("Usage > Invocations (scheda Type) che le richieste NON paganti non generino");
console.log("invocazioni di middleware ne' di function. Senza quel dato l'esperimento non conclude.");
process.exit(fail ? 1 : 0);
