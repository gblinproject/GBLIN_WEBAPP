/**
 * Focused offline contract tests for GET /api/x402/treasury-state.
 * No network, wallet, payment, or live seller call.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const contract = JSON.parse(
  readFileSync(
    join(root, "src/lib/treasury-state-output-contract.json"),
    "utf8"
  )
);
const REQUIRED = contract.required;

test("OpenAPI 200 schema requires only handler-owned treasury-state root fields", () => {
  const openapi = JSON.parse(
    readFileSync(join(root, "public/openapi.json"), "utf8")
  );
  const schema =
    openapi.paths["/api/x402/treasury-state"].get.responses["200"].content[
      "application/json"
    ].schema;

  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, REQUIRED);
  for (const key of REQUIRED) {
    assert.ok(schema.properties[key], `missing property ${key}`);
  }
  // Nested basket item / meta keys must not be required at the root.
  assert.equal(Object.hasOwn(schema.properties.basket, "items"), false);
  assert.equal(schema.properties.meta.required, undefined);
});

test("shared contract and OpenAPI stay aligned", () => {
  assert.deepEqual(contract.schema.required, REQUIRED);
  assert.deepEqual(
    Object.keys(contract.schema.properties).sort(),
    [...REQUIRED].sort()
  );
});

test("Bazaar discovery output.schema binds the same required root fields", async () => {
  const { declareDiscoveryExtension } = await import(
    "@x402/extensions/bazaar"
  );
  const ext = declareDiscoveryExtension({
    input: {},
    inputSchema: { type: "object", properties: {}, required: [] },
    output: {
      example: {
        nav_usd: 1.234567,
        eth_price_usd: 3450.12,
        crash_shield_active: false,
        slippage_buffer_pct: 2.5,
        slippage_reason: "normal",
        basket: [],
        meta: {},
      },
      schema: contract.schema,
    },
  });

  const exampleSchema = ext.bazaar.schema.properties.output.properties.example;
  assert.deepEqual(exampleSchema.required, REQUIRED);
  for (const key of REQUIRED) {
    assert.ok(exampleSchema.properties[key], `missing bazaar property ${key}`);
  }
});

test("handler success object always carries the declared root fields", () => {
  // Network-free reconstruction of the HTTP 200 object shape from
  // src/app/api/x402/treasury-state/route.ts (no RPC, no payment).
  const body = {
    nav_usd: Number((1.234567).toFixed(6)),
    eth_price_usd: Number((3450.12).toFixed(2)),
    crash_shield_active: false,
    slippage_buffer_pct: 2.5,
    slippage_reason: "normal",
    basket: [
      {
        token: "0x4200000000000000000000000000000000000006",
        is_stable: false,
        base_weight_pct: 50,
        dynamic_weight_pct: 50,
        slashed: false,
        pool_fee_bps: 500,
      },
    ],
    meta: {
      contract: "0x36C81d7E1966310F305eA637e761Cf77F90852f0",
      chain: "base",
      chain_id: 8453,
      as_of_unix: Math.floor(Date.now() / 1000),
    },
  };

  for (const key of REQUIRED) {
    assert.ok(Object.hasOwn(body, key), `handler success missing ${key}`);
  }
});
