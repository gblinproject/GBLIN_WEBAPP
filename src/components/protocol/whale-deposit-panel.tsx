'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { ArrowRight, Check, ExternalLink, RefreshCw, Shield } from 'lucide-react';
import { prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { useSendTransaction } from 'thirdweb/react';
import { thirdwebClient } from '@/lib/thirdweb';
import { CONTRACT_ADDRESS, RPC_URL, WETH_ADDRESS, USDC_ADDRESS, formatTokenAmount, shortenAddress } from './protocol-data';

// GBLIN V6 in-kind = deposit a SINGLE basket asset and mint GBLIN at NAV (no swap, no slippage on the basket).
// Function: buyGBLINInKind(address token, uint256 amountIn, uint256 minGblinOut)
const CBBTC_ADDRESS = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';

// Chainlink feeds used by the V6 contract (asset/USD + ETH/USD), to estimate the GBLIN out exactly like the contract.
const ORACLES = {
  cbBTC: '0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D',
  WETH: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  USDC: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
} as const;

interface BasketAsset {
  symbol: 'cbBTC' | 'WETH' | 'USDC';
  address: string;
  decimals: number;
  oracle: string;
}

const BASKET_ASSETS: readonly BasketAsset[] = [
  { symbol: 'cbBTC', address: CBBTC_ADDRESS, decimals: 8, oracle: ORACLES.cbBTC },
  { symbol: 'WETH', address: WETH_ADDRESS, decimals: 18, oracle: ORACLES.WETH },
  { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6, oracle: ORACLES.USDC },
] as const;

const ERC20_ABI_MIN = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];
const ORACLE_ABI = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
const QUOTE_ABI = ['function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 fFee, uint256 sFee)'];

const SLIPPAGE_BPS = 300n; // 3% buffer su minGblinOut (la NAV può muoversi tra quote e tx)

interface WhaleDepositPanelProps {
  t: (key: string) => string;
  address?: string;
  isConnected: boolean;
  openWallet: () => void;
  onSuccess?: () => void;
}

