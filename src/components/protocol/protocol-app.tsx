'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';
import { useWriteContract } from 'wagmi';
import { parseAbi } from 'viem';
import { ethers } from 'ethers';
import { translations, type Language } from '@/translations/index';
import { protocolTranslations } from './protocol-translations';
import {
  BASE_CHAIN_ID,
  CONTRACT_ADDRESS,
  GBLIN_ABI,
  LANGUAGES,
  REBALANCE_ASSET_OPTIONS,
  RPC_URL,
  fetchMarketData,
  fetchOnChainData,
  fetchTransactions,
  formatCurrency,
  formatTokenAmount,
  parseUsdText,
  shortenAddress
} from './protocol-data';
import { ProtocolShell } from './protocol-shell';
import {
  BuyView,
  DashboardView,
  HomeView,
  RebalanceView,
  VaultView,
  type ProtocolView,
  type RebalanceCard,
  type RebalanceOpportunity
} from './protocol-sections';

const TRADE_ABI = parseAbi([
  'function buyGBLIN(uint256 minGblinOut) payable',
  'function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)'
]);

const REBALANCE_ABI = parseAbi([
  'function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap)'
]);

interface ProtocolAppProps {
  view: ProtocolView;
}

function isSupportedLanguage(value: string | null): value is Language {
  return LANGUAGES.some((item) => item.code === value);
}

