/**
 * GBLIN supply, as aggregators (CoinGecko, CoinMarketCap) ask for it: total, circulating, and a
 * disclosure of what is excluded and what the project itself holds.
 *
 * Definitions:
 *  - total supply       = totalSupply() of the token.
 *  - circulating supply = total supply minus shares that can never be redeemed: the launch seed
 *                         held at 0x…dEaD (no key exists for it) and any shares held by the token
 *                         contract itself.
 *  - project holdings   = balances of wallets operated by the project. They are NOT subtracted:
 *                         every GBLIN share, the project's included, was minted against assets at
 *                         net asset value. There is no premine, no team allocation and no vesting.
 *                         They are published so that anyone can see how concentrated the supply is.
 *
 * All balances are read at one block, so the figures add up. A read that fails makes the whole
 * answer fail: a supply of zero would be a claim the endpoint has not measured.
 */

import { type Address, getAddress } from "viem";
import promise from "../../public/promises/P2-honest-counters.json";
import { client, GBLIN } from "./x402-helpers";

export const DEAD: Address = "0x000000000000000000000000000000000000dEaD";

/** Project wallets with a public role on chain, in addition to the list published in promise P2. */
const ROLE_WALLETS: Array<{ address: Address; role: string }> = [
  { address: "0x9FFa542E369C53af62380296092EC669f329a9ee", role: "contract creator and fee recipient" },
  { address: "0x30590c0D05c26562d7296CE3D927d3418d2e6dcA", role: "sequencer sentinel guardian and timelock canceller" },
  { address: "0xa5D195fD3C5B374550fa08714F316657DD5A7a3e", role: "gasless payment relayer" },
  { address: "0x0ebA5d314F4f5Dcb7A094953Fa9311a45172dd1B", role: "x402 service revenue" },
];

function projectWallets(): Array<{ address: Address; role: string }> {
  const out = new Map<string, { address: Address; role: string }>();
  for (const w of ROLE_WALLETS) out.set(w.address.toLowerCase(), { address: getAddress(w.address), role: w.role });
  for (const raw of (promise as { our_wallets?: string[] }).our_wallets ?? []) {
    const key = raw.toLowerCase();
    if (!out.has(key)) out.set(key, { address: getAddress(raw), role: "project-operated wallet (listed in promise P2)" });
  }
  return [...out.values()];
}

const BALANCE_OF = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export interface SupplyReport {
  token: Address;
  block: string;
  decimals: 18;
  total_supply: string;
  circulating_supply: string;
  excluded_from_circulating: {
    locked_seed: { address: Address; balance: string; reason: string };
    held_by_token_contract: { address: Address; balance: string; reason: string };
  };
  project_holdings: {
    included_in_circulating: true;
    total: string;
    share_of_total_pct: number;
    wallets: Array<{ address: Address; role: string; balance: string }>;
  };
  methodology: string;
}

/** 18-decimal integer to a plain decimal string, without rounding. */
export function formatUnits18(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const int = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}

export async function readSupply(): Promise<SupplyReport> {
  const wallets = projectWallets();
  const block = await client.getBlockNumber();
  const holders: Address[] = [DEAD, GBLIN, ...wallets.map((w) => w.address)];
  const [total, balances] = await Promise.all([
    client.readContract({ address: GBLIN, abi: BALANCE_OF, functionName: "totalSupply", blockNumber: block }),
    client.multicall({
      blockNumber: block,
      allowFailure: false,
      contracts: holders.map((h) => ({ address: GBLIN, abi: BALANCE_OF, functionName: "balanceOf" as const, args: [h] as const })),
    }),
  ]);
  const [dead, self, ...projectBalances] = balances as bigint[];
  if (total <= 0n) throw new Error("totalSupply returned zero");

  const circulating = total - dead - self;
  const projectTotal = projectBalances.reduce((a, b) => a + b, 0n);

  return {
    token: GBLIN,
    block: block.toString(),
    decimals: 18,
    total_supply: formatUnits18(total),
    circulating_supply: formatUnits18(circulating),
    excluded_from_circulating: {
      locked_seed: {
        address: DEAD,
        balance: formatUnits18(dead),
        reason: "Launch seed sent to an address with no known key: it can never be redeemed or transferred, so the supply never returns to zero.",
      },
      held_by_token_contract: {
        address: GBLIN,
        balance: formatUnits18(self),
        reason: "Shares held by the token contract itself are not in anyone's hands.",
      },
    },
    project_holdings: {
      included_in_circulating: true,
      total: formatUnits18(projectTotal),
      share_of_total_pct: Number((projectTotal * 1_000_000n) / total) / 10_000,
      wallets: wallets
        .map((w, i) => ({ address: w.address, role: w.role, balance: formatUnits18(projectBalances[i]) }))
        .filter((w) => w.balance !== "0"),
    },
    methodology:
      "Every GBLIN share is minted against assets at net asset value and redeemed for its share of the basket; there is no premine, team allocation or vesting. Circulating supply is the total supply minus shares that can never be redeemed. Project-operated wallets are disclosed and remain in the circulating supply because their shares were paid for at net asset value like anyone else's. All balances are read at the block shown.",
  };
}
