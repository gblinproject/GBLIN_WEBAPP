# Experiment: serving the 402 challenge from the platform edge, without invoking a function

**Status: prepared, not applied.** Nothing in this directory affects production until the
files are copied into place on a branch. The repository's `vercel.json` is unmodified.

## Rationale

The x402 middleware accounted for about 91% of the billed Fluid CPU of the hosting account,
and almost all of those invocations did nothing but return a 402 challenge to crawlers and
uptime probes. The middleware runs *before* the CDN cache, so no cache can reduce it, and
402 is not a cacheable status on the platform, so the challenge cannot be served from the
CDN either. The platform firewall cannot emit a custom body: its actions are limited to log,
deny, challenge, bypass and rate limit.

One candidate remains that needs neither an external edge nor a DNS change: the legacy
`routes` entries of `vercel.json`, which can serve a **static file with a custom status**.
If the routing layer serves the 402 from a file, the function is never invoked and the cost
disappears.

## Three traps - ignoring any of them invalidates the experiment

1. **Routing order.** The middleware runs *before* the filesystem handler. If the middleware
   matcher still covers `/api/x402/*` the middleware runs anyway, and the measurement proves
   nothing about the CPU share. The matcher must be narrowed as well (see below).
2. **Body and content type.** `status` alone does not produce the right response: a `dest`
   pointing at a static file and the contract headers are both required. The challenge also
   lives in the base64 `payment-required` header, not only in the body, and must be
   reproduced identically.
3. **Paying requests.** A route that always serves the static 402 breaks payments. The
   `missing` condition on the payment headers is mandatory. If `missing` does not work with
   the App Router the candidate dies here, which is a useful negative result rather than an
   incident.

## Known risk before starting

`vercel.json` declares no rewrites, redirects or headers, but `next.config.js` does declare
`headers()` and `redirects()`. Legacy `routes` entries coexist badly with the routing the
framework builder generates, so there is a real probability that the candidate does not hold
together. That is what the preview deployment is for.

## How to apply (on a branch, never on the default branch)

1. Copy `public-x402/attestation.json` to `public/x402-static/attestation.json`.
2. Copy the proposed `vercel.json` shipped in this directory over the repository's
   `vercel.json`.
3. In `src/middleware.ts`, inside `config.matcher`, replace the entry
   `"/api/x402/attestation"` with its conditional form:

```js
{ source: "/api/x402/attestation",
  has: [{ type: "header", key: "x-payment" }] },
{ source: "/api/x402/attestation",
  has: [{ type: "header", key: "payment-signature" }] },
```

   Only `attestation` is changed: the experiment covers one endpoint, not all nine.
4. Push the branch, let the platform build the preview, and measure.

## Success criteria - all four, otherwise the candidate is discarded

    node measure.mjs https://<preview-url>

1. an unpaid request returns **402**;
2. the body is **byte-identical** to the golden fixture in `test/x402-golden`;
3. the `payment-required` header is identical;
4. a request **carrying** a payment header does not receive the static copy and reaches the
   real handler.

`measure.mjs` pays nothing: the payment header it sends is deliberately invalid, and is only
used to observe where the request ends up.

There is a fifth criterion, the one that actually matters, which the script cannot read on
its own: in the platform dashboard, under Observability > Functions and Usage > Invocations
(Type tab), unpaid requests must generate **neither middleware nor function invocations**.
Without that data the experiment concludes nothing.

## Rollback

Restore `vercel.json`, delete `public/x402-static/`, restore the original matcher. The
branch is deleted and production never saw any of it.

## If the candidate fails

The fallback is an external edge - a Cloudflare Worker fronting the paid paths - bearing in
mind two facts that pull in opposite directions: the hosting platform advises against
putting a reverse proxy in front of it (loss of client signals, weaker bot protection,
added latency, a second cache), while the x402 reference architecture published by the
protocol authors is precisely an edge that answers the unpaid challenge in front of an
untouched origin.
