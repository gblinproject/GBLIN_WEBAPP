// Sizes are measured in BYTES with Buffer.byteLength, never body.length: the latter
// counts UTF-16 code units, and the challenge contains 3-byte dashes, so the two
// measurements differ by a dozen and a stable challenge looks unstable.
export const BASE = "https://gblin.digital";
// The nine paths covered by the x402 middleware (same list as the matcher).
export const PATHS = ["catalog","treasury-state","quote","jit","invest","health","governance","attestation","seal"];
// Headers that are part of the public contract: the x402 challenge lives in the
// PAYMENT-REQUIRED header as well as in the body, and the content type decides the "flavor".
const CONTRACT_HEADERS = ["payment-required", "www-authenticate", "content-type", "x-payment-required"];

export const fixtureName = (p, flavor) => new URL(`./${p}.${flavor}.json`, import.meta.url).pathname;

// `fromOrigin` belongs to CAPTURE and to capture only, and it sends an EMPTY payment header.
//
// Why empty rather than a fake value: the anonymous 402 challenge is served by the edge worker,
// so a plain GET reads the EDGE and the tool captures its own output. Reaching the origin means
// bypassing the routing rule, which triggers on the ABSENCE of the payment headers, while the
// parameter guard triggers on their NON-EMPTY presence. The two conditions do not coincide, and
// an empty header fits exactly in the gap:
//   routing -> the header exists -> the rule does not match -> the request reaches the origin
//   origin  -> headers.get() returns "" (falsy) -> not paying -> anonymous challenge, no guard
// A whitespace-only value behaves the same, because the Headers API trims it per spec.
// VERIFICATION stays anonymous: there the point is to measure what the world sees.
//
// This is OBSERVED behaviour, not documented (the documentation covers presence and value, not
// the empty value). Hence the two assertions below, which fail the capture rather than write
// poisoned fixtures.
// Paths that accept a single verb: their challenge exists only on that verb, and capturing it
// with GET would return 405. A path-only route key makes the challenge answer every method while
// advertising "method: GET", so an agent that follows the advertised metadata pays and then
// receives a 405.
export const VERB = { seal: "POST" };

export async function fetchOne(base, path, flavor, fromOrigin = false) {
  const accept = flavor === "html" ? "text/html,application/xhtml+xml" : "application/json";
  const requestHeaders = fromOrigin ? { accept, "x-payment": "" } : { accept };
  const method = VERB[path] || "GET";
  const res = await fetch(`${base}/api/x402/${path}`, { method, headers: requestHeaders });
  const body = await res.text();
  const headers = {};
  for (const h of CONTRACT_HEADERS) { const v = res.headers.get(h); if (v) headers[h] = v; }
  const fromEdge = !!res.headers.get("x-gblin-edge-challenge");
  return { path: `/api/x402/${path}`, accept, method, status: res.status, headers, bytes: Buffer.byteLength(body, "utf8"), body, fromEdge };
}

// Two assertions, not one. The first alone only says WHERE the response came from, not that it
// is the canonical form. The second is needed because the challenge echoes the full URL, query
// included, so a capture made by mistake with parameters would pass unnoticed.
export function assertCapture(path, r) {
  if (r.fromEdge) {
    throw new Error(
      `${path}: the EDGE answered, not the origin. The capture would have bitten its own tail ` +
      `and the fixtures would have become a copy of themselves. Likely cause: Vercel no longer ` +
      `treats an empty-valued header as "present". Do NOT commit anything and review the method.`
    );
  }
  let j = null;
  try { j = JSON.parse(r.body); } catch { return; }
  const u = j && j.resource && j.resource.url;
  if (typeof u === "string" && u.includes("?")) {
    throw new Error(
      `${path}: the captured challenge declares resource.url WITH a query string (${u}). The ` +
      `canonical form - the one crawlers, the validator and the Bazaar see - has none. ` +
      `Capture without parameters.`
    );
  }
}
