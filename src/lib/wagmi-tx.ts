'use client';

/**
 * Thirdweb-compatible transaction helpers built on wagmi/viem.
 *
 * Drop-in replacements for the two thirdweb APIs the protocol pages used
 * (`prepareContractCall` + `useSendTransaction`), so the call sites keep the
 * exact same shape while the heavy thirdweb bundle goes away. Signing goes
 * through the shared wagmi config (same wallet session as /account and the
 * LI.FI widget). Writes are forced onto Base: the hook switches chain first,
 * matching thirdweb's implicit auto-switch behaviour.
 */

import { parseAbiItem, type Abi, type AbiFunction } from 'viem';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { BUILDER_CODE_SUFFIX } from './builder-code';

export interface PreparedCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  /** Explicit gas limit, for calls whose estimate sits on a gas-reserve edge. */
  gas?: bigint;
}

export function prepareContractCall(options: {
  contract: { address: `0x${string}` };
  method: string;
  params?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
}): PreparedCall {
  const item = parseAbiItem(options.method) as AbiFunction;
  return {
    address: options.contract.address,
    abi: [item] as Abi,
    functionName: item.name,
    args: options.params,
    value: options.value,
    gas: options.gas,
  };
}

export function useSendTransaction() {
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  // The sender is named explicitly. Without it the wallet client falls back to whatever account the
  // connector session holds, and a wallet with more than one session (extension and SDK) can then
  // estimate gas for an account other than the one shown on the page, and report it has no ETH.
  const { address, connector } = useAccount();

  const mutate = (
    tx: PreparedCall,
    callbacks?: {
      onSuccess?: (data: { transactionHash: `0x${string}` }) => void;
      onError?: (error: Error) => void;
    },
  ) => {
    void (async () => {
      try {
        try {
          await switchChainAsync({ chainId: base.id });
        } catch {
          // already on Base, or the wallet handled/refused the switch — the
          // write below will surface any real chain problem to onError.
        }
        if (!address) throw new Error('Wallet not connected.');
        const transactionHash = await writeContractAsync({
          account: address,
          ...(connector ? { connector } : {}),
          address: tx.address,
          abi: tx.abi,
          functionName: tx.functionName,
          args: tx.args as never,
          value: tx.value,
          ...(tx.gas ? { gas: tx.gas } : {}),
          chainId: base.id,
          // ERC-8021: attribute this transaction to the GBLIN app on Base.
          dataSuffix: BUILDER_CODE_SUFFIX,
        });
        callbacks?.onSuccess?.({ transactionHash });
      } catch (error) {
        callbacks?.onError?.(error as Error);
      }
    })();
  };

  return { mutate };
}