export function ProtocolApp({ view }: ProtocolAppProps) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();

  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [language, setLanguageState] = useState<Language>('en');
  const [logs, setLogs] = useState<string[]>([]);

  const [lastYieldDistribution, setLastYieldDistribution] = useState(0);
  const [basketData, setBasketData] = useState<any[]>([]);
  const [ethBalance, setEthBalance] = useState('0.0000');
  const [gblinBalance, setGblinBalance] = useState('0.0000');

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [quote, setQuote] = useState('0');
  const [usdValue, setUsdValue] = useState('$0.00');
  const [rawQuote, setRawQuote] = useState<bigint>(0n);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [tradeTxHash, setTradeTxHash] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const [isArbitraging, setIsArbitraging] = useState(false);
  const [arbTxHash, setArbTxHash] = useState<string | null>(null);
  const [arbError, setArbError] = useState<string | null>(null);

  const [marketData, setMarketData] = useState<any>(null);
  const [onChainData, setOnChainData] = useState<any>(null);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [isOnChainLoading, setIsOnChainLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);

  const isFetchingRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gblin-language', nextLanguage);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLanguage = window.localStorage.getItem('gblin-language');
    if (isSupportedLanguage(storedLanguage)) {
      setLanguageState(storedLanguage);
      return;
    }
    const browserLanguage = navigator.language.split('-')[0];
    if (isSupportedLanguage(browserLanguage)) {
      setLanguageState(browserLanguage);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const t = useCallback(
    (key: string) => {
      const segments = key.split('.');
      const getValue = (source: any) =>
        segments.reduce<any>((acc, part) => (acc && typeof acc === 'object' && part in acc ? acc[part] : null), source);

      const currentValue = getValue(protocolTranslations[language]) ?? getValue(translations[language]);
      if (typeof currentValue === 'string') return currentValue;

      const fallbackValue = getValue(protocolTranslations.en) ?? getValue(translations.en);
      return typeof fallbackValue === 'string' ? fallbackValue : key;
    },
    [language]
  );

  const refreshMarketData = useCallback(async () => {
    setIsMarketLoading(true);
    try {
      const data = await fetchMarketData();
      setMarketData(data);
      addLog(`Market data updated: $${data.priceUsd.toFixed(4)}`);
    } catch {
      addLog('Failed to fetch market data.');
    } finally {
      setIsMarketLoading(false);
    }
  }, [addLog]);

  const refreshOnChainData = useCallback(async () => {
    setIsOnChainLoading(true);
    try {
      const data = await fetchOnChainData();
      setOnChainData(data);
      setLastYieldDistribution(data.lastYield || 0);
      setBasketData(data.basketData || []);
      addLog(`On-chain metrics sync complete. TVL: ${formatCurrency(data.tvl)}`);
    } catch {
      addLog('On-chain data sync failed.');
    } finally {
      setIsOnChainLoading(false);
    }
  }, [addLog]);

  const refreshTransactions = useCallback(async () => {
    setIsTransactionsLoading(true);
    try {
      const data = await fetchTransactions();
      setTransactions(data || []);
      if (data.length > 0) {
        addLog(`Fetched ${data.length} recent transactions.`);
      }
    } catch {
      addLog('Transaction fetch failed.');
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [addLog]);

  const refreshAllData = useCallback(() => {
    refreshMarketData();
    refreshOnChainData();
    refreshTransactions();
  }, [refreshMarketData, refreshOnChainData, refreshTransactions]);

  const syncWalletBalances = useCallback(async () => {
    if (!isConnected || !address) {
      setEthBalance('0.0000');
      setGblinBalance('0.0000');
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const [ethBal, gblinBal] = await Promise.all([
        provider.getBalance(address),
        new ethers.Contract(CONTRACT_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address)
      ]);

      setEthBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(4));
      setGblinBalance(parseFloat(ethers.formatEther(gblinBal)).toFixed(4));
    } catch {
      addLog('Wallet balance refresh failed.');
    }
  }, [address, addLog, isConnected]);

  useEffect(() => {
    if (isConnected && address) {
      addLog(`Wallet connected: ${shortenAddress(address)}`);
    }
  }, [addLog, address, isConnected]);

  useEffect(() => {
    syncWalletBalances();
  }, [syncWalletBalances]);

  useEffect(() => {
    if (isFetchingRef.current) return;

    const loadAll = async () => {
      isFetchingRef.current = true;
      try {
        await Promise.all([refreshMarketData(), refreshOnChainData(), refreshTransactions()]);
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadAll();
  }, [refreshMarketData, refreshOnChainData, refreshTransactions]);

  useEffect(() => {
    if (!amount || Number.parseFloat(amount) <= 0) {
      setQuote('0');
      setRawQuote(0n);
      setUsdValue('$0.00');
      return;
    }

    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

        if (mode === 'buy') {
          const ethAmount = ethers.parseEther(amount);
          const [result, totalSupplyRaw, contractBalanceRaw] = await Promise.all([
            contract.quoteBuyGBLIN(ethAmount),
            contract.totalSupply(),
            contract.balanceOf(CONTRACT_ADDRESS)
          ]);

          const quotedGblinOut: bigint = result[0];
          const founderFee: bigint = result[1];
          const stabFee: bigint = result[2];
          const totalSupply = BigInt(totalSupplyRaw.toString());
          const contractBalance = BigInt(contractBalanceRaw.toString());
          const activeSupply = totalSupply - contractBalance;
          const netEth = ethAmount - founderFee - stabFee;

          let effectiveGblinOut = quotedGblinOut;

          if (activeSupply > 0n && quotedGblinOut > 0n) {
            const navBefore = (netEth * ethers.WeiPerEther) / quotedGblinOut;
            const tvlBefore = (activeSupply * navBefore) / ethers.WeiPerEther;
            effectiveGblinOut = tvlBefore > 0n ? (netEth * activeSupply) / (tvlBefore + ethAmount) : quotedGblinOut;
          } else if (quotedGblinOut > 1000n) {
            effectiveGblinOut = quotedGblinOut - 1000n;
          }

          setRawQuote(effectiveGblinOut);
          setQuote(parseFloat(ethers.formatEther(effectiveGblinOut)).toFixed(4));
          const ethPrice = marketData?.ethPriceUsd || 3500;
          setUsdValue(formatCurrency(Number.parseFloat(amount) * ethPrice));
        } else {
          const gblinAmount = ethers.parseEther(amount);
          const ethOut: bigint = await contract.quoteSellGBLIN(gblinAmount);
          setRawQuote(ethOut);
          setQuote(parseFloat(ethers.formatEther(ethOut)).toFixed(6));
          const ethPrice = marketData?.ethPriceUsd || 3500;
          setUsdValue(formatCurrency(Number.parseFloat(ethers.formatEther(ethOut)) * ethPrice));
        }
      } catch {
        setQuote('Err');
        setRawQuote(0n);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const timer = window.setTimeout(fetchQuote, 450);
    return () => window.clearTimeout(timer);
  }, [amount, marketData, mode]);

  const discountPercentage = useMemo(() => {
    if (!marketData?.priceUsd || !onChainData?.nav) return 0;
    const nav = parseUsdText(onChainData.nav);
    if (!nav) return 0;
    const discount = (1 - marketData.priceUsd / nav) * 100;
    return Math.max(-100, Math.min(100, discount));
  }, [marketData, onChainData]);

  const rebalanceAssetStats = useMemo(() => {
    const totalTvlUsd = basketData.reduce((sum: number, asset: any) => sum + (Number(asset.tvl) || 0), 0);
    const wethAsset = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const wethBalance = wethAsset ? Number(wethAsset.balance) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);

    return REBALANCE_ASSET_OPTIONS.map((option) => {
      const metrics = basketData.find((asset: any) => asset.name === option.name) ?? null;
      const actualWeight = metrics ? Number(metrics.realWeight) : null;
      const dynamicWeight = metrics ? Number(metrics.dynamicWeight) / 100 : null;
      const baseWeight = metrics ? Number(metrics.baseWeight) / 100 : null;
      const assetPrice = metrics ? Number(metrics.price) : 0;
      const currentUsdValue = metrics ? Number(metrics.tvl) : 0;
      const targetUsdValue = metrics ? (totalTvlUsd * Number(metrics.dynamicWeight)) / 10000 : 0;
      const deltaUsd = metrics ? targetUsdValue - currentUsdValue : 0;
      const weightGap = actualWeight !== null && dynamicWeight !== null ? dynamicWeight - actualWeight : null;

      let recommendation: RebalanceOpportunity['recommendation'] | 'balanced' | 'unknown' = 'unknown';
      if (weightGap !== null && weightGap > 0.01) recommendation = 'weth-to-asset';
      else if (weightGap !== null && weightGap < -0.01) recommendation = 'asset-to-weth';
      else if (weightGap !== null) recommendation = 'balanced';

      const targetEthAmount = assetPrice > 0 ? Math.abs(deltaUsd) / assetPrice : 0;
      const executableInputAmount = recommendation === 'weth-to-asset' ? Math.min(targetEthAmount, availableWeth) : targetEthAmount;
      const inputSymbol = recommendation === 'weth-to-asset' ? 'WETH' : option.name;
      const decimals = recommendation === 'weth-to-asset' ? 18 : option.decimals;
      const amountToSwap = executableInputAmount > 0 ? ethers.parseUnits(executableInputAmount.toFixed(Math.min(decimals, 8)), decimals) : 0n;
      const eligible = executableInputAmount >= minSwapRequiredEth;

      return {
        name: option.name,
        basketIndex: option.basketIndex,
        actualWeight,
        dynamicWeight,
        baseWeight,
        recommendation,
        inputSymbol,
        inputAmountText: formatTokenAmount(executableInputAmount, 6),
        amountToSwap,
        targetEthAmount,
        executableInputAmount,
        eligible,
        minSwapRequiredEth
      } satisfies RebalanceOpportunity;
    });
  }, [basketData, onChainData]);

  const autoRebalanceOpportunity = useMemo<RebalanceOpportunity | null>(() => {
    const ranked = [...rebalanceAssetStats]
      .filter((asset) => asset.recommendation !== 'unknown')
      .sort((a, b) => b.targetEthAmount - a.targetEthAmount);
    return ranked.find((asset) => asset.eligible) ?? ranked[0] ?? null;
  }, [rebalanceAssetStats]);

  const rebalanceBountyActive = (onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0) >= 0.0001;
  const rebalanceMinSwapRequiredEth = autoRebalanceOpportunity?.minSwapRequiredEth ?? 0.01;

  useEffect(() => {
    setArbError(null);
  }, [autoRebalanceOpportunity?.eligible, autoRebalanceOpportunity?.inputAmountText, autoRebalanceOpportunity?.name, autoRebalanceOpportunity?.recommendation]);

  const rebalanceOverviewCards = useMemo<RebalanceCard[]>(() => {
    const executableCards = rebalanceAssetStats.map((asset) => {
      const recommendationText =
        asset.recommendation === 'weth-to-asset'
          ? t('rebalance.recommendationUnderweight')
          : asset.recommendation === 'asset-to-weth'
            ? t('rebalance.recommendationOverweight')
            : asset.recommendation === 'balanced'
              ? t('rebalance.recommendationBalanced')
              : t('rebalance.recommendationLoading');

      const recommendationTone =
        asset.recommendation === 'weth-to-asset'
          ? 'text-emerald-400'
          : asset.recommendation === 'asset-to-weth'
            ? 'text-amber-400'
            : 'text-zinc-500';

      const recommendationDot =
        asset.recommendation === 'weth-to-asset'
          ? 'bg-emerald-500'
          : asset.recommendation === 'asset-to-weth'
            ? 'bg-amber-500'
            : 'bg-zinc-600';

      return {
        name: asset.name,
        actualWeight: asset.actualWeight,
        dynamicWeight: asset.dynamicWeight,
        baseWeight: asset.baseWeight,
        directionLabel:
          asset.recommendation === 'weth-to-asset'
            ? t('rebalance.directionToAsset')
            : asset.recommendation === 'asset-to-weth'
              ? t('rebalance.directionToWeth')
              : '---',
        amountLabel: t('rebalance.amount'),
        amountValue: `${asset.inputAmountText} ${asset.inputSymbol}`,
        minFloorLabel: t('rebalance.minFloor'),
        minFloorValue: `${formatTokenAmount(asset.minSwapRequiredEth, 4)} WETH`,
        recommendationText,
        recommendationTone,
        recommendationDot,
        containerClass: autoRebalanceOpportunity?.name === asset.name ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.03]'
      };
    });

    const wethMetrics = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const wethBalance = wethMetrics ? Number(wethMetrics.balance) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);

    const wethCard: RebalanceCard = {
      name: 'WETH',
      actualWeight: wethMetrics ? Number(wethMetrics.realWeight) : null,
      dynamicWeight: wethMetrics ? Number(wethMetrics.dynamicWeight) / 100 : null,
      baseWeight: wethMetrics ? Number(wethMetrics.baseWeight) / 100 : null,
      directionLabel: t('rebalance.directionCounterparty'),
      amountLabel: t('rebalance.amountAvailable'),
      amountValue: `${formatTokenAmount(availableWeth, 6)} WETH`,
      minFloorLabel: t('rebalance.minFloor'),
      minFloorValue: `${formatTokenAmount(minSwapRequiredEth, 4)} WETH`,
      recommendationText: t('rebalance.recommendationCounterparty'),
      recommendationTone: 'text-sky-400',
      recommendationDot: 'bg-sky-500',
      containerClass: 'border-sky-500/20 bg-sky-500/[0.04]'
    };

    const cards: RebalanceCard[] = [];
    const cbBtcCard = executableCards.find((asset) => asset.name === 'cbBTC');
    const usdcCard = executableCards.find((asset) => asset.name === 'USDC');
    if (cbBtcCard) cards.push(cbBtcCard);
    cards.push(wethCard);
    if (usdcCard) cards.push(usdcCard);
    return cards;
  }, [autoRebalanceOpportunity?.name, basketData, onChainData, rebalanceAssetStats, t]);

  const copyContract = useCallback(async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, []);

  const executeTrade = useCallback(async () => {
    if (!isConnected || !address) {
      open();
      return;
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      setTradeError('Enter a valid amount.');
      return;
    }

    if (rawQuote <= 0n) {
      setTradeError('Quote not ready. Wait a moment and retry.');
      return;
    }

    const slippageBps = BigInt(Math.round(slippage * 100));
    const minAmountOut = (rawQuote * (10000n - slippageBps)) / 10000n;

    setIsTransacting(true);
    setTradeError(null);
    setTradeTxHash(null);

    try {
      let hash: `0x${string}`;

      if (mode === 'buy') {
        const ethAmount = ethers.parseEther(amount);
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: TRADE_ABI,
          functionName: 'buyGBLIN',
          args: [minAmountOut],
          value: ethAmount,
          chainId: BASE_CHAIN_ID
        });
      } else {
        const gblinAmount = ethers.parseEther(amount);
        hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: TRADE_ABI,
          functionName: 'sellGBLINForEth',
          args: [gblinAmount, minAmountOut],
          chainId: BASE_CHAIN_ID
        });
      }

      setTradeTxHash(hash);
      addLog(`Transaction sent: ${shortenAddress(hash)}`);

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      await provider.waitForTransaction(hash, 1, 120000);
      await Promise.all([syncWalletBalances(), refreshOnChainData(), refreshTransactions()]);
      setAmount('');
      addLog(`Transaction confirmed: ${shortenAddress(hash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed.';
      const normalizedMessage = message.toLowerCase();

      if (normalizedMessage.includes('user rejected') || normalizedMessage.includes('user denied')) {
        setTradeError('Transaction rejected in wallet.');
      } else if (normalizedMessage.includes('insufficient funds')) {
        setTradeError('Insufficient ETH for value plus gas.');
      } else if (normalizedMessage.includes('deposittoosmall')) {
        setTradeError('Deposit too small. Minimum is 0.0005 ETH.');
      } else if (normalizedMessage.includes('cooldownactive')) {
        setTradeError('Cooldown active. Wait 2 minutes after the last deposit.');
      } else if (normalizedMessage.includes('slippageexceeded')) {
        setTradeError('Slippage exceeded. Try a higher slippage setting.');
      } else {
        setTradeError(message.length > 180 ? `${message.slice(0, 177)}...` : message);
      }
    } finally {
      setIsTransacting(false);
    }
  }, [address, addLog, amount, isConnected, mode, open, rawQuote, refreshOnChainData, refreshTransactions, slippage, syncWalletBalances, writeContractAsync]);

  const executeArbitrage = useCallback(async () => {
    if (!isConnected || !address) {
      open();
      return;
    }

    if (!autoRebalanceOpportunity || !autoRebalanceOpportunity.eligible || autoRebalanceOpportunity.amountToSwap <= 0n) {
      setArbError(t('rebalance.errorNoOpportunity'));
      return;
    }

    setIsArbitraging(true);
    setArbError(null);
    setArbTxHash(null);

    try {
      const isWethToAsset = autoRebalanceOpportunity.recommendation === 'weth-to-asset';
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: REBALANCE_ABI,
        functionName: 'incentivizedRebalance',
        args: [BigInt(autoRebalanceOpportunity.basketIndex), isWethToAsset, autoRebalanceOpportunity.amountToSwap],
        chainId: BASE_CHAIN_ID
      });

      setArbTxHash(hash);
      addLog(`Auto rebalance sent: ${shortenAddress(hash)}`);

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      await provider.waitForTransaction(hash, 1, 120000);
      await Promise.all([refreshOnChainData(), refreshTransactions()]);
      addLog(`Auto rebalance confirmed: ${shortenAddress(hash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed.';
      const normalizedMessage = message.toLowerCase();

      if (normalizedMessage.includes('user rejected') || normalizedMessage.includes('user denied')) {
        setArbError(t('rebalance.errorRejected'));
      } else if (normalizedMessage.includes('insufficient funds')) {
        setArbError(t('rebalance.errorGas'));
      } else if (normalizedMessage.includes('rebalancenotneeded')) {
        setArbError(t('rebalance.errorNoRebalance'));
      } else if (normalizedMessage.includes('swapvolumetoolow')) {
        setArbError(t('rebalance.errorTooLow'));
      } else if (normalizedMessage.includes('oracle dead') || normalizedMessage.includes('staleoracle') || normalizedMessage.includes('sequencerdown')) {
        setArbError(t('rebalance.errorOracle'));
      } else if (normalizedMessage.includes('invalid asset') || normalizedMessage.includes('cannot swap weth for weth')) {
        setArbError(t('rebalance.errorInvalidAsset'));
      } else if (normalizedMessage.includes('slippageexceeded')) {
        setArbError(t('rebalance.errorSlippage'));
      } else {
        setArbError(message.length > 180 ? `${message.slice(0, 177)}...` : message);
      }
    } finally {
      setIsArbitraging(false);
    }
  }, [address, addLog, autoRebalanceOpportunity, isConnected, open, refreshOnChainData, refreshTransactions, t, writeContractAsync]);

  const isTradeDisabled = isTransacting || isLoadingQuote || !amount || Number.parseFloat(amount) <= 0 || rawQuote <= 0n;
  const isArbDisabled = isArbitraging || !autoRebalanceOpportunity || !autoRebalanceOpportunity.eligible || autoRebalanceOpportunity.amountToSwap <= 0n;

  const sharedProps = {
    t,
    marketData,
    onChainData,
    basketData,
    lastYieldDistribution,
    discountPercentage,
    isMarketLoading,
    isOnChainLoading,
    isTransactionsLoading,
    transactions,
    logs,
    refreshAllData,
    isConnected,
    address,
    openWallet: open,
    disconnectWallet: disconnect,
    copyContract,
    copied
  };

  if (!isReady) return null;

  let content = null;

  if (view === 'home') {
    content = <HomeView {...sharedProps} />;
  } else if (view === 'dashboard') {
    content = <DashboardView {...sharedProps} />;
  } else if (view === 'buy') {
    content = (
      <BuyView
        {...sharedProps}
        amount={amount}
        ethBalance={ethBalance}
        executeTrade={executeTrade}
        gblinBalance={gblinBalance}
        isLoadingQuote={isLoadingQuote}
        isTradeDisabled={isTradeDisabled}
        isTransacting={isTransacting}
        mode={mode}
        quote={quote}
        setAmount={setAmount}
        setMode={setMode}
        setSlippage={setSlippage}
        slippage={slippage}
        tradeError={tradeError}
        tradeTxHash={tradeTxHash}
        usdValue={usdValue}
      />
    );
  } else if (view === 'rebalance') {
    content = (
      <RebalanceView
        {...sharedProps}
        arbError={arbError}
        arbTxHash={arbTxHash}
        autoRebalanceOpportunity={autoRebalanceOpportunity}
        executeArbitrage={executeArbitrage}
        isArbDisabled={isArbDisabled}
        isArbitraging={isArbitraging}
        rebalanceBountyActive={rebalanceBountyActive}
        rebalanceMinSwapRequiredEth={rebalanceMinSwapRequiredEth}
        rebalanceOverviewCards={rebalanceOverviewCards}
      />
    );
  } else {
    content = <VaultView {...sharedProps} />;
  }

  return (
    <ProtocolShell
      address={address}
      disconnectWallet={disconnect}
      isConnected={isConnected}
      language={language}
      openWallet={open}
      setLanguage={setLanguage}
      t={t}
      view={view}
    >
      {content}
    </ProtocolShell>
  );
}
