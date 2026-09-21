// Compares the challenge served by the EDGE (requested without payment) against the one served
// by the ORIGIN (requested with an invalid payment, so the real pipeline re-issues the same
// challenge) across EVERY HTTP method.
//
// Why it exists: routing rules cannot filter by method -- the available conditions are header,
// cookie, query and host -- so every method reaches the edge, not just the GET the fixtures
// cover. A path whose challenge is only implemented for GET therefore answers 404 on the method
// that actually carries the payment.
//
// The origin ECHOES the method inside the challenge and inside the payment-required header; this
// check proves the edge echoes it identically.
//
// Usage: node verify-methods.mjs

// No query parameters here. The guarded paths answer the challenge to anyone who is not paying,
// and the challenge echoes the full URL in `resource.url`: asking the origin with a query string
// and the edge without it compares two different questions, and the difference is exactly the
// length of the query.
const PATHS = ["attestation", "catalog", "governance", "seal", "treasury-state", "quote", "jit", "invest", "health"];
const METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];

let mismatches = 0, total = 0;
for (const method of METHODS) {
  for (const name of PATHS) {
    const url = `https://gblin.digital/api/x402/${name}`;
    const edge = await fetch(url, { method, headers: { accept: "application/json" } });
    // EMPTY payment header: present for the routing rule, so the request reaches the origin, and
    // falsy for the middleware, so no parameter guard runs and the anonymous challenge is served.
    // A NON-empty value would make the origin answer 400 on the four guarded paths.
    const origin = await fetch(url, { method, headers: { accept: "application/json", "x-payment": "" } });
    const [bb, ob] = [await edge.text(), await origin.text()];
    const hb = edge.headers.get("payment-required") || "";
    const ho = origin.headers.get("payment-required") || "";
    const same = bb === ob && edge.status === origin.status && hb === ho;
    total++;
    if (!same) mismatches++;
    console.log(
      `${same ? "ok      " : "MISMATCH"}${method.padEnd(8)}${name.padEnd(16)}` +
      `${edge.status}/${origin.status}  ${Buffer.byteLength(bb)}/${Buffer.byteLength(ob)} bytes  ` +
      `header ${hb === ho ? "=" : "DIFFERENT"}`
    );
  }
}
console.log(`\n${total - mismatches}/${total} identical to the origin.`);
if (mismatches) process.exitCode = 1;
