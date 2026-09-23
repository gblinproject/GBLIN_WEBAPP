/**
 * GBLIN payment relay — carries a signed GBLIN transfer on chain for a payer who holds no ETH.
 *
 * GET  /api/relay/gblin   the current fee, in GBLIN at the live NAV, and how to use the relay.
 * POST /api/relay/gblin   { payment: { authorization, signature }, fee: { authorization, signature } }
 *
 * The payer signs two EIP-3009 TransferWithAuthorization messages with its own wallet: the payment,
 * and the relay fee to the fee recipient. The relay checks both against the chain, simulates them,
 * and submits them in ONE transaction through Multicall3, so either both settle or neither does: the
 * fee is never taken without the payment, and the payment never travels without the fee.
 *
 * The relay's wallet only ever calls transferWithAuthorization on the GBLIN vault with calldata built
 * here from checked fields; it holds only the ETH it spends on gas. Without RELAYER_PRIVATE_KEY the
 * endpoint answers 503 and moves nothing.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  isHex,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { GBLIN, RPC_URL, client, getNavUsd, jsonResponse } from "@/lib/x402-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";
/** The relay fee in USD: the median price of paid token-transfer relays on the x402 catalog (0.05), less 10%. */
const RELAY_FEE_USD = 0.045;
/** A fee down to 95% of the current quote is accepted: the NAV moves between the quote and the signature. */
const FEE_TOLERANCE_BPS = 500n;
/** Gas limit of the relayed transaction: two authorized transfers through Multicall3. */
const RELAY_GAS_LIMIT = 400_000n;
/** Below this ETH balance the relay refuses work rather than fail mid-way. */
const MIN_RELAYER_ETH = parseUnits("0.0002", 18);
const FEE_RECIPIENT: Address = getAddress(process.env.RELAY_FEE_RECIPIENT ?? "0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B");

const VAULT_ABI = parseAbi([
  "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)",
]);
const MULTICALL3_ABI = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calls) payable returns (Result[] returnData)",
]);
const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

interface Authorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
}

function relayer() {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const account = privateKeyToAccount(key as Hex);
  return { account, wallet: createWalletClient({ account, chain: base, transport: http(RPC_URL, { timeout: 20_000 }) }) };
}

async function domain() {
  const d = await client.readContract({ address: GBLIN, abi: VAULT_ABI, functionName: "eip712Domain" });
  return { name: d[1], version: d[2], chainId: Number(d[3]), verifyingContract: d[4] };
}

async function quote() {
  const nav = await getNavUsd();
  if (!(nav > 0)) throw new Error("The NAV cannot be priced right now.");
  const feeShares = parseUnits((RELAY_FEE_USD / nav).toFixed(18), 18) + 1n;
  return { nav, feeShares };
}

/**
 * Receipts are read from several endpoints, because some public RPCs refuse eth_getTransactionReceipt
 * outright (publicnode answers every receipt request as an archive request), and a refusal is not the
 * same as "not mined yet". Each is asked in turn until one returns the receipt or the time runs out.
 */
const RECEIPT_CLIENTS = [RPC_URL, "https://mainnet.base.org", "https://base.drpc.org", "https://gateway.tenderly.co/public/base"].map(
  (url) => createPublicClient({ chain: base, transport: http(url, { timeout: 8_000, retryCount: 0 }) })
);
async function waitForReceipt(hash: Hex, timeoutMs: number) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    for (const c of RECEIPT_CLIENTS) {
      const receipt = await c.getTransactionReceipt({ hash }).catch(() => null);
      if (receipt) return receipt;
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return null;
}

/** Per-instance limit: a few relays per IP per minute. The fee is the real guard; this caps bursts. */
const recent = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 10) return false;
  hits.push(now);
  recent.set(ip, hits);
  return true;
}

function parseAuthorization(raw: unknown, label: string): Authorization {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a !== "object") throw new Error(`${label}.authorization is missing.`);
  const num = (k: string) => {
    const v = a[k];
    if (typeof v !== "string" && typeof v !== "number") throw new Error(`${label}.authorization.${k} is missing.`);
    if (!/^\d+$/.test(String(v))) throw new Error(`${label}.authorization.${k} must be an integer.`);
    return BigInt(String(v));
  };
  if (typeof a.from !== "string" || !isAddress(a.from)) throw new Error(`${label}.authorization.from is not an address.`);
  if (typeof a.to !== "string" || !isAddress(a.to)) throw new Error(`${label}.authorization.to is not an address.`);
  if (typeof a.nonce !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(a.nonce)) throw new Error(`${label}.authorization.nonce must be 32 bytes.`);
  return {
    from: getAddress(a.from),
    to: getAddress(a.to),
    value: num("value"),
    validAfter: num("validAfter"),
    validBefore: num("validBefore"),
    nonce: a.nonce as Hex,
  };
}