export function WhaleDepositPanel({ t, address, isConnected, openWallet, onSuccess }: WhaleDepositPanelProps) {
  const [symbol, setSymbol] = useState<BasketAsset['symbol']>('WETH');
  const [amountRaw, setAmountRaw] = useState('');
  const [balance, setBalance] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [gblinOut, setGblinOut] = useState(0n);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const { mutate: sendTx } = useSendTransaction();

  const asset = useMemo(() => BASKET_ASSETS.find((a) => a.symbol === symbol)!, [symbol]);

  const getProvider = useCallback(() => {
    if (!providerRef.current) providerRef.current = new ethers.JsonRpcProvider(RPC_URL);
    return providerRef.current;
  }, []);

  const amountIn = useMemo(() => {
    const raw = amountRaw.replace(',', '.').trim();
    const parsed = Number.parseFloat(raw);
    if (!raw || Number.isNaN(parsed) || parsed <= 0) return 0n;
    try { return ethers.parseUnits(raw, asset.decimals); } catch { return 0n; }
  }, [amountRaw, asset.decimals]);

  // --- live: balance + allowance + estimated GBLIN out --------------------
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const provider = getProvider();
        const erc20 = new ethers.Contract(asset.address, ERC20_ABI_MIN, provider);
        if (address) {
          const [bal, alw] = await Promise.all([
            erc20.balanceOf(address).catch(() => 0n),
            erc20.allowance(address, CONTRACT_ADDRESS).catch(() => 0n),
          ]);
          if (!cancelled) { setBalance(BigInt(bal.toString())); setAllowance(BigInt(alw.toString())); }
        }
        if (amountIn === 0n) { if (!cancelled) setGblinOut(0n); return; }
        setIsQuoting(true);
        // ethValue = _convertToEth(amountIn) usando gli stessi oracoli del contratto
        const aOracle = new ethers.Contract(asset.oracle, ORACLE_ABI, provider);
        const eOracle = new ethers.Contract(ORACLES.WETH, ORACLE_ABI, provider);
        const [aRound, eRound] = await Promise.all([aOracle.latestRoundData(), eOracle.latestRoundData()]);
        const pA = BigInt(aRound[1].toString());
        const pE = BigInt(eRound[1].toString());
        if (pE === 0n) { if (!cancelled) setGblinOut(0n); return; }
        const val = (amountIn * pA) / pE;
        const d = asset.decimals;
        const ethValue = d < 18 ? val * (10n ** BigInt(18 - d)) : val / (10n ** BigInt(d - 18));
        const gblin = new ethers.Contract(CONTRACT_ADDRESS, QUOTE_ABI, provider);
        const q = await gblin.quoteBuyGBLIN(ethValue);
        if (!cancelled) setGblinOut(BigInt(q[0].toString()));
      } catch {
        if (!cancelled) setGblinOut(0n);
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    };
    const timer = window.setTimeout(run, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [amountIn, asset, address, getProvider]);

  const needsApproval = amountIn > 0n && allowance < amountIn;
  const insufficient = amountIn > 0n && balance < amountIn;
  const minGblinOut = (gblinOut * (10000n - SLIPPAGE_BPS)) / 10000n;
  const canSubmit = isConnected && amountIn > 0n && !insufficient && gblinOut > 0n && !isSubmitting && !isQuoting;

  const fmtAsset = useCallback(
    (v: bigint) => formatTokenAmount(Number(ethers.formatUnits(v, asset.decimals)), asset.decimals === 8 ? 8 : asset.decimals === 6 ? 2 : 6),
    [asset.decimals],
  );

  const onMax = useCallback(() => {
    if (balance > 0n) setAmountRaw(ethers.formatUnits(balance, asset.decimals));
  }, [balance, asset.decimals]);

  const executeDeposit = useCallback(async () => {
    if (!isConnected || !address) { openWallet(); return; }
    if (amountIn === 0n || gblinOut === 0n) return;
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const provider = getProvider();
      // 1. approve (se serve)
      if (needsApproval) {
        setSubmitStep(`Approve ${asset.symbol}`);
        const approveTx = prepareContractCall({
          contract: { client: thirdwebClient, chain: base, address: asset.address as `0x${string}` },
          method: 'function approve(address spender, uint256 amount) returns (bool)',
          params: [CONTRACT_ADDRESS as `0x${string}`, amountIn],
        });
        const approvalHash: string = await new Promise((resolve, reject) => {
          sendTx(approveTx, { onSuccess: (d) => resolve(d.transactionHash), onError: (err: Error) => reject(err) });
        });
        await provider.waitForTransaction(approvalHash, 1, 180000);
      }
      // 2. buyGBLINInKind(token, amountIn, minGblinOut)
      setSubmitStep('Deposit');
      const buyTx = prepareContractCall({
        contract: { client: thirdwebClient, chain: base, address: CONTRACT_ADDRESS as `0x${string}` },
        method: 'function buyGBLINInKind(address token, uint256 amountIn, uint256 minGblinOut)',
        params: [asset.address as `0x${string}`, amountIn, minGblinOut],
      });
      const buyHash: string = await new Promise((resolve, reject) => {
        sendTx(buyTx, { onSuccess: (d) => resolve(d.transactionHash), onError: (err: Error) => reject(err) });
      });
      await provider.waitForTransaction(buyHash, 1, 180000);
      setTxHash(buyHash);
      setAmountRaw('');
      setGblinOut(0n);
      if (onSuccess) onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      const lower = msg.toLowerCase();
      if (lower.includes('user rejected') || lower.includes('user denied')) setError('Transaction rejected in wallet.');
      else if (lower.includes('notabasketasset')) setError('This token is not a basket asset.');
      else if (lower.includes('slippage')) setError('Price moved. Try again.');
      else if (lower.includes('insufficient')) setError(`Insufficient ${asset.symbol} balance.`);
      else if (lower.includes('cooldown')) setError('Cooldown active. Wait a moment after the last buy.');
      else if (lower.includes('sequencerdown')) setError('Base sequencer unavailable. Retry shortly.');
      else setError(msg.length > 180 ? `${msg.slice(0, 177)}...` : msg);
    } finally {
      setSubmitStep('');
      setIsSubmitting(false);
    }
  }, [address, amountIn, asset, gblinOut, getProvider, isConnected, minGblinOut, needsApproval, onSuccess, openWallet, sendTx]);

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

      {/* asset selector */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {BASKET_ASSETS.map((a) => (
          <button
            key={a.symbol}
            type="button"
            onClick={() => { setSymbol(a.symbol); setAmountRaw(''); setGblinOut(0n); }}
            className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
              symbol === a.symbol
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20'
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      {/* amount input */}
      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">{t('trade.inkindBalance')}: {isConnected ? fmtAsset(balance) : '—'} {asset.symbol}</span>
        <div className="mt-3 rounded-[24px] border border-amber-500/30 bg-black/30 px-5 py-4 focus-within:border-amber-500/60 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <input
              className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600"
              inputMode="decimal"
              placeholder={`0.00 ${asset.symbol}`}
              type="text"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
            />
            <button type="button" onClick={onMax} className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20">MAX</button>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white">{asset.symbol}</span>
          </div>
        </div>
      </label>

      {/* estimated GBLIN out */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{t('trade.outputAsset') || 'You receive (est.)'}</span>
        <span className="text-base font-semibold tabular-nums text-white">
          {isQuoting ? '…' : `${formatTokenAmount(Number(ethers.formatEther(gblinOut)), 6)} GBLIN`}
        </span>
      </div>

      {insufficient && isConnected ? (
        <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{t('trade.inkindInsufficientWarning') || `Insufficient ${asset.symbol} balance.`}</p>
      ) : null}

      <button
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-5 text-base font-bold uppercase tracking-[0.18em] transition ${
          !canSubmit && isConnected ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
        }`}
        disabled={!canSubmit && isConnected}
        onClick={isConnected ? executeDeposit : openWallet}
        type="button"
      >
        {isSubmitting ? (
          <><RefreshCw className="h-5 w-5 animate-spin" />{submitStep || t('trade.inkindSubmitting')}</>
        ) : !isConnected ? (
          t('trade.connect')
        ) : needsApproval ? (
          <>{t('trade.inkindApproveAndMint') || 'Approve & deposit'}<ArrowRight className="h-5 w-5" /></>
        ) : (
          <>{t('trade.inkindMintBtn')}<ArrowRight className="h-5 w-5" /></>
        )}
      </button>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {txHash ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
          <p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" />{t('trade.success')}</p>
          <a className="mt-2 inline-flex items-center gap-2 text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${txHash}`} rel="noreferrer" target="_blank">
            {shortenAddress(txHash)}<ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
