'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { ArrowRight, Check, ExternalLink, RefreshCw, Shield } from 'lucide-react';
import { prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { useSendTransaction } from 'thirdweb/react';
import { thirdwebClient } from '@/lib/thirdweb';
import { CONTRACT_ADDRESS, GBLIN_ABI, RPC_URL, WETH_ADDRESS, USDC_ADDRESS, formatTokenAmount, shortenAddress } from './protocol-data';

// Basket order on GBLIN_V5: index 0 = cbBTC, 1 = WETH, 2 = USDC
const CBBTC_ADDRESS = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';

interface BasketAsset {
  symbol: 'cbBTC' | 'WETH' | 'USDC';
  address: string;
  decimals: number;
  basketIndex: 0 | 1 | 2;
}

const BASKET_ASSETS: readonly BasketAsset[] = [
  { symbol: 'cbBTC', address: CBBTC_ADDRESS, decimals: 8, basketIndex: 0 },
  { symbol: 'WETH', address: WETH_ADDRESS, decimals: 18, basketIndex: 1 },
  { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6, basketIndex: 2 },
] as const;

const ERC20_ABI_MIN = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

interface AssetRow {
  symbol: BasketAsset['symbol'];
  address: string;
  decimals: number;
  required: bigint;
  balance: bigint;
  allowance: bigint;
}

interface WhaleDepositPanelProps {
  t: (key: string) => string;
  address?: string;
  isConnected: boolean;
  openWallet: () => void;
  onSuccess?: () => void;
}

export function WhaleDepositPanel({ t, address, isConnected, openWallet, onSuccess }: WhaleDepositPanelProps) {
  const [targetRaw, setTargetRaw] = useState('');
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const { mutate: sendTx } = useSendTransaction();

  const getProvider = useCallback(() => {
    if (!providerRef.current) providerRef.current = new ethers.JsonRpcProvider(RPC_URL);
    return providerRef.current;
  }, []);

  // --- live quote + balance + allowance fetch -----------------------------
  useEffect(() => {
    const raw = targetRaw.replace(',', '.').trim();
    const parsed = Number.parseFloat(raw);
    if (!raw || Number.isNaN(parsed) || parsed <= 0) {
      setRows([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsQuoting(true);
    setError(null);

    const run = async () => {
      try {
        const provider = getProvider();
        const gblin = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
        const target = ethers.parseEther(raw);
        const required: bigint[] = await gblin.quoteMintInKind(target);

        const next: AssetRow[] = await Promise.all(
          BASKET_ASSETS.map(async (asset, i) => {
            const erc20 = new ethers.Contract(asset.address, ERC20_ABI_MIN, provider);
            let balance = 0n;
            let allowance = 0n;
            if (address) {
              const [bal, alw] = await Promise.all([
                erc20.balanceOf(address).catch(() => 0n),
                erc20.allowance(address, CONTRACT_ADDRESS).catch(() => 0n),
              ]);
              balance = BigInt(bal.toString());
              allowance = BigInt(alw.toString());
            }
            return {
              symbol: asset.symbol,
              address: asset.address,
              decimals: asset.decimals,
              required: BigInt(required[i]?.toString() ?? '0'),
              balance,
              allowance,
            };
          })
        );

        if (!cancelled) setRows(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message.slice(0, 160) : 'Quote failed');
          setRows([]);
        }
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    };

    const timer = window.setTimeout(run, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [targetRaw, address, getProvider]);

  const hasInsufficientBalance = useMemo(() => rows.some((r) => r.balance < r.required), [rows]);
  const assetsNeedingApproval = useMemo(() => rows.filter((r) => r.required > 0n && r.allowance < r.required), [rows]);
  const canSubmit = isConnected && rows.length > 0 && !isQuoting && !isSubmitting && !hasInsufficientBalance && !!targetRaw;

  const fmt = useCallback((v: bigint, d: number) => formatTokenAmount(Number(ethers.formatUnits(v, d)), d === 8 ? 8 : d === 6 ? 2 : 6), []);

  const executeDeposit = useCallback(async () => {
    if (!isConnected || !address) {
      openWallet();
      return;
    }
    if (rows.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = getProvider();

      // 1. approvals
      for (const row of assetsNeedingApproval) {
        setSubmitStep(`Approve ${row.symbol}`);
        const approveTx = prepareContractCall({
          contract: { client: thirdwebClient, chain: base, address: row.address as `0x${string}` },
          method: 'function approve(address spender, uint256 amount) returns (bool)',
          params: [CONTRACT_ADDRESS as `0x${string}`, row.required],
        });
        const approvalHash: string = await new Promise((resolve, reject) => {
          sendTx(approveTx, {
            onSuccess: (d) => resolve(d.transactionHash),
            onError: (err: Error) => reject(err),
          });
        });
        await provider.waitForTransaction(approvalHash, 1, 180000);
      }

      // 2. mintInKind
      setSubmitStep('Mint');
      const target = ethers.parseEther(targetRaw.replace(',', '.'));
      const mintTx = prepareContractCall({
        contract: { client: thirdwebClient, chain: base, address: CONTRACT_ADDRESS as `0x${string}` },
        method: 'function mintInKind(uint256 gblinTarget)',
        params: [target],
      });
      const mintHash: string = await new Promise((resolve, reject) => {
        sendTx(mintTx, {
          onSuccess: (d) => resolve(d.transactionHash),
          onError: (err: Error) => reject(err),
        });
      });
      await provider.waitForTransaction(mintHash, 1, 180000);
      setTxHash(mintHash);
      setTargetRaw('');
      setRows([]);
      if (onSuccess) onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      const lower = msg.toLowerCase();
      if (lower.includes('user rejected') || lower.includes('user denied')) setError('Transaction rejected in wallet.');
      else if (lower.includes('insufficient')) setError('Insufficient balance for one of the basket assets.');
      else if (lower.includes('cooldown')) setError('Cooldown active. Wait 2 minutes after the last deposit.');
      else if (lower.includes('sequencerdown')) setError('Base sequencer unavailable. Retry shortly.');
      else setError(msg.length > 180 ? `${msg.slice(0, 177)}...` : msg);
    } finally {
      setSubmitStep('');
      setIsSubmitting(false);
    }
  }, [address, assetsNeedingApproval, getProvider, isConnected, onSuccess, openWallet, rows.length, sendTx, targetRaw]);

  return (
    <div className="rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-black/40 p-7 sm:p-8">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300/80">{t('trade.inkindBadge')}</p>
          <h3 className="mt-1 font-serif text-2xl tracking-tight text-white sm:text-3xl">{t('trade.inkindTitle')}</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{t('trade.inkindDesc')}</p>
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">{t('trade.inkindTargetLabel')}</span>
        <div className="mt-3 rounded-[24px] border border-amber-500/30 bg-black/30 px-5 py-4 focus-within:border-amber-500/60 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <input
              className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600"
              inputMode="decimal"
              placeholder="0.0000 GBLIN"
              type="text"
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
            />
            <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300">GBLIN</span>
          </div>
        </div>
      </label>

      <div className="mt-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{t('trade.inkindRequiredAssets')}</p>
        <div className="space-y-2.5">
          {BASKET_ASSETS.map((asset) => {
            const row = rows.find((r) => r.symbol === asset.symbol);
            const required = row?.required ?? 0n;
            const balance = row?.balance ?? 0n;
            const insufficient = row ? balance < required : false;
            const needsApproval = row ? required > 0n && row.allowance < required : false;
            return (
              <div
                key={asset.symbol}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition ${
                  insufficient ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/10 bg-black/20'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-bold text-white">
                    {asset.symbol.slice(0, 3)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{asset.symbol}</p>
                    <p className="text-[11px] text-zinc-500">{t('trade.inkindBalance')}: {isConnected ? fmt(balance, asset.decimals) : '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-semibold tabular-nums ${insufficient ? 'text-rose-300' : 'text-white'}`}>
                    {isQuoting && !row ? '…' : fmt(required, asset.decimals)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                    {needsApproval ? t('trade.inkindNeedsApproval') : insufficient ? t('trade.inkindInsufficient') : t('trade.inkindReady')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasInsufficientBalance && isConnected ? (
        <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {t('trade.inkindInsufficientWarning')}
        </p>
      ) : null}

      <button
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-5 text-base font-bold uppercase tracking-[0.18em] transition ${
          !canSubmit
            ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
            : 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
        }`}
        disabled={!canSubmit && isConnected}
        onClick={isConnected ? executeDeposit : openWallet}
        type="button"
      >
        {isSubmitting ? (
          <>
            <RefreshCw className="h-5 w-5 animate-spin" />
            {submitStep || t('trade.inkindSubmitting')}
          </>
        ) : !isConnected ? (
          t('trade.connect')
        ) : assetsNeedingApproval.length > 0 ? (
          <>
            {t('trade.inkindApproveAndMint')} ({assetsNeedingApproval.length})
            <ArrowRight className="h-5 w-5" />
          </>
        ) : (
          <>
            {t('trade.inkindMintBtn')}
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {txHash ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
          <p className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4" />
            {t('trade.success')}
          </p>
          <a
            className="mt-2 inline-flex items-center gap-2 text-emerald-200 hover:text-white"
            href={`https://basescan.org/tx/${txHash}`}
            rel="noreferrer"
            target="_blank"
          >
            {shortenAddress(txHash)}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
