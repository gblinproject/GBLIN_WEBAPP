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
import { useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { BUILDER_CODE_SUFFIX } from './builder-code';

export interface PreparedCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export function prepareContractCall(options: {
  contract: { address: `0x${string}` };
  method: string;
  params?: readonly unknown[];
  value?: bigint;
}): PreparedCall {
  const item = parseAbiItem(options.method) as AbiFunction;
  return {
    address: options.contract.address,
    abi: [item] as Abi,
    functionName: item.name,
    args: options.params,
    value: options.value,
  };
}

export function useSendTransaction() {
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

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
        const transactionHash = await writeContractAsync({
          address: tx.address,
          abi: tx.abi,
          functionName: tx.functionName,
          args: tx.args as never,
          value: tx.value,
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
