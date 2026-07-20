"use client";

import { useEffect, useState } from "react";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getBalance,
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { base } from "wagmi/chains";
import { parseAbi } from "viem";
import { wagmiConfig } from "@/lib/wagmi";

// GBLIN V5 (vecchio, in produzione) e V6 (nuovo)
const V5_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345" as const;
const V6_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0" as const;

// Cuscinetto ETH lasciato per il gas della seconda transazione (0.00003 ETH)
const GAS_BUFFER = 30000000000000n;

const V5_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
]);
const V6_ABI = parseAbi(["function buyGBLIN(uint256 minGblinOut) payable"]);

/**
 * Banner "Migrate to V6" — appare SOLO se il wallet collegato detiene GBLIN V5.
 * Se il saldo V5 è 0 (quasi tutti), il componente non renderizza nulla.
 *
 * Single wallet stack: usa wagmi (stesso config condiviso della pagina e del
 * widget LI.FI). Nessuna dipendenza thirdweb. Il componente si porta il suo
 * WagmiProvider (stesso singleton -> stato condiviso) così funziona anche
 * dove la pagina non è già wrappata (es. /buy-gblin).
 *
 * Migrazione = 2 transazioni: sellGBLINForEth sul V5 -> buyGBLIN sul V6.
 * Azione secondaria: vendi tutto il V5 in ETH senza ricomprare.
 */
function MigrateBanner() {
  const { address } = useAccount();
  const [label, setLabel] = useState("Migrate to V6");
  const [busy, setBusy] = useState(false);
  // null = ancora sconosciuto; 0n = nessun V5 -> il banner si nasconde
  const [v5Bal, setV5Bal] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!address) { setV5Bal(null); return; }
    (async () => {
      try {
        const bal = await readContract(wagmiConfig, {
          address: V5_ADDRESS, abi: V5_ABI, functionName: "balanceOf",
          args: [address], chainId: base.id,
        });
        if (!cancelled) setV5Bal(bal);
      } catch { if (!cancelled) setV5Bal(null); }
    })();
    return () => { cancelled = true; };
  }, [address]);

  async function ensureBase() {
    try { await switchChain(wagmiConfig, { chainId: base.id }); } catch { /* già su Base */ }
  }

  async function readV5Balance(addr: `0x${string}`) {
    return readContract(wagmiConfig, {
      address: V5_ADDRESS, abi: V5_ABI, functionName: "balanceOf",
      args: [addr], chainId: base.id,
    });
  }

  async function migrate() {
    if (!address) { alert("Connect your wallet first."); return; }
    setBusy(true);
    try {
      await ensureBase();
      const v5Balance = await readV5Balance(address);
      if (v5Balance === 0n) {
        alert("You have no V5 GBLIN to migrate.");
        setLabel("Migrate to V6"); setBusy(false); return;
      }

      const balBefore = (await getBalance(wagmiConfig, { address, chainId: base.id })).value;

      setLabel("1/2 Redeeming V5…");
      const sellHash = await writeContract(wagmiConfig, {
        address: V5_ADDRESS, abi: V5_ABI, functionName: "sellGBLINForEth",
        args: [v5Balance, 0n], chainId: base.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: sellHash, chainId: base.id });

      const balAfter = (await getBalance(wagmiConfig, { address, chainId: base.id })).value;
      const received = balAfter > balBefore ? balAfter - balBefore : 0n;
      const valueIn = received > GAS_BUFFER ? received - GAS_BUFFER : 0n;
      if (valueIn <= 0n) {
        alert("The ETH received is too low to complete the V6 purchase.");
        setLabel("Migrate to V6"); setBusy(false); return;
      }

      setLabel("2/2 Buying V6…");
      const buyHash = await writeContract(wagmiConfig, {
        address: V6_ADDRESS, abi: V6_ABI, functionName: "buyGBLIN",
        args: [0n], value: valueIn, chainId: base.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: buyHash, chainId: base.id });

      setLabel("✅ Migrated!");
      setV5Bal(0n);
      setTimeout(() => setLabel("Migrate to V6"), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/user rejected|user denied|4001/i.test(msg)) {
        alert("Migration error: " + msg.split("\n")[0]);
      }
      setLabel("Migrate to V6");
    } finally {
      setBusy(false);
    }
  }

  async function sellV5Only() {
    if (!address) { alert("Connect your wallet first."); return; }
    setBusy(true);
    try {
      await ensureBase();
      const v5Balance = await readV5Balance(address);
      if (v5Balance === 0n) { alert("You have no V5 GBLIN to sell."); setBusy(false); return; }
      const hash = await writeContract(wagmiConfig, {
        address: V5_ADDRESS, abi: V5_ABI, functionName: "sellGBLINForEth",
        args: [v5Balance, 0n], chainId: base.id,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: base.id });
      setV5Bal(0n);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/user rejected|user denied|4001/i.test(msg)) {
        alert("V5 sell error: " + msg.split("\n")[0]);
      }
    } finally {
      setBusy(false);
    }
  }

  // Nasconde tutto se non c'è un saldo V5 da migrare.
  if (!address || v5Bal === null || v5Bal === 0n) return null;

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-indigo-100">
        You still hold GBLIN&nbsp;V5. Migrate to V6 in one flow — 2 transactions, no extra contract.
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={migrate}
          disabled={busy}
          title="Redeem your V5 GBLIN and re-buy V6 (2 transactions)"
          className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] transition border border-indigo-400/50 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
        >
          {label}
        </button>
        <button
          type="button"
          onClick={sellV5Only}
          disabled={busy}
          title="Sell all your V5 GBLIN for ETH (1 transaction), without re-buying"
          className="text-xs text-indigo-300/80 underline decoration-indigo-500/40 underline-offset-4 transition hover:text-indigo-200 disabled:opacity-50"
        >
          Or sell V5 for ETH
        </button>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

export default function MigrateButton() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MigrateBanner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
