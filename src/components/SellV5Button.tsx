"use client";

import { useState } from "react";
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
import { thirdwebClient, chain as thirdwebChain } from "@/lib/thirdweb";

// GBLIN V5 (vecchio contratto in produzione)
const V5_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";

/**
 * Pill "Sell all V5" — vende TUTTI i GBLIN V5 dell'utente in cambio di ETH.
 * Una sola transazione: sellGBLINForEth sul contratto V5.
 * Forza il wallet su Base prima di inviare.
 */
export default function SellV5Button() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const [label, setLabel] = useState("Sell all V5");
  const [busy, setBusy] = useState(false);

  async function sellAll() {
    if (!account) {
      alert("Collega prima il wallet.");
      return;
    }
    setBusy(true);
    try {
      // Forza il wallet su Base PRIMA di leggere/inviare.
      if (activeChain?.id !== thirdwebChain.id) {
        setLabel("Passo a Base…");
        await switchChain(thirdwebChain);
      }

      const v5 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V5_ADDRESS });

      // Saldo GBLIN V5
      const v5Bal = (await readContract({
        contract: v5,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      })) as bigint;

      if (v5Bal === 0n) {
        alert("Non hai GBLIN V5 da vendere.");
        setLabel("Sell all V5");
        setBusy(false);
        return;
      }

      // TX — riscatta tutto il GBLIN V5 in ETH
      setLabel("Vendo V5…");
      const sellTx = prepareContractCall({
        contract: v5,
        method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
        params: [v5Bal, 0n],
      });
      const r = await sendTransaction({ transaction: sellTx, account });
      await waitForReceipt(r);

      setLabel("✅ Venduto!");
      setTimeout(() => setLabel("Sell all V5"), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Errore vendita V5: " + msg);
      setLabel("Sell all V5");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sellAll}
      disabled={busy || !account}
      title="Vendi tutti i tuoi GBLIN V5 in cambio di ETH (1 transazione)"
      className="rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-400/50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
