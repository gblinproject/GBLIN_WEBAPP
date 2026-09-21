# Golden fixtures of the unpaid x402 challenge

The 402 response returned by the paid endpoints is part of the public contract. x402
catalogues index it and payment clients read the terms of payment from it, so a change that
goes unnoticed either drops the endpoints from the catalogues or publishes the wrong terms.
The files in this directory are a byte-for-byte snapshot of that response.

## Commands

    node verify.mjs                  # compare the live responses with the fixtures (exit 1 on any difference)
    node verify.mjs https://<base>   # same comparison against a preview deployment
    node capture.mjs                 # rewrite the fixtures - only when the change is intended
    node verify-methods.mjs          # 45 edge-against-origin comparisons (9 paths x 5 HTTP methods)

`capture.mjs` overwrites the committed contract: its output must be reviewed and committed
only when the difference it produces is the intended one.

## Coverage

18 fixtures: the nine paths of the x402 matcher, each in the two `accept` flavors
(`json` and `html`).

Three things are compared: the status code, the contract headers (`payment-required`,
`www-authenticate`, `content-type`, `x-payment-required`) and the whole response body.

Each path is captured with the verb its challenge is implemented for: `seal` answers on
`POST`, every other path on `GET`. A path-only route key would make the challenge answer
every method while still advertising `method: GET`, so a client that follows the advertised
metadata would pay and then receive a 405.

## Guarded paths

`quote`, `jit`, `invest` and `health` take query parameters. Their parameter guard is bound
to the presence of a **non-empty** payment header, which keeps two properties at once:

- an unpaid request always receives the 402 challenge, so crawlers, the catalogue indexer
  and the payment validator can read the terms;
- a paying request carrying wrong parameters is rejected with 400 *before* verification and
  settlement, so a signed authorization is never submitted and nothing is ever charged for a
  malformed call.

## The capture reads the origin, the verification reads the edge

Unpaid requests are rewritten to an edge worker by routing rules, so a plain anonymous `GET`
reads the edge. A capture made that way would record the edge's own output as if it were the
origin's, report everything identical and compare nothing.

`capture.mjs` therefore sends an **empty** `x-payment` header. The routing rule triggers on
the *absence* of the payment headers, while the parameter guard triggers on their *non-empty
presence*; the two conditions do not coincide, and an empty value fits exactly in the gap:

    routing -> the header exists    -> the rule does not match -> the request reaches the origin
    origin  -> headers.get() === "" -> falsy, so not paying    -> anonymous challenge, no guard

A whitespace-only value behaves identically, because the Headers API trims it per
specification. This is observed behaviour, not documented behaviour: the documentation
covers the presence and the value of a header, not the empty value. Two assertions therefore
abort the capture instead of writing poisoned fixtures - one when the response came from the
edge, one when the captured challenge declares a `resource.url` containing a query string
(the canonical form seen by crawlers and by the validator has none).

The verification stays anonymous on purpose: there the point is to measure what the outside
world actually receives.

## verify-methods.mjs

Routing rules cannot filter by HTTP method - the available conditions are header, cookie,
query and host - so every method reaches the edge, while the fixtures only pin the capture
verb. A challenge implemented for one verb only therefore answers 404 on the verb that
actually carries the payment, and the failure surfaces on the first client that attempts
discovery with it.

The origin echoes the request method inside the challenge body and inside the base64
`payment-required` header; this check proves the edge echoes it identically across `GET`,
`POST`, `PUT`, `DELETE` and `OPTIONS`. The origin side is queried with the same empty
payment header used by the capture, so both sides answer the same question; no query
parameters are sent, because the challenge echoes the full URL and adding a query string to
one side only would compare two different requests.

## Counting bytes

Sizes are measured with `Buffer.byteLength`, never with `body.length`. The latter counts
UTF-16 code units and the challenge contains multibyte characters, so the two measurements
differ by a dozen and a stable challenge looks unstable.

## After an intended change

Recapture here, then regenerate the edge worker's challenge module with the worker's
`generate-challenges.mjs` tool and redeploy the worker. The module is generated from these
fixtures: skipping the regeneration leaves the edge and the origin publishing different
terms for the same resource.
