"use client";

import { useEffect, useState } from "react";
import {
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import { getWalletBalance } from "thirdweb/wallets";
import { thirdwebClient, chain as thirdwebChain } from "@/lib/thirdweb";

// GBLIN V5 (vecchio, in produzione) e V6 (nuovo)
const V5_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";
const V6_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0";

// Cuscinetto ETH lasciato per il gas della seconda transazione (0.00003 ETH)
const GAS_BUFFER = 30000000000000n;

/**
 * Banner "Migrate to V6" — appare SOLO se il wallet collegato detiene GBLIN V5.
 * Se il saldo V5 è 0 (quasi tutti), il componente non renderizza nulla:
 * così la toggle-row di trading resta pulita (Buy / Sell / In-Kind).
 *
 * Migrazione = Opzione A in 2 transazioni:
 *   1) sellGBLINForEth sul V5  -> ricevi ETH
 *   2) buyGBLIN sul V6 con l'ETH ricevuto -> ricevi GBLIN V6
 * Azione secondaria: vendi tutto il V5 in ETH (1 transazione), senza ricomprare.
 */
export default function MigrateButton() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const [label, setLabel] = useState("Migrate to V6");
  const [busy, setBusy] = useState(false);
  // null = ancora sconosciuto; 0n = nessun V5 -> il banner si nasconde
  const [v5Bal, setV5Bal] = useState<bigint | null>(null);

  // Legge il saldo V5 al mount / cambio account. Fail-safe: null (nasconde) su errore.
  useEffect(() => {
    let cancelled = false;
    if (!account) {
      setV5Bal(null);
      return;
    }
    (async () => {
      try {
        const v5 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V5_ADDRESS });
        const bal = (await readContract({
          contract: v5,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account.address],
        })) as bigint;
        if (!cancelled) setV5Bal(bal);
      } catch {
        if (!cancelled) setV5Bal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  async function ensureBase() {
    if (activeChain?.id !== thirdwebChain.id) {
      setLabel("Switching to Base…");
      await switchChain(thirdwebChain);
    }
  }

  async function migrate() {
    if (!account) {
      alert("Connect your wallet first.");
      return;
    }
    setBusy(true);
    try {
      // Forza il wallet su Base PRIMA di leggere/inviare: alcune wallet (es. MetaMask)
      // restano su Ethereum e la transazione finirebbe sulla rete sbagliata.
      await ensureBase();

      const v5 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V5_ADDRESS });
      const v6 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V6_ADDRESS });

      // 1) Saldo GBLIN V5
      const v5Balance = (await readContract({
        contract: v5,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      })) as bigint;

      if (v5Balance === 0n) {
        alert("You have no V5 GBLIN to migrate.");
        setLabel("Migrate to V6");
        setBusy(false);
        return;
      }

      // ETH prima del riscatto (per misurare quanto ricevi, al netto del gas)
      const balBefore = (
        await getWalletBalance({ address: account.address, client: thirdwebClient, chain: thirdwebChain })
      ).value;

      // 2) TX 1 — riscatta il GBLIN V5 in ETH
      setLabel("1/2 Redeeming V5…");
      const sellTx = prepareContractCall({
        contract: v5,
        method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
        params: [v5Balance, 0n],
      });
      const r1 = await sendTransaction({ transaction: sellTx, account });
      await waitForReceipt(r1);

      // ETH ricevuto (netto del gas della tx1), meno cuscinetto per il gas della tx2
      const balAfter = (
        await getWalletBalance({ address: account.address, client: thirdwebClient, chain: thirdwebChain })
      ).value;
      const received = balAfter > balBefore ? balAfter - balBefore : 0n;
      const valueIn = received > GAS_BUFFER ? received - GAS_BUFFER : 0n;

      if (valueIn <= 0n) {
        alert("The ETH received is too low to complete the V6 purchase.");
        setLabel("Migrate to V6");
        setBusy(false);
        return;
      }

      // 3) TX 2 — compra GBLIN V6 con l'ETH ricevuto
      setLabel("2/2 Buying V6…");
      const buyTx = prepareContractCall({
        contract: v6,
        method: "function buyGBLIN(uint256 minGblinOut) payable",
        params: [0n],
        value: valueIn,
      });
      const r2 = await sendTransaction({ transaction: buyTx, account });
      await waitForReceipt(r2);

      setLabel("✅ Migrated!");
      setV5Bal(0n);
      setTimeout(() => setLabel("Migrate to V6"), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Migration error: " + msg);
      setLabel("Migrate to V6");
    } finally {
      setBusy(false);
    }
  }

  async function sellV5Only() {
    if (!account) {
      alert("Connect your wallet first.");
      return;
    }
    setBusy(true);
    try {
      await ensureBase();
      const v5 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V5_ADDRESS });
      const v5Balance = (await readContract({
        contract: v5,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      })) as bigint;
      if (v5Balance === 0n) {
        alert("You have no V5 GBLIN to sell.");
        setBusy(false);
        return;
      }
      const sellTx = prepareContractCall({
        contract: v5,
        method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
        params: [v5Balance, 0n],
      });
      const r = await sendTransaction({ transaction: sellTx, account });
      await waitForReceipt(r);
      setV5Bal(0n);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("V5 sell error: " + msg);
    } finally {
      setBusy(false);
    }
  }

  // Nasconde tutto se non c'è un saldo V5 da migrare.
  if (!account || v5Bal === null || v5Bal === 0n) return null;

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
