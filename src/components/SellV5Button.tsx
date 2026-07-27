"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { parseAbi } from "viem";

// GBLIN V5 (vecchio contratto in produzione)
const V5_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345" as const;

const V5_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
]);

/**
 * Pill "Sell all V5" — vende TUTTI i GBLIN V5 dell'utente in cambio di ETH.
 * Una sola transazione: sellGBLINForEth sul contratto V5.
 * Forza il wallet su Base prima di inviare. (wagmi, ex thirdweb)
 */
export default function SellV5Button() {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: base.id });
  const [label, setLabel] = useState("Sell all V5");
  const [busy, setBusy] = useState(false);

  async function sellAll() {
    if (!address) {
      alert("Collega prima il wallet.");
      return;
    }
    setBusy(true);
    try {
      // Forza il wallet su Base PRIMA di leggere/inviare.
      if (chainId !== base.id) {
        setLabel("Passo a Base…");
        await switchChainAsync({ chainId: base.id });
      }

      // Saldo GBLIN V5
      const v5Bal = (await publicClient!.readContract({
        address: V5_ADDRESS,
        abi: V5_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      if (v5Bal === 0n) {
        alert("Non hai GBLIN V5 da vendere.");
        setLabel("Sell all V5");
        setBusy(false);
        return;
      }

      // TX — riscatta tutto il GBLIN V5 in ETH
      setLabel("Vendo V5…");
      const hash = await writeContractAsync({
        address: V5_ADDRESS,
        abi: V5_ABI,
        functionName: "sellGBLINForEth",
        args: [v5Bal, 0n],
        chainId: base.id,
      });
      await publicClient!.waitForTransactionReceipt({ hash });

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
      disabled={busy || !address}
      title="Vendi tutti i tuoi GBLIN V5 in cambio di ETH (1 transazione)"
      className="rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:border-rose-400/50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
