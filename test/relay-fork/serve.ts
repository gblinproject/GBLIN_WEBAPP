/**
 * Serves only the relay route on a local port, for tests that reach it over HTTP (the MCP server's
 * relay_gblin_payment). Run against a fork, never against mainnet with a funded key.
 *
 *   GBLIN_RPC_URL=http://127.0.0.1:8555 RELAYER_PRIVATE_KEY=0x… npx tsx test/relay-fork/serve.ts
 */

import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8570);

(async () => {
  const route = await import("../../src/app/api/relay/gblin/route");
  createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
      ...(req.method === "POST" ? { body: Buffer.concat(chunks).toString() } : {}),
    });
    const response = req.method === "POST" ? await route.POST(request) : await route.GET();
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  }).listen(port, () => console.log(`relay test server on ${port}`));
})();
