/**
 * End-to-end test of the GBLIN payment relay (src/app/api/relay/gblin/route.ts) against a fork of Base.
 *
 * Run:  anvil --fork-url <base rpc> --port 8555 --silent &
 *       GBLIN_RPC_URL=http://127.0.0.1:8555 npx tsx test/relay-fork/relay-fork.test.ts
 *
 * The route handlers are called directly with Request objects. The relayer key and the payer are fresh
 * keys made for the run and exist only on the fork. The payer holds shares and no ETH throughout.
 */

import {
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  parseUnits,
  publicActions,
  walletActions,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const RPC = process.env.GBLIN_RPC_URL ?? "http://127.0.0.1:8555";
const VAULT = "0xc2181d975c05c8c724b334bcED0764c0b86B1D53" as const;
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const HOLDER = "0x30590c0D05c26562d7296CE3D927d3418d2e6dcA" as const;

const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)",
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

const test = createTestClient({ chain: base, mode: "anvil", transport: http(RPC) }).extend(publicActions).extend(walletActions);

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok      ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAILED  ${name} ${detail}`);
  }
}

const shares = (a: `0x${string}`) => test.readContract({ address: VAULT, abi: ABI, functionName: "balanceOf", args: [a] }) as Promise<bigint>;
const nonce = () => ("0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("")) as Hex;

async function main(): Promise<void> {
  const relayerKey = generatePrivateKey();
  process.env.RELAYER_PRIVATE_KEY = relayerKey;
  const relayerAddr = privateKeyToAccount(relayerKey).address;
  await test.setBalance({ address: relayerAddr, value: parseUnits("1", 18) });

  const route = await import("../../src/app/api/relay/gblin/route");

  const payerKey = generatePrivateKey();
  const payer = privateKeyToAccount(payerKey);
  const payerWallet = createWalletClient({ account: payer, chain: base, transport: http(RPC) });
  const payee = privateKeyToAccount(generatePrivateKey()).address;
  const stranger = privateKeyToAccount(generatePrivateKey());

  await test.impersonateAccount({ address: HOLDER });
  await test.setBalance({ address: HOLDER, value: parseUnits("1", 18) });
  await test.writeContract({ account: HOLDER, address: VAULT, abi: ABI, functionName: "transfer", args: [payer.address, parseUnits("2", 18)], chain: base });
  check("the payer holds shares and no ETH", (await shares(payer.address)) === parseUnits("2", 18) && (await test.getBalance({ address: payer.address })) === 0n);

  // ── quote ──────────────────────────────────────────────────────────────────
  const q = await (await route.GET()).json();
  check("the quote is enabled and priced", q.enabled === true && BigInt(q.fee.units) > 0n, JSON.stringify(q).slice(0, 200));
  const domain = q.eip712_domain;
  const feeRecipient = q.fee.recipient as `0x${string}`;
  const feeUnits = BigInt(q.fee.units);

  const now = (await test.getBlock()).timestamp;
  async function sign(account: typeof payer, to: `0x${string}`, value: bigint, n = nonce()) {
    const message = { from: payer.address, to, value, validAfter: 0n, validBefore: now + 3600n, nonce: n };
    const w = account === payer ? payerWallet : createWalletClient({ account, chain: base, transport: http(RPC) });
    const signature = await w.signTypedData({ domain, types: TYPES, primaryType: "TransferWithAuthorization", message });
    return {
      authorization: { ...message, value: value.toString(), validAfter: "0", validBefore: (now + 3600n).toString() },
      signature,
      message,
    };
  }
  async function post(body: unknown) {
    const res = await route.POST(new Request("http://localhost/api/relay/gblin", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "10.0.0.1" } }));
    return { status: res.status, body: await res.json() };
  }

  // ── the good path ──────────────────────────────────────────────────────────
  const payment = await sign(payer, payee, parseUnits("0.5", 18));
  const fee = await sign(payer, feeRecipient, feeUnits);
  const feeBefore = await shares(feeRecipient);
  const ok = await post({ payment: { authorization: payment.authorization, signature: payment.signature }, fee: { authorization: fee.authorization, signature: fee.signature } });
  check("the relay settles both transfers", ok.status === 200 && ok.body.status === "settled", JSON.stringify(ok.body).slice(0, 300));
  check("the payee received the payment", (await shares(payee)) === parseUnits("0.5", 18));
  check("the fee recipient received the fee", (await shares(feeRecipient)) - feeBefore === feeUnits);
  check("the payer still has no ETH", (await test.getBalance({ address: payer.address })) === 0n);
  const receipt = await test.getTransactionReceipt({ hash: ok.body.transaction });
  check("both transfers travelled in one transaction", receipt.status === "success" && receipt.to?.toLowerCase() === MULTICALL3.toLowerCase());

  // ── what it refuses ────────────────────────────────────────────────────────
  const replay = await post({ payment: { authorization: payment.authorization, signature: payment.signature }, fee: { authorization: fee.authorization, signature: fee.signature } });
  check("a replay is refused", replay.status === 409, JSON.stringify(replay.body));

  const p2 = await sign(payer, payee, parseUnits("0.1", 18));
  const cheap = await sign(payer, feeRecipient, feeUnits / 2n);
  const low = await post({ payment: { authorization: p2.authorization, signature: p2.signature }, fee: { authorization: cheap.authorization, signature: cheap.signature } });
  check("a fee below the quote is refused", low.status === 402, JSON.stringify(low.body));

  const wrongTo = await sign(payer, payee, feeUnits);
  const misrouted = await post({ payment: { authorization: p2.authorization, signature: p2.signature }, fee: { authorization: wrongTo.authorization, signature: wrongTo.signature } });
  check("a fee to someone else is refused", misrouted.status === 400, JSON.stringify(misrouted.body));

  const forged = await sign(stranger as unknown as typeof payer, payee, parseUnits("0.1", 18));
  const goodFee = await sign(payer, feeRecipient, feeUnits);
  const forgery = await post({ payment: { authorization: forged.authorization, signature: forged.signature }, fee: { authorization: goodFee.authorization, signature: goodFee.signature } });
  check("a payment signed by another wallet is refused", forgery.status === 400 && /signature/.test(forgery.body.error), JSON.stringify(forgery.body));

  const huge = await sign(payer, payee, parseUnits("100", 18));
  const tooMuch = await post({ payment: { authorization: huge.authorization, signature: huge.signature }, fee: { authorization: goodFee.authorization, signature: goodFee.signature } });
  check("a payment above the balance is refused", tooMuch.status === 400 && /holds/.test(tooMuch.body.error), JSON.stringify(tooMuch.body));

  // ── atomicity, on chain: a fee that cannot settle stops the payment too ────
  const p3 = await sign(payer, payee, parseUnits("0.1", 18));
  const f3 = await sign(payer, feeRecipient, feeUnits);
  // The fee authorization is used first, directly: its nonce is spent.
  const spend = (a: typeof f3) =>
    encodeFunctionData({
      abi: ABI,
      functionName: "transferWithAuthorization",
      args: [a.message.from, a.message.to, a.message.value, a.message.validAfter, a.message.validBefore, a.message.nonce, a.signature],
    });
  await test.sendTransaction({ account: HOLDER, to: VAULT, data: spend(f3), chain: base });
  const payeeBefore = await shares(payee);
  let reverted = false;
  try {
    await test.sendTransaction({
      account: HOLDER,
      to: MULTICALL3,
      gas: 400_000n,
      chain: base,
      data: encodeFunctionData({
        abi: ABI,
        functionName: "aggregate3",
        args: [[
          { target: VAULT, allowFailure: false, callData: spend(p3) },
          { target: VAULT, allowFailure: false, callData: spend(f3) },
        ]],
      }),
    }).then((h) => test.waitForTransactionReceipt({ hash: h })).then((r) => { reverted = r.status !== "success"; });
  } catch {
    reverted = true;
  }
  check("with the fee already spent, the batch reverts", reverted);
  check("and the payment did not move", (await shares(payee)) === payeeBefore);

  // ── not configured ─────────────────────────────────────────────────────────
  process.env.RELAYER_PRIVATE_KEY = "";
  const off = await post({ payment: { authorization: p3.authorization, signature: p3.signature }, fee: { authorization: f3.authorization, signature: f3.signature } });
  check("without a relayer key it answers 503 and moves nothing", off.status === 503);

  console.log(`\n=== ${passed} checks passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.log("failed:", failures.join(" · "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("error:", err);
  process.exit(1);
});
