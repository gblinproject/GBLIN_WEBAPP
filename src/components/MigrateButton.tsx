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
import { getWalletBalance } from "thirdweb/wallets";
import { thirdwebClient, chain as thirdwebChain } from "@/lib/thirdweb";

// GBLIN V5 (vecchio, in produzione) e V6 (nuovo)
const V5_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";
const V6_ADDRESS = "0x36C81d7E1966310F305eA637e761Cf77F90852f0";

// Cuscinetto ETH lasciato per il gas della seconda transazione (0.00003 ETH)
const GAS_BUFFER = 30000000000000n;

/**
 * Pill "Migrate to V6" — Opzione A in 2 transazioni:
 *   1) sellGBLINForEth sul V5  -> ricevi ETH
 *   2) buyGBLIN sul V6 con l'ETH ricevuto -> ricevi GBLIN V6
 * Nessun contratto extra. L'utente firma 2 volte.
 */
export default function MigrateButton() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const [label, setLabel] = useState("Migrate to V6");
  const [busy, setBusy] = useState(false);

  async function migrate() {
    if (!account) {
      alert("Collega prima il wallet.");
      return;
    }
    setBusy(true);
    try {
      // Forza il wallet su Base PRIMA di leggere/inviare: alcune wallet (es. MetaMask)
      // restano su Ethereum e la transazione finirebbe sulla rete sbagliata.
      if (activeChain?.id !== thirdwebChain.id) {
        setLabel("Passo a Base…");
        await switchChain(thirdwebChain);
      }

      const v5 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V5_ADDRESS });
      const v6 = getContract({ client: thirdwebClient, chain: thirdwebChain, address: V6_ADDRESS });

      // 1) Saldo GBLIN V5
      const v5Bal = (await readContract({
        contract: v5,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      })) as bigint;

      if (v5Bal === 0n) {
        alert("Non hai GBLIN V5 da migrare.");
        setLabel("Migrate to V6");
        setBusy(false);
        return;
      }

      // ETH prima del riscatto (per misurare quanto ricevi, al netto del gas)
      const balBefore = (
        await getWalletBalance({ address: account.address, client: thirdwebClient, chain: thirdwebChain })
      ).value;

      // 2) TX 1 — riscatta il GBLIN V5 in ETH
      setLabel("1/2 Riscatto V5…");
      const sellTx = prepareContractCall({
        contract: v5,
        method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
        params: [v5Bal, 0n],
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
        alert("ETH ricevuto troppo basso per completare l'acquisto V6.");
        setLabel("Migrate to V6");
        setBusy(false);
        return;
      }

      // 3) TX 2 — compra GBLIN V6 con l'ETH ricevuto
      setLabel("2/2 Acquisto V6…");
      const buyTx = prepareContractCall({
        contract: v6,
        method: "function buyGBLIN(uint256 minGblinOut) payable",
        params: [0n],
        value: valueIn,
      });
      const r2 = await sendTransaction({ transaction: buyTx, account });
      await waitForReceipt(r2);

      setLabel("✅ Migrato!");
      setTimeout(() => setLabel("Migrate to V6"), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Errore migrazione: " + msg);
      setLabel("Migrate to V6");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={migrate}
      disabled={busy || !account}
      title="Riscatta i tuoi GBLIN V5 e ricompra V6 (2 transazioni)"
      className="rounded-full px-6 py-3.5 sm:px-7 sm:py-4 text-sm sm:text-base font-bold uppercase tracking-[0.16em] transition border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 hover:border-indigo-400/50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
