'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount, useActiveWallet, useSendTransaction, useDisconnect } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { base } from "thirdweb/chains";
import { ethers } from 'ethers';
import { thirdwebClient } from '@/lib/thirdweb';
import { translations, type Language } from '@/translations/index';
import { protocolTranslations } from './protocol-translations';
import {
  CONTRACT_ADDRESS,
  ERC20_ABI,
  GBLIN_ABI,
  LANGUAGES,
  REBALANCE_ASSET_OPTIONS,
  RPC_URL,
  TOKENS,
  TRADE_TOKEN_OPTIONS,
  WETH_ADDRESS,
  fetchMarketData,
  fetchOnChainData,
  fetchTransactions,
  formatCurrency,
  formatTokenAmount,
  parseUsdText,
  quoteTokenToWeth,
  resolveTradeToken,
  type TradeTokenOption,
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

interface ProtocolAppProps {
  view: ProtocolView;
}

function isSupportedLanguage(value: string | null): value is Language {
  return LANGUAGES.some((item) => item.code === value);
}

const CACHE_TTL_MARKET = 30_000;   // 30s
const CACHE_TTL_ONCHAIN = 60_000;  // 60s
const CACHE_TTL_TX = 60_000;       // 60s

const protocolViewCache: {
  marketData: any;
  onChainData: any;
  transactions: any[];
  basketData: any[];
  lastYieldDistribution: number;
  logs: string[];
  marketDataAt: number;
  onChainDataAt: number;
  transactionsAt: number;
} = {
  marketData: null,
  onChainData: null,
  transactions: [],
  basketData: [],
  lastYieldDistribution: 0,
  logs: [],
  marketDataAt: 0,
  onChainDataAt: 0,
  transactionsAt: 0,
};

export function ProtocolApp({ view }: ProtocolAppProps) {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { mutate: sendTx } = useSendTransaction();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const handleDisconnect = useCallback(() => {
    if (activeWallet) disconnect(activeWallet);
  }, [activeWallet, disconnect]);
  
  const address = account?.address;
  const isConnected = !!account;
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  const [copied, setCopied] = useState(false);
  const [language, setLanguageState] = useState<Language>('en');
  const [logs, setLogs] = useState<string[]>(protocolViewCache.logs);

  const [lastYieldDistribution, setLastYieldDistribution] = useState(protocolViewCache.lastYieldDistribution);
  const [basketData, setBasketData] = useState<any[]>(protocolViewCache.basketData);
  const [ethBalance, setEthBalance] = useState('0.0000');
  const [tokenBalance, setTokenBalance] = useState('0.0000');
  const [gblinBalance, setGblinBalance] = useState('0.0000');

  const [mode, setMode] = useState<'buy' | 'sell' | 'inkind'>('buy');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [resolvedCustomToken, setResolvedCustomToken] = useState<TradeTokenOption | null>(null);
  const [redeemOption, setRedeemOption] = useState<'eth' | 'basket'>('eth');
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

  const [isRebalancingAll, setIsRebalancingAll] = useState(false);
  const [rebalanceAllProgress, setRebalanceAllProgress] = useState<{ current: number; total: number; currentAsset: string } | null>(null);
  const [rebalanceAllResults, setRebalanceAllResults] = useState<Array<{ name: string; hash: string; success: boolean; error?: string }>>([]);

  const [marketData, setMarketData] = useState<any>(protocolViewCache.marketData);
  const [onChainData, setOnChainData] = useState<any>(protocolViewCache.onChainData);
  const [isMarketLoading, setIsMarketLoading] = useState(!protocolViewCache.marketData);
  const [isOnChainLoading, setIsOnChainLoading] = useState(!protocolViewCache.onChainData);
  const [transactions, setTransactions] = useState<any[]>(protocolViewCache.transactions);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(protocolViewCache.transactions.length === 0);

  const isFetchingRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => {
      const nextLogs = [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10);
      protocolViewCache.logs = nextLogs;
      return nextLogs;
    });
  }, []);

  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new ethers.JsonRpcProvider(RPC_URL);
    }
    return providerRef.current;
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
    const browserLanguage = navigator.language.split('-')[0].toLowerCase();
    if (isSupportedLanguage(browserLanguage)) {
      setLanguageState(browserLanguage);
    }
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

  const activeTradeToken = useMemo<TradeTokenOption | null>(() => {
    if (selectedToken === 'CUSTOM') {
      return resolvedCustomToken;
    }

    return TRADE_TOKEN_OPTIONS.find((token) => token.symbol === selectedToken) ?? null;
  }, [resolvedCustomToken, selectedToken]);

  const inputBalanceDisplay = useMemo(() => {
    if (mode === 'sell') return gblinBalance;
    return activeTradeToken?.isNative ? ethBalance : tokenBalance;
  }, [activeTradeToken, ethBalance, gblinBalance, mode, tokenBalance]);

  const quoteAssetLabel = useMemo(() => {
    if (mode === 'buy') return 'GBLIN';
    return redeemOption === 'basket' ? 'BASKET' : 'ETH';
  }, [mode, redeemOption]);

  useEffect(() => {
    let cancelled = false;

    if (selectedToken !== 'CUSTOM') {
      setResolvedCustomToken(null);
      return undefined;
    }

    const nextAddress = customTokenAddress.trim();
    if (!nextAddress || !ethers.isAddress(nextAddress)) {
      setResolvedCustomToken(null);
      return undefined;
    }

    const resolveToken = async () => {
      const token = await resolveTradeToken(getProvider(), nextAddress);
      if (!cancelled) {
        setResolvedCustomToken(token);
      }
    };

    void resolveToken();

    return () => {
      cancelled = true;
    };
  }, [customTokenAddress, getProvider, selectedToken]);

  const refreshMarketData = useCallback(async (force = false) => {
    if (!force && protocolViewCache.marketData && Date.now() - protocolViewCache.marketDataAt < CACHE_TTL_MARKET) {
      setMarketData(protocolViewCache.marketData);
      return;
    }
    setIsMarketLoading(true);
    try {
      const data = await fetchMarketData();
      setMarketData(data);
      protocolViewCache.marketData = data;
      protocolViewCache.marketDataAt = Date.now();
      addLog(`Market data updated: $${data.priceUsd.toFixed(4)}`);
    } catch {
      addLog('Failed to fetch market data.');
    } finally {
      setIsMarketLoading(false);
    }
  }, [addLog]);

  const refreshOnChainData = useCallback(async (force = false) => {
    if (!force && protocolViewCache.onChainData && Date.now() - protocolViewCache.onChainDataAt < CACHE_TTL_ONCHAIN) {
      setOnChainData(protocolViewCache.onChainData);
      setLastYieldDistribution(protocolViewCache.onChainData.lastYield || 0);
      setBasketData(protocolViewCache.onChainData.basketData || []);
      return;
    }
    setIsOnChainLoading(true);
    try {
      const data = await fetchOnChainData();
      setOnChainData(data);
      setLastYieldDistribution(data.lastYield || 0);
      setBasketData(data.basketData || []);
      protocolViewCache.onChainData = data;
      protocolViewCache.onChainDataAt = Date.now();
      protocolViewCache.lastYieldDistribution = data.lastYield || 0;
      protocolViewCache.basketData = data.basketData || [];
      addLog(`On-chain metrics sync complete. TVL: ${formatCurrency(data.tvl)}`);
    } catch {
      addLog('On-chain data sync failed.');
    } finally {
      setIsOnChainLoading(false);
    }
  }, [addLog]);

  const refreshTransactions = useCallback(async (force = false) => {
    if (!force && protocolViewCache.transactions.length > 0 && Date.now() - protocolViewCache.transactionsAt < CACHE_TTL_TX) {
      setTransactions(protocolViewCache.transactions);
      return;
    }
    setIsTransactionsLoading(true);
    try {
      const data = await fetchTransactions();
      setTransactions(data || []);
      protocolViewCache.transactions = data || [];
      protocolViewCache.transactionsAt = Date.now();
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
    refreshMarketData(true);
    refreshOnChainData(true);
    refreshTransactions(true);
  }, [refreshMarketData, refreshOnChainData, refreshTransactions]);

  const syncWalletBalances = useCallback(async () => {
    if (!isConnected || !address) {
      setEthBalance('0.0000');
      setGblinBalance('0.0000');
      setTokenBalance('0.0000');
      return;
    }

    try {
      const provider = getProvider();
      const [ethBal, gblinBal] = await Promise.all([
        provider.getBalance(address),
        new ethers.Contract(CONTRACT_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address)
      ]);

      setEthBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(4));
      setGblinBalance(parseFloat(ethers.formatEther(gblinBal)).toFixed(4));

      if (activeTradeToken && !activeTradeToken.isNative) {
        const tokenContract = new ethers.Contract(activeTradeToken.address, ERC20_ABI, provider);
        const tokenBal = await tokenContract.balanceOf(address).catch(() => 0n);
        setTokenBalance(parseFloat(ethers.formatUnits(tokenBal, activeTradeToken.decimals)).toFixed(4));
      } else {
        setTokenBalance('0.0000');
      }
    } catch {
      addLog('Wallet balance refresh failed.');
    }
  }, [activeTradeToken, address, addLog, getProvider, isConnected, mode]);

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
        const needsMarket = view === 'home' || view === 'dashboard' || view === 'buy';
        const needsTx = view === 'home' || view === 'dashboard';
        const fetches: Promise<void>[] = [refreshOnChainData()];
        if (needsMarket) fetches.push(refreshMarketData());
        if (needsTx) fetches.push(refreshTransactions());
        await Promise.all(fetches);
      } finally {
        isFetchingRef.current = false;
      }
    };

    void loadAll();
  }, [view, refreshMarketData, refreshOnChainData, refreshTransactions]);

  const quoteMintFromWeth = useCallback(async (wethAmount: bigint) => {
    const provider = getProvider();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
    const [result, totalSupplyRaw, contractBalanceRaw] = await Promise.all([
      contract.quoteBuyGBLIN(wethAmount),
      contract.totalSupply(),
      contract.balanceOf(CONTRACT_ADDRESS)
    ]);

    const quotedGblinOut: bigint = result[0];
    const totalSupply = BigInt(totalSupplyRaw.toString());
    const contractBalance = BigInt(contractBalanceRaw.toString());
    const activeSupply = totalSupply - contractBalance;

    if (activeSupply === 0n) {
      return quotedGblinOut > 1000n ? quotedGblinOut - 1000n : 0n;
    }

    return quotedGblinOut;
  }, [getProvider]);

  const formatBasketRedeemQuote = useCallback((gblinAmount: number) => {
    if (!onChainData?.supplyNum || !basketData.length || gblinAmount <= 0) return null;

    const activeSupply = Number(onChainData.supplyNum);
    if (!Number.isFinite(activeSupply) || activeSupply <= 0) return null;

    const shareRatio = gblinAmount / activeSupply;
    const cbBtcAsset = basketData.find((asset: any) => asset.name === 'cbBTC') ?? null;
    const wethAsset = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const usdcAsset = basketData.find((asset: any) => asset.name === 'USDC') ?? null;
    const stabilityFundValue = onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0;

    const cbBtcOut = (cbBtcAsset ? Number(cbBtcAsset.balance) : 0) * shareRatio;
    const wethOut = Math.max((wethAsset ? Number(wethAsset.balance) : 0) - stabilityFundValue, 0) * shareRatio;
    const usdcOut = (usdcAsset ? Number(usdcAsset.balance) : 0) * shareRatio;

    return {
      cbBtcOut,
      wethOut,
      usdcOut,
      summary: `${formatTokenAmount(cbBtcOut, 8)} cbBTC • ${formatTokenAmount(wethOut, 6)} WETH • ${formatTokenAmount(usdcOut, 2)} USDC`
    };
  }, [basketData, onChainData]);

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
        const provider = getProvider();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
        const ethPrice = marketData?.ethPriceUsd || 3500;

        if (mode === 'buy') {
          if (!activeTradeToken) {
            setQuote('Token required');
            setRawQuote(0n);
            setUsdValue('$0.00');
            return;
          }

          if (!activeTradeToken.isNative && activeTradeToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
            setQuote('Use ETH');
            setRawQuote(0n);
            setUsdValue('$0.00');
            return;
          }

          if (activeTradeToken.isNative) {
            const wethAmount = ethers.parseEther(amount);
            const effectiveGblinOut = await quoteMintFromWeth(wethAmount);
            setRawQuote(effectiveGblinOut);
            setQuote(parseFloat(ethers.formatEther(effectiveGblinOut)).toFixed(4));
            setUsdValue(formatCurrency(Number.parseFloat(amount) * ethPrice));
          } else {
            const amountIn = ethers.parseUnits(amount, activeTradeToken.decimals);
            const routeQuote = await quoteTokenToWeth(provider, activeTradeToken.address, amountIn);
            if (!routeQuote || routeQuote.amountOut <= 0n) {
              setQuote('No route');
              setRawQuote(0n);
              setUsdValue('$0.00');
              return;
            }

            const effectiveGblinOut = await quoteMintFromWeth(routeQuote.amountOut);
            setRawQuote(effectiveGblinOut);
            setQuote(parseFloat(ethers.formatEther(effectiveGblinOut)).toFixed(4));
            setUsdValue(formatCurrency(Number.parseFloat(ethers.formatEther(routeQuote.amountOut)) * ethPrice));
          }
        } else {
          const gblinAmount = ethers.parseEther(amount);
          const ethOut: bigint = await contract.quoteSellGBLIN(gblinAmount).catch(() => 0n);

          if (redeemOption === 'basket') {
            const basketQuote = formatBasketRedeemQuote(Number.parseFloat(amount));
            setRawQuote(gblinAmount);
            setQuote(basketQuote?.summary ?? 'Basket unavailable');
            setUsdValue(formatCurrency(Number.parseFloat(ethers.formatEther(ethOut)) * ethPrice));
          } else {
            setRawQuote(ethOut);
            setQuote(parseFloat(ethers.formatEther(ethOut)).toFixed(6));
            setUsdValue(formatCurrency(Number.parseFloat(ethers.formatEther(ethOut)) * ethPrice));
          }
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
  }, [activeTradeToken, amount, formatBasketRedeemQuote, getProvider, marketData, mode, quoteMintFromWeth, redeemOption]);

  const discountPercentage = useMemo(() => {
    if (!marketData?.priceUsd || !onChainData?.nav) return 0;
    const nav = parseUsdText(onChainData.nav);
    if (!nav) return 0;
    const discount = (1 - marketData.priceUsd / nav) * 100;
    return Math.max(-100, Math.min(100, discount));
  }, [marketData, onChainData]);

  const rebalanceAssetStats = useMemo(() => {
    const wethAsset = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const wethBalance = wethAsset ? Number(wethAsset.balance) : 0;
    const wethPrice = wethAsset ? Number(wethAsset.price) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);
    const effectiveTotalTvlUsd = basketData.reduce((sum: number, asset: any) => {
      if (asset.name === 'WETH') {
        return sum + availableWeth * wethPrice;
      }
      return sum + (Number(asset.tvl) || 0);
    }, 0);

    return REBALANCE_ASSET_OPTIONS.map((option) => {
      const metrics = basketData.find((asset: any) => asset.name === option.name) ?? null;
      const currentUsdValue = metrics ? Number(metrics.tvl) : 0;
      const actualWeight = metrics && effectiveTotalTvlUsd > 0 ? (currentUsdValue / effectiveTotalTvlUsd) * 100 : null;
      const dynamicWeight = metrics ? Number(metrics.dynamicWeight) / 100 : null;
      const baseWeight = metrics ? Number(metrics.baseWeight) / 100 : null;
      const assetPrice = metrics ? Number(metrics.price) : 0;
      const assetBalance = metrics ? Number(metrics.balance) : 0;
      const targetUsdValue = metrics ? (effectiveTotalTvlUsd * Number(metrics.dynamicWeight)) / 10000 : 0;
      const deltaUsd = metrics ? targetUsdValue - currentUsdValue : 0;
      const weightGap = actualWeight !== null && dynamicWeight !== null ? dynamicWeight - actualWeight : null;

      let recommendation: RebalanceOpportunity['recommendation'] | 'balanced' | 'unknown' = 'unknown';
      if (weightGap !== null && weightGap > 0.01) recommendation = 'weth-to-asset';
      else if (weightGap !== null && weightGap < -0.01) recommendation = 'asset-to-weth';
      else if (weightGap !== null) recommendation = 'balanced';

      const desiredWethInput = recommendation === 'weth-to-asset' && wethPrice > 0 ? Math.max(deltaUsd, 0) / wethPrice : 0;
      const desiredAssetInput = recommendation === 'asset-to-weth' && assetPrice > 0 ? Math.abs(Math.min(deltaUsd, 0)) / assetPrice : 0;

      const executableInputAmount = recommendation === 'weth-to-asset'
        ? Math.min(desiredWethInput, availableWeth)
        : recommendation === 'asset-to-weth'
          ? Math.min(desiredAssetInput, assetBalance)
          : 0;

      const ethEquivalentInput = recommendation === 'weth-to-asset'
        ? executableInputAmount
        : recommendation === 'asset-to-weth' && assetPrice > 0 && wethPrice > 0
          ? (executableInputAmount * assetPrice) / wethPrice
          : 0;

      const inputSymbol = recommendation === 'weth-to-asset' ? 'WETH' : option.name;

      let amountToSwap = 0n;
      try {
        if (recommendation === 'weth-to-asset' && executableInputAmount > 0) {
          const effectiveAmount = Math.max(executableInputAmount, minSwapRequiredEth);
          amountToSwap = ethers.parseUnits(effectiveAmount.toFixed(8), 18);
        } else if (recommendation === 'asset-to-weth' && executableInputAmount > 0) {
          const minFloorInAsset = assetPrice > 0 && wethPrice > 0 ? (minSwapRequiredEth * wethPrice) / assetPrice : 0;
          const effectiveAmount = Math.max(executableInputAmount, minFloorInAsset);
          amountToSwap = ethers.parseUnits(effectiveAmount.toFixed(option.decimals), option.decimals);
        }
      } catch {
        amountToSwap = 0n;
      }

      const eligible = executableInputAmount > 0 && amountToSwap > 0n;

      return {
        name: option.name,
        basketIndex: option.basketIndex,
        actualWeight,
        dynamicWeight,
        baseWeight,
        recommendation,
        inputSymbol,
        inputAmountText: formatTokenAmount(executableInputAmount, recommendation === 'weth-to-asset' ? 6 : option.decimals),
        amountToSwap,
        targetEthAmount: ethEquivalentInput,
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

  const eligibleRebalanceAssets = useMemo(() => {
    return rebalanceAssetStats.filter((asset) => asset.eligible && asset.amountToSwap > 0n);
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

      const weightGap = asset.actualWeight !== null && asset.dynamicWeight !== null
        ? Math.abs(asset.dynamicWeight - asset.actualWeight)
        : null;

      return {
        name: asset.name,
        actualWeight: asset.actualWeight,
        dynamicWeight: asset.dynamicWeight,
        baseWeight: asset.baseWeight,
        weightGap,
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
    const wethPrice = wethMetrics ? Number(wethMetrics.price) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? Number.parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);
    const effectiveTotalTvlUsd = basketData.reduce((sum: number, asset: any) => {
      if (asset.name === 'WETH') {
        return sum + availableWeth * wethPrice;
      }
      return sum + (Number(asset.tvl) || 0);
    }, 0);
    const wethActualWeight = effectiveTotalTvlUsd > 0 ? ((availableWeth * wethPrice) / effectiveTotalTvlUsd) * 100 : null;

    const wethDynamicWeight = wethMetrics ? Number(wethMetrics.dynamicWeight) / 100 : null;
    const wethWeightGap = wethActualWeight !== null && wethDynamicWeight !== null ? Math.abs(wethDynamicWeight - wethActualWeight) : null;

    const wethCard: RebalanceCard = {
      name: 'WETH',
      actualWeight: wethActualWeight,
      dynamicWeight: wethDynamicWeight,
      baseWeight: wethMetrics ? Number(wethMetrics.baseWeight) / 100 : null,
      weightGap: wethWeightGap,
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
      // Redirect to account hub for connection
      router.push('/account');
      return;
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      setTradeError('Enter a valid amount.');
      return;
    }

    if (mode === 'buy' && !activeTradeToken) {
      setTradeError('Select a valid input token.');
      return;
    }

    if (mode === 'buy' && activeTradeToken && !activeTradeToken.isNative && activeTradeToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      setTradeError('Use native ETH instead of WETH for minting.');
      return;
    }

    if (redeemOption !== 'basket' && rawQuote <= 0n) {
      setTradeError('Quote not ready. Wait a moment and retry.');
      return;
    }

    const slippageBps = BigInt(Math.round(slippage * 100));

    setIsTransacting(true);
    setTradeError(null);
    setTradeTxHash(null);

    try {
      const provider = getProvider();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
      let hash: `0x${string}` = '' as `0x${string}`;

      if (mode === 'buy') {
        if (!activeTradeToken) {
          throw new Error('token required');
        }

        if (activeTradeToken.isNative) {
          const ethAmount = ethers.parseEther(amount);
          const quotedGblinOut = await quoteMintFromWeth(ethAmount);
          const minAmountOut = (quotedGblinOut * (10000n - slippageBps)) / 10000n;

          // Thirdweb: Buy GBLIN with ETH
          const buyTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: base,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function buyGBLIN(uint256 minGblinOut) payable",
            params: [minAmountOut],
            value: ethAmount,
          });
          
          await new Promise<void>((resolve, reject) => {
            sendTx(buyTx, {
              onSuccess: (data) => {
                hash = data.transactionHash;
                resolve();
              },
              onError: (err: Error) => reject(err),
            });
          });
        } else {
          // WORKAROUND: buyGBLINWithToken uses ISwapRouter (v1) interface with `deadline` field
          // but the deployed router (SwapRouter02) uses IV3SwapRouter without `deadline`.
          // This ABI mismatch causes exactInput to revert for non-WETH tokens.
          // Fix: swap token→WETH externally via SwapRouter02, then call buyGBLINWithToken with WETH directly.
          const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0b26F421741e481";
          const amountIn = ethers.parseUnits(amount, activeTradeToken.decimals);
          const routeQuote = await quoteTokenToWeth(provider, activeTradeToken.address, amountIn);

          if (!routeQuote || routeQuote.amountOut <= 0n) {
            throw new Error('no route');
          }

          const quotedGblinOut = await quoteMintFromWeth(routeQuote.amountOut);
          const minGblinOut = (quotedGblinOut * (10000n - slippageBps)) / 10000n;
          const minWethOut = (routeQuote.amountOut * (10000n - slippageBps)) / 10000n;

          // Step 1: Approve token to SwapRouter02 (not to GBLIN contract)
          const tokenContract = new ethers.Contract(activeTradeToken.address, ERC20_ABI, provider);
          const allowanceRouter = await tokenContract.allowance(address, SWAP_ROUTER_02).catch(() => 0n);

          if (allowanceRouter < amountIn) {
            addLog(`Approval required for ${activeTradeToken.symbol} → SwapRouter02.`);
            const approveTx = prepareContractCall({
              contract: {
                client: thirdwebClient,
                chain: base,
                address: activeTradeToken.address as `0x${string}`,
              },
              method: "function approve(address spender, uint256 amount) returns (bool)",
              params: [SWAP_ROUTER_02 as `0x${string}`, amountIn],
            });
            let approvalHash = '';
            await new Promise<void>((resolve, reject) => {
              sendTx(approveTx, {
                onSuccess: (data) => { approvalHash = data.transactionHash; resolve(); },
                onError: (err: Error) => reject(err),
              });
            });
            addLog(`Approval sent: ${shortenAddress(approvalHash)}`);
            await provider.waitForTransaction(approvalHash, 1, 120000);
            addLog(`Approval confirmed: ${shortenAddress(approvalHash)}`);
          }

          // Step 2: Swap token→WETH via SwapRouter02 externally
          // Use single-hop if direct pool exists, otherwise multi-hop via exactInput (no deadline field in SwapRouter02)
          addLog(`Swapping ${activeTradeToken.symbol} → WETH via SwapRouter02...`);
          let swapTx;
          if (routeQuote.fees.length === 1) {
            // Single hop: use exactInputSingle (no deadline, matches SwapRouter02)
            swapTx = prepareContractCall({
              contract: {
                client: thirdwebClient,
                chain: base,
                address: SWAP_ROUTER_02 as `0x${string}`,
              },
              method: "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut)",
              params: [{
                tokenIn: activeTradeToken.address as `0x${string}`,
                tokenOut: WETH_ADDRESS as `0x${string}`,
                fee: routeQuote.fees[0],
                recipient: address as `0x${string}`,
                amountIn,
                amountOutMinimum: minWethOut,
                sqrtPriceLimitX96: 0n,
              }],
            });
          } else {
            // Multi-hop: use exactInput (SwapRouter02 version — no deadline field)
            swapTx = prepareContractCall({
              contract: {
                client: thirdwebClient,
                chain: base,
                address: SWAP_ROUTER_02 as `0x${string}`,
              },
              method: "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) returns (uint256 amountOut)",
              params: [{
                path: routeQuote.path,
                recipient: address as `0x${string}`,
                amountIn,
                amountOutMinimum: minWethOut,
              }],
            });
          }

          let swapHash = '';
          await new Promise<void>((resolve, reject) => {
            sendTx(swapTx, {
              onSuccess: (data) => { swapHash = data.transactionHash; resolve(); },
              onError: (err: Error) => reject(err),
            });
          });
          addLog(`Swap sent: ${shortenAddress(swapHash)}`);
          await provider.waitForTransaction(swapHash, 1, 120000);
          addLog(`Swap confirmed: ${shortenAddress(swapHash)}`);

          // Read actual WETH received after swap
          const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
          const wethBalance = await wethContract.balanceOf(address).catch(() => 0n);
          const wethToUse = wethBalance < minWethOut ? wethBalance : wethBalance;

          // Step 3: Approve WETH to GBLIN contract
          const allowanceWeth = await wethContract.allowance(address, CONTRACT_ADDRESS).catch(() => 0n);
          if (allowanceWeth < wethToUse) {
            addLog(`Approval required for WETH → GBLIN contract.`);
            const approveWethTx = prepareContractCall({
              contract: {
                client: thirdwebClient,
                chain: base,
                address: WETH_ADDRESS as `0x${string}`,
              },
              method: "function approve(address spender, uint256 amount) returns (bool)",
              params: [CONTRACT_ADDRESS as `0x${string}`, wethToUse],
            });
            let approveWethHash = '';
            await new Promise<void>((resolve, reject) => {
              sendTx(approveWethTx, {
                onSuccess: (data) => { approveWethHash = data.transactionHash; resolve(); },
                onError: (err: Error) => reject(err),
              });
            });
            addLog(`WETH approval sent: ${shortenAddress(approveWethHash)}`);
            await provider.waitForTransaction(approveWethHash, 1, 120000);
            addLog(`WETH approval confirmed: ${shortenAddress(approveWethHash)}`);
          }

          // Step 4: Buy GBLIN with WETH using dummy path (contract skips internal swap when tokenIn==WETH)
          const wethDummyPath = ethers.concat([
            ethers.getBytes(WETH_ADDRESS),
            ethers.toBeHex(0, 3),
            ethers.getBytes(WETH_ADDRESS),
          ]) as `0x${string}`;

          addLog(`Buying GBLIN with WETH...`);
          const buyTokenTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: base,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function buyGBLINWithToken(bytes path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut)",
            params: [wethDummyPath, wethToUse, 0n, minGblinOut],
          });

          await new Promise<void>((resolve, reject) => {
            sendTx(buyTokenTx, {
              onSuccess: (data) => { hash = data.transactionHash; resolve(); },
              onError: (err: Error) => reject(err),
            });
          });
        }
      } else {
        const gblinAmount = ethers.parseEther(amount);

        if (redeemOption === 'basket') {
          // Thirdweb: Redeem in kind
          const redeemTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: base,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function redeemInKind(uint256 gblinAmount)",
            params: [gblinAmount],
          });
          
          await new Promise<void>((resolve, reject) => {
            sendTx(redeemTx, {
              onSuccess: (data) => {
                hash = data.transactionHash;
                resolve();
              },
              onError: (err: Error) => reject(err),
            });
          });
        } else {
          const ethOut = await contract.quoteSellGBLIN(gblinAmount).catch(() => 0n);
          const minAmountOut = (ethOut * (10000n - slippageBps)) / 10000n;

          // Thirdweb: Sell GBLIN for ETH
          const sellTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: base,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
            params: [gblinAmount, minAmountOut],
          });
          
          await new Promise<void>((resolve, reject) => {
            sendTx(sellTx, {
              onSuccess: (data) => {
                hash = data.transactionHash;
                resolve();
              },
              onError: (err: Error) => reject(err),
            });
          });
        }
      }

      setTradeTxHash(hash);
      addLog(`Transaction sent: ${shortenAddress(hash)}`);

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
      } else if (normalizedMessage.includes('no route')) {
        setTradeError('No direct swap route to WETH was found for this token.');
      } else if (normalizedMessage.includes('token required')) {
        setTradeError('Select a valid input token before minting.');
      } else if (normalizedMessage.includes('deposittoosmall')) {
        setTradeError('Deposit too small. Minimum is 0.0005 ETH.');
      } else if (normalizedMessage.includes('invalidamount')) {
        setTradeError('Invalid amount. Check the entered value and retry.');
      } else if (normalizedMessage.includes('invalidpath')) {
        setTradeError('Invalid token route. Choose another token or retry.');
      } else if (normalizedMessage.includes('cooldownactive')) {
        setTradeError('Cooldown active. Wait 2 minutes after the last deposit.');
      } else if (normalizedMessage.includes('slippageexceeded')) {
        setTradeError('Slippage exceeded. Try a higher slippage setting.');
      } else if (normalizedMessage.includes('sequencerdown')) {
        setTradeError('Base sequencer unavailable. Try again later.');
      } else if (normalizedMessage.includes('transferfailed')) {
        setTradeError('Transfer failed during settlement. Retry in a moment.');
      } else {
        setTradeError(message.length > 180 ? `${message.slice(0, 177)}...` : message);
      }
    } finally {
      setIsTransacting(false);
    }
  }, [activeTradeToken, address, addLog, amount, getProvider, isConnected, mode, quoteMintFromWeth, rawQuote, redeemOption, refreshOnChainData, refreshTransactions, slippage, syncWalletBalances, sendTx]);

  const executeArbitrage = useCallback(async () => {
    if (!isConnected || !address) {
      // Redirect to account hub for connection
      router.push('/account');
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
      
      // Thirdweb: Incentivized Rebalance
      const rebalanceTx = prepareContractCall({
        contract: {
          client: thirdwebClient,
          chain: base,
          address: CONTRACT_ADDRESS as `0x${string}`,
        },
        method: "function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap)",
        params: [BigInt(autoRebalanceOpportunity.basketIndex), isWethToAsset, autoRebalanceOpportunity.amountToSwap],
      });
      
      let hash: `0x${string}` | '' = '';
      await new Promise<void>((resolve, reject) => {
        sendTx(rebalanceTx, {
          onSuccess: (data) => {
            hash = data.transactionHash;
            resolve();
          },
          onError: (err: Error) => reject(err),
        });
      });

      setArbTxHash(hash);
      addLog(`Auto rebalance sent: ${shortenAddress(hash)}`);

      const provider = getProvider();
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
      } else if (normalizedMessage.includes('oracledead') || normalizedMessage.includes('oracle dead') || normalizedMessage.includes('sequencerdown')) {
        setArbError(t('rebalance.errorOracle'));
      } else if (normalizedMessage.includes('invalidindex') || normalizedMessage.includes('cannotswapsametoken') || normalizedMessage.includes('invalid asset') || normalizedMessage.includes('cannot swap weth for weth')) {
        setArbError(t('rebalance.errorInvalidAsset'));
      } else if (normalizedMessage.includes('slippageexceeded')) {
        setArbError(t('rebalance.errorSlippage'));
      } else {
        setArbError(message.length > 180 ? `${message.slice(0, 177)}...` : message);
      }
    } finally {
      setIsArbitraging(false);
    }
  }, [address, addLog, autoRebalanceOpportunity, getProvider, isConnected, refreshOnChainData, refreshTransactions, t, sendTx]);

  const executeRebalanceAll = useCallback(async () => {
    if (!isConnected || !address) {
      // Redirect to account hub for connection
      router.push('/account');
      return;
    }

    if (eligibleRebalanceAssets.length === 0) {
      setArbError(t('rebalance.errorNoOpportunity'));
      return;
    }

    setIsRebalancingAll(true);
    setArbError(null);
    setArbTxHash(null);
    setRebalanceAllResults([]);

    const results: Array<{ name: string; hash: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < eligibleRebalanceAssets.length; i++) {
      const asset = eligibleRebalanceAssets[i];
      setRebalanceAllProgress({ current: i + 1, total: eligibleRebalanceAssets.length, currentAsset: asset.name });

      try {
        const isWethToAsset = asset.recommendation === 'weth-to-asset';
        
        // Thirdweb: Incentivized Rebalance
        const rebalanceTx = prepareContractCall({
          contract: {
            client: thirdwebClient,
            chain: base,
            address: CONTRACT_ADDRESS as `0x${string}`,
          },
          method: "function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap)",
          params: [BigInt(asset.basketIndex), isWethToAsset, asset.amountToSwap],
        });
        
        let hash: `0x${string}` | '' = '';
        await new Promise<void>((resolve, reject) => {
          sendTx(rebalanceTx, {
            onSuccess: (data) => {
              hash = data.transactionHash;
              resolve();
            },
            onError: (err: Error) => reject(err),
          });
        });

        addLog(`Rebalance All [${i + 1}/${eligibleRebalanceAssets.length}] ${asset.name} sent: ${shortenAddress(hash)}`);
        const provider = getProvider();
        await provider.waitForTransaction(hash, 1, 120000);
        addLog(`Rebalance All [${i + 1}/${eligibleRebalanceAssets.length}] ${asset.name} confirmed`);
        results.push({ name: asset.name, hash, success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Transaction failed.';
        const normalizedMessage = message.toLowerCase();

        let userMessage = message.length > 120 ? `${message.slice(0, 117)}...` : message;
        if (normalizedMessage.includes('user rejected') || normalizedMessage.includes('user denied')) {
          userMessage = t('rebalance.errorRejected');
          results.push({ name: asset.name, hash: '', success: false, error: userMessage });
          break;
        } else if (normalizedMessage.includes('rebalancenotneeded')) {
          userMessage = t('rebalance.errorNoRebalance');
        } else if (normalizedMessage.includes('swapvolumetoolow')) {
          userMessage = t('rebalance.errorTooLow');
        } else if (normalizedMessage.includes('oracledead') || normalizedMessage.includes('sequencerdown')) {
          userMessage = t('rebalance.errorOracle');
        } else if (normalizedMessage.includes('slippageexceeded')) {
          userMessage = t('rebalance.errorSlippage');
        }

        addLog(`Rebalance All [${i + 1}/${eligibleRebalanceAssets.length}] ${asset.name} failed: ${userMessage}`);
        results.push({ name: asset.name, hash: '', success: false, error: userMessage });
      }

      setRebalanceAllResults([...results]);
    }

    setRebalanceAllProgress(null);
    setIsRebalancingAll(false);
    await Promise.all([refreshOnChainData(), refreshTransactions()]);
  }, [address, addLog, eligibleRebalanceAssets, getProvider, isConnected, refreshOnChainData, refreshTransactions, t, sendTx]);

  const hasTradeQuote = mode === 'sell' && redeemOption === 'basket'
    ? quote !== '0' && quote !== 'Err' && quote !== 'Basket unavailable'
    : rawQuote > 0n;
  const isTradeDisabled = isTransacting || isLoadingQuote || !amount || Number.parseFloat(amount) <= 0 || (mode === 'buy' && !activeTradeToken) || !hasTradeQuote;
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
    openWallet: () => router.push('/account'),
    disconnectWallet: handleDisconnect,
    copyContract,
    copied
  };

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
        buyTokenOptions={TOKENS}
        customTokenAddress={customTokenAddress}
        ethBalance={ethBalance}
        executeTrade={executeTrade}
        gblinBalance={gblinBalance}
        inputBalance={inputBalanceDisplay}
        isLoadingQuote={isLoadingQuote}
        isTradeDisabled={isTradeDisabled}
        isTransacting={isTransacting}
        mode={mode}
        quote={quote}
        quoteAssetLabel={quoteAssetLabel}
        redeemOption={redeemOption}
        resolvedTokenSymbol={activeTradeToken?.symbol ?? (selectedToken === 'CUSTOM' ? 'CUSTOM' : selectedToken)}
        setAmount={setAmount}
        setCustomTokenAddress={setCustomTokenAddress}
        setMode={setMode}
        setRedeemOption={setRedeemOption}
        setSelectedToken={setSelectedToken}
        setSlippage={setSlippage}
        selectedToken={selectedToken}
        slippage={slippage}
        tokenBalance={tokenBalance}
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
        eligibleRebalanceCount={eligibleRebalanceAssets.length}
        executeArbitrage={executeArbitrage}
        executeRebalanceAll={executeRebalanceAll}
        isArbDisabled={isArbDisabled}
        isArbitraging={isArbitraging}
        isRebalancingAll={isRebalancingAll}
        rebalanceAllProgress={rebalanceAllProgress}
        rebalanceAllResults={rebalanceAllResults}
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
      disconnectWallet={handleDisconnect}
      isConnected={isConnected}
      language={language}
      openWallet={() => router.push('/account')}
      setLanguage={setLanguage}
      t={t}
      view={view}
    >
      {content}
    </ProtocolShell>
  );
}