export async function GET() {
  try {
    const [{ nav, feeShares }, d] = await Promise.all([quote(), domain()]);
    const r = relayer();
    return jsonResponse({
      enabled: Boolean(r),
      fee: {
        usd: RELAY_FEE_USD,
        gblin: formatUnits(feeShares, 18),
        units: feeShares.toString(),
        recipient: FEE_RECIPIENT,
        nav_usd: Number(nav.toFixed(6)),
        tolerance: "A fee down to 95% of this quote is accepted, since the NAV moves between the quote and the signature.",
      },
      eip712_domain: d,
      primary_type: "TransferWithAuthorization",
      how: [
        "Sign two TransferWithAuthorization messages with the payer's wallet, under the domain above: the payment to the payee, and the fee to fee.recipient. Use different nonces.",
        "POST { payment: { authorization, signature }, fee: { authorization, signature } } to this URL.",
        "Both transfers settle in one transaction or neither does. The payer needs no ETH.",
      ],
      tool: "prepare_gblin_payment with relay: true (npm @gblin-protocol/mcp-server) builds both messages.",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 503);
  }
}

export async function POST(req: Request) {
  const r = relayer();
  if (!r) return jsonResponse({ error: "The relay is not configured on this deployment." }, 503);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(ip)) return jsonResponse({ error: "Too many relays from this address; retry in a minute." }, 429);

  let payment: Authorization, fee: Authorization, paymentSig: Hex, feeSig: Hex;
  try {
    const body = (await req.json()) as Record<string, Record<string, unknown>>;
    payment = parseAuthorization(body?.payment?.authorization, "payment");
    fee = parseAuthorization(body?.fee?.authorization, "fee");
    const ps = body?.payment?.signature;
    const fs = body?.fee?.signature;
    if (typeof ps !== "string" || !isHex(ps) || ps.length < 130) throw new Error("payment.signature must be hex.");
    if (typeof fs !== "string" || !isHex(fs) || fs.length < 130) throw new Error("fee.signature must be hex.");
    paymentSig = ps as Hex;
    feeSig = fs as Hex;
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  try {
    // Shape: one payer, the fee to the fee recipient, two distinct nonces.
    if (fee.from !== payment.from) return jsonResponse({ error: "The fee must be paid by the payer of the payment." }, 400);
    if (fee.to !== FEE_RECIPIENT) return jsonResponse({ error: `The fee must be paid to ${FEE_RECIPIENT}.` }, 400);
    if (fee.nonce.toLowerCase() === payment.nonce.toLowerCase()) return jsonResponse({ error: "The two authorizations must use different nonces." }, 400);
    if (payment.value === 0n) return jsonResponse({ error: "The payment value is zero." }, 400);

    const [{ feeShares }, d, block, relayerEth] = await Promise.all([
      quote(),
      domain(),
      client.getBlock(),
      client.getBalance({ address: r.account.address }),
    ]);
    if (relayerEth < MIN_RELAYER_ETH) return jsonResponse({ error: "The relay is out of gas funds; retry later." }, 503);
    const minFee = (feeShares * (10_000n - FEE_TOLERANCE_BPS)) / 10_000n;
    if (fee.value < minFee) {
      return jsonResponse({ error: `The fee is below the current quote: at least ${formatUnits(minFee, 18)} GBLIN.` }, 402);
    }

    // The checks the vault itself makes, before any gas is spent.
    const now = block.timestamp;
    for (const [label, a] of [["payment", payment], ["fee", fee]] as const) {
      if (a.validAfter > now) return jsonResponse({ error: `The ${label} authorization is not valid yet.` }, 400);
      if (a.validBefore <= now + 30n) return jsonResponse({ error: `The ${label} authorization expires too soon.` }, 400);
    }
    const [usedP, usedF, balance] = await Promise.all([
      client.readContract({ address: GBLIN, abi: VAULT_ABI, functionName: "authorizationState", args: [payment.from, payment.nonce] }),
      client.readContract({ address: GBLIN, abi: VAULT_ABI, functionName: "authorizationState", args: [fee.from, fee.nonce] }),
      client.readContract({ address: GBLIN, abi: VAULT_ABI, functionName: "balanceOf", args: [payment.from] }),
    ]);
    if (usedP || usedF) return jsonResponse({ error: "A nonce has already been used or cancelled." }, 409);
    if (balance < payment.value + fee.value) {
      return jsonResponse({ error: `The payer holds ${formatUnits(balance, 18)} GBLIN, less than the payment plus the fee.` }, 400);
    }
    for (const [label, a, sig] of [["payment", payment, paymentSig], ["fee", fee, feeSig]] as const) {
      const ok = await client.verifyTypedData({
        address: a.from,
        domain: d,
        types: TYPES,
        primaryType: "TransferWithAuthorization",
        message: { ...a },
        signature: sig,
      });
      if (!ok) return jsonResponse({ error: `The ${label} signature is not the payer's.` }, 400);
    }

    // Both transfers in one transaction: all or nothing.
    const call = (a: Authorization, sig: Hex) =>
      encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "transferWithAuthorization",
        args: [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, sig],
      });
    const data = encodeFunctionData({
      abi: MULTICALL3_ABI,
      functionName: "aggregate3",
      args: [[
        { target: GBLIN, allowFailure: false, callData: call(payment, paymentSig) },
        { target: GBLIN, allowFailure: false, callData: call(fee, feeSig) },
      ]],
    });
    try {
      await client.call({ account: r.account.address, to: MULTICALL3, data, gas: RELAY_GAS_LIMIT });
    } catch (err) {
      return jsonResponse({ error: `The transfers would not settle: ${(err as Error).message.split("\n")[0]}` }, 400);
    }

    const hash = await r.wallet.sendTransaction({ to: MULTICALL3, data, gas: RELAY_GAS_LIMIT, chain: base });
    const receipt = await waitForReceipt(hash, 30_000);
    return jsonResponse(
      {
        status: receipt ? (receipt.status === "success" ? "settled" : "reverted") : "submitted",
        transaction: hash,
        explorer: `https://basescan.org/tx/${hash}`,
        payment: { from: payment.from, to: payment.to, gblin: formatUnits(payment.value, 18) },
        fee: { to: fee.to, gblin: formatUnits(fee.value, 18) },
        ...(receipt ? { block: Number(receipt.blockNumber) } : { note: "Submitted; not yet in a block. Follow it with the hash." }),
      },
      receipt && receipt.status !== "success" ? 502 : 200
    );
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
}
