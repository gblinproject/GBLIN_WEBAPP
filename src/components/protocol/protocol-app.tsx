'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { prepareContractCall, useSendTransaction } from '@/lib/wagmi-tx';
import { exitRevertReason } from '@/lib/exit-revert';
import { ethers } from 'ethers';
import { translations, type Language } from '@/translations/index';
import { protocolTranslations } from './protocol-translations';
import {
  CONTRACT_ADDRESS,
  DISPLAY_CONTRACT_ADDRESS,
  ERC20_ABI,
  GBLIN_ABI,
  LANGUAGES,
  REBALANCE_ASSET_OPTIONS,
  RPC_URL,
  setNumberLocale,
  TOKENS,
  TRADE_TOKEN_OPTIONS,
  WETH_ADDRESS,
  ZAP_ADDRESS,
  fetchMarketData,
  fetchOnChainData,
  fetchOracleHealth,
  UNCHECKED_ORACLE_HEALTH,
  type OracleHealth,
  fetchTransactions,
  formatCurrency,
  formatTokenAmount,
  parseUsdText,
  quoteBuyShares,
  quoteSellShares,
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

// Uniswap V3 fee tier the Zap's swap adapter uses for every leg (0.05%).
const VENUE_FEE_500 = ethers.AbiCoder.defaultAbiCoder().encode(['uint24'], [500]) as `0x${string}`;

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
  const { address: wagmiAddress } = useAccount();
  const account = useMemo(() => (wagmiAddress ? { address: wagmiAddress } : undefined), [wagmiAddress]);
  const { mutate: sendTx } = useSendTransaction();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const address = account?.address;
  const isConnected = !!account;
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  const [copied, setCopied] = useState(false);
  const [language, setLanguageState] = useState<Language>('en');

  // Numbers follow the language. Set in an effect so the server render and the first
  // client render match, and only the render after the switch is localised.
  useEffect(() => {
    setNumberLocale(language);
  }, [language]);
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
  const [oracleHealth, setOracleHealth] = useState<OracleHealth>(UNCHECKED_ORACLE_HEALTH);
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
    // The Lens prices the mint exactly as the vault does, management fee and stray ETH included, and
    // reverts while the vault cannot price itself — which is the answer we want to show, not hide.
    const { out } = await quoteBuyShares(getProvider(), wethAmount);
    return out;
  }, [getProvider]);

  const formatBasketRedeemQuote = useCallback((gblinAmount: number) => {
    if (!onChainData?.supplyNum || !basketData.length || gblinAmount <= 0) return null;

    const activeSupply = Number(onChainData.supplyNum);
    if (!Number.isFinite(activeSupply) || activeSupply <= 0) return null;

    const shareRatio = gblinAmount / activeSupply;
    const cbBtcAsset = basketData.find((asset: any) => asset.name === 'cbBTC') ?? null;
    const wethAsset = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const usdcAsset = basketData.find((asset: any) => asset.name === 'USDC') ?? null;
    // Every unit in the vault belongs to the holders: the redemption is a plain pro-rata slice of each
    // row, with nothing held back.
    const cbBtcOut = (cbBtcAsset ? Number(cbBtcAsset.balance) : 0) * shareRatio;
    const wethOut = (wethAsset ? Number(wethAsset.balance) : 0) * shareRatio;
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
          const ethOut: bigint = await quoteSellShares(provider, gblinAmount).catch(() => 0n);

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
    // No buffer is withheld: every unit of WETH in the vault is the holders'.
    const availableWeth = wethBalance;
    const effectiveTotalTvlUsd = basketData.reduce((sum: number, asset: any) => {
      if (asset.name === 'WETH') {
        return sum + availableWeth * wethPrice;
      }
      return sum + (Number(asset.tvl) || 0);
    }, 0);

    const auctionOpen = Boolean(onChainData?.auctionOpen);

    return REBALANCE_ASSET_OPTIONS.map((option) => {
      const metrics = basketData.find((asset: any) => asset.name === option.name) ?? null;
      const currentUsdValue = metrics ? Number(metrics.tvl) : 0;
      const actualWeight = metrics && effectiveTotalTvlUsd > 0 ? (currentUsdValue / effectiveTotalTvlUsd) * 100 : null;
      const dynamicWeight = metrics ? Number(metrics.dynamicWeight) / 100 : null;
      const baseWeight = metrics ? Number(metrics.baseWeight) / 100 : null;
      const assetPrice = metrics ? Number(metrics.price) : 0;
      const tokenAddress: string = metrics ? String(metrics.address) : '';

      // The auction, not a weight heuristic, says what each row needs. The Lens reports the side the
      // vault takes and the gap in ETH of value; a row within its band has no gap and no auction.
      const gapEth = metrics ? Number(metrics.gapEth) || 0 : 0;
      const vaultBuysAsset = metrics ? Boolean(metrics.vaultBuysAsset) : false;

      let recommendation: RebalanceOpportunity['recommendation'] | 'balanced' | 'unknown' = 'unknown';
      if (!metrics) recommendation = 'unknown';
      else if (gapEth > 0 && vaultBuysAsset) recommendation = 'weth-to-asset';
      else if (gapEth > 0) recommendation = 'asset-to-weth';
      else recommendation = 'balanced';

      // The bidder is the counterparty. When the vault buys the asset, the bidder hands over the asset
      // and receives WETH; when the vault sells it, the bidder hands over WETH and receives the asset.
      // The vault reduces any excess to what closes the gap, so sizing at the gap is enough.
      const inputIsAsset = recommendation === 'weth-to-asset';
      const inputToken = inputIsAsset ? tokenAddress : WETH_ADDRESS;
      const inputDecimals = inputIsAsset ? option.decimals : 18;
      const inputSymbol = inputIsAsset ? option.name : 'WETH';
      const executableInputAmount = recommendation === 'balanced' || recommendation === 'unknown'
        ? 0
        : inputIsAsset
          ? (assetPrice > 0 && wethPrice > 0 ? (gapEth * wethPrice) / assetPrice : 0)
          : gapEth;

      let amountToSwap = 0n;
      try {
        if (executableInputAmount > 0) {
          amountToSwap = ethers.parseUnits(executableInputAmount.toFixed(inputDecimals), inputDecimals);
        }
      } catch {
        amountToSwap = 0n;
      }

      const eligible = auctionOpen && gapEth > 0 && amountToSwap > 0n && tokenAddress !== '';

      return {
        name: option.name,
        basketIndex: option.basketIndex,
        actualWeight,
        dynamicWeight,
        baseWeight,
        recommendation,
        inputSymbol,
        inputAmountText: formatTokenAmount(executableInputAmount, inputIsAsset ? option.decimals : 6),
        amountToSwap,
        targetEthAmount: gapEth,
        executableInputAmount,
        eligible,
        minSwapRequiredEth: gapEth,
        inputToken,
        inputDecimals,
        vaultBuysAsset,
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
    // "Bid on every open row" tries every row that has a side at the auction, not only the rows
    // marked eligible. Attempting is always allowed: the contract reverts cleanly
    // (SwapVolumeTooLow / RebalanceNotNeeded) on the individual assets it cannot execute.
    return rebalanceAssetStats.filter(
      (asset) => asset.recommendation === 'weth-to-asset' || asset.recommendation === 'asset-to-weth'
    );
  }, [rebalanceAssetStats]);

  // Rebalancing is a Dutch auction now: whoever trades toward the target weights is paid by the premium
  // on the oracle price, so there is no bounty fund to be empty or full — the auction is simply open or not.
  const rebalanceBountyActive = Boolean(onChainData?.auctionOpen);
  const rebalanceMinSwapRequiredEth = autoRebalanceOpportunity?.minSwapRequiredEth ?? 0;

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
        minFloorValue: `${formatTokenAmount(asset.minSwapRequiredEth, 6)} WETH`,
        recommendationText,
        recommendationTone,
        recommendationDot,
        containerClass: autoRebalanceOpportunity?.name === asset.name ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.03]'
      };
    });

    const wethMetrics = basketData.find((asset: any) => asset.name === 'WETH') ?? null;
    const wethBalance = wethMetrics ? Number(wethMetrics.balance) : 0;
    const wethPrice = wethMetrics ? Number(wethMetrics.price) : 0;
    // No buffer is withheld: every unit of WETH in the vault is the holders'.
    const availableWeth = wethBalance;
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
      minFloorValue: `${formatTokenAmount(Math.max(0, ...basketData.map((asset: any) => Number(asset.gapEth) || 0)), 6)} WETH`,
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
    await navigator.clipboard.writeText(DISPLAY_CONTRACT_ADDRESS);
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
          // The vault never swaps, so an arbitrary token is converted here first: token → WETH on the
          // router, then a plain WETH mint at NAV. The price risk of the swap stays with the caller's
          // own minimum, and the vault's side is priced by the oracle alone.
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

          // Read actual WETH balance after confirmed swap
          const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
          const wethToUse = await wethContract.balanceOf(address).catch(() => 0n);

          // Step 3: Approve WETH to GBLIN contract
          const allowanceWeth = await wethContract.allowance(address, CONTRACT_ADDRESS).catch(() => 0n);
          if (allowanceWeth < wethToUse) {
            addLog(`Approval required for WETH → GBLIN contract.`);
            const approveWethTx = prepareContractCall({
              contract: {
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

          // Step 4: mint with the WETH itself. The vault takes WETH directly, so there is no route to
          // encode and no swap inside the vault: the deposit is priced at NAV like any other mint.
          addLog(`Buying GBLIN with WETH...`);
          const buyTokenTx = prepareContractCall({
            contract: {
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function buyGBLINWithWeth(uint256 amount, uint256 minOut, address receiver)",
            params: [wethToUse, minGblinOut, address as `0x${string}`],
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
          // The in-kind redemption reads no price feed and is never paused: it is the guaranteed exit.
          const redeemTx = prepareContractCall({
            contract: {
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function sellGBLIN(uint256 gblinAmount)",
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
          // Re-read rather than trust the render-time flag: the state can turn between paint and click.
          // The Lens quote routes through the same conversion, so a floor derived from it would already
          // carry the loss — the quote cannot be used to detect this.
          const health = await fetchOracleHealth();
          if (health.checked && !health.ethRedeemSafe) {
            const names = health.feeds.filter((feed) => feed.unusable).map((feed) => feed.asset).join(', ');
            setOracleHealth(health);
            throw new Error(`ORACLE_UNUSABLE:${names}`);
          }

          const ethOut = await quoteSellShares(getProvider(), gblinAmount).catch(() => 0n);
          const minAmountOut = (ethOut * (10000n - slippageBps)) / 10000n;

          // The ETH exit lives in the Zap: it redeems in kind on the vault and sells every leg, all or
          // nothing. The Zap pulls the shares, so it needs the allowance; the in-kind path burns the caller's own.
          const gblinErc = new ethers.Contract(CONTRACT_ADDRESS, ERC20_ABI, provider);
          const shareAllowance: bigint = await gblinErc.allowance(address, ZAP_ADDRESS).then((v: unknown) => BigInt(String(v))).catch(() => 0n);
          if (shareAllowance < gblinAmount) {
            addLog('Approval required for GBLIN → Zap.');
            const approveSharesTx = prepareContractCall({
              contract: { address: CONTRACT_ADDRESS as `0x${string}` },
              method: "function approve(address spender, uint256 amount) returns (bool)",
              params: [ZAP_ADDRESS as `0x${string}`, gblinAmount],
            });
            let approvalHash = '';
            await new Promise<void>((resolve, reject) => {
              sendTx(approveSharesTx, {
                onSuccess: (data) => { approvalHash = data.transactionHash; resolve(); },
                onError: (err: Error) => reject(err),
              });
            });
            addLog(`Approval sent: ${shortenAddress(approvalHash)}`);
            await provider.waitForTransaction(approvalHash, 1, 60000);
          }

          // One routing entry per basket row, index for index; WETH and abandoned rows ignore it.
          const sellMethod = "function sellGBLINForEth(uint256 shares, uint256 minEthOut, bytes[] venueData, address receiver) returns (uint256 ethOut)";
          const sellParams = [gblinAmount, minAmountOut, Array.from({ length: basketData.length || 3 }, () => VENUE_FEE_500), address as `0x${string}`] as const;
          // The redemption's transfers run under a gas cap and require that reserve up front, so the call needs a
          // limit about a quarter above what it consumes. Wallets that set the limit at the bare estimate, or a
          // hair under it, see the call fail; an explicit limit with headroom avoids that. Only gas used is paid.
          const exitData = new ethers.Interface([sellMethod]).encodeFunctionData('sellGBLINForEth', [...sellParams]);
          // Simulate on the read node first: a revert here becomes a sentence for the visitor, not a wallet warning.
          try {
            await provider.call({ from: address, to: ZAP_ADDRESS, data: exitData, gasLimit: 3_000_000n });
          } catch (simErr) {
            console.error('[exit] simulation failed', simErr);
            const reason = exitRevertReason(simErr);
            throw new Error(`EXIT_REVERT:${reason ?? (simErr instanceof Error ? simErr.message : 'the vault refused the exit')}`);
          }
          let sellGas: bigint | undefined;
          try {
            const est = await provider.estimateGas({ from: address, to: ZAP_ADDRESS, data: exitData });
            sellGas = (est * 125n) / 100n;
          } catch {
            // The simulation passed a moment ago: leave the limit to the wallet.
          }
          const sellTx = prepareContractCall({
            contract: { address: ZAP_ADDRESS as `0x${string}` },
            method: sellMethod,
            params: [...sellParams],
            gas: sellGas,
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
      console.error('[trade] failed', error);
      const message = error instanceof Error ? error.message : 'Transaction failed.';
      const normalizedMessage = message.toLowerCase();
      const decoded = exitRevertReason(error);

      if (message.startsWith('EXIT_REVERT:')) {
        setTradeError(message.slice('EXIT_REVERT:'.length));
      } else if (decoded) {
        setTradeError(decoded);
      } else if (message.startsWith('ORACLE_UNUSABLE:')) {
        const names = message.slice('ORACLE_UNUSABLE:'.length);
        setTradeError(`Price feed unusable (${names}). ETH redemption is paused because the swap would go out without a floor. Redeem in basket tokens instead — that path uses no price feed.`);
      } else if (normalizedMessage.includes('user rejected') || normalizedMessage.includes('user denied')) {
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
        setTradeError('Cooldown active: wait 20 seconds after your last deposit.');
      } else if (normalizedMessage.includes('slippageexceeded')) {
        setTradeError('Slippage exceeded. Try a higher slippage setting.');
      } else if (normalizedMessage.includes('sequencerdown')) {
        setTradeError('Base sequencer unavailable. Try again later.');
      } else if (normalizedMessage.includes('transferfailed')) {
        setTradeError('Transfer failed during settlement. Retry in a moment.');
      } else if (normalizedMessage.includes('unknown rpc error') || normalizedMessage.includes('internal json-rpc')) {
        setTradeError('The wallet could not simulate the transaction on its own node. Reload the page and retry; if it keeps failing, redeem in basket tokens, which needs no swap.');
      } else {
        setTradeError(message.length > 180 ? `${message.slice(0, 177)}...` : message);
      }
    } finally {
      setIsTransacting(false);
    }
  }, [activeTradeToken, address, addLog, amount, getProvider, isConnected, mode, quoteMintFromWeth, rawQuote, redeemOption, refreshOnChainData, refreshTransactions, slippage, syncWalletBalances, sendTx]);

  // The vault pulls the bidder's input, so it needs an allowance for exactly that token: the asset when
  // the vault buys it, WETH when it sells it. Approved once per amount, before the bid.
  const ensureBidAllowance = useCallback(async (opportunity: RebalanceOpportunity) => {
    if (!address) return;
    const provider = getProvider();
    const erc = new ethers.Contract(opportunity.inputToken, ERC20_ABI, provider);
    const allowance: bigint = await erc.allowance(address, CONTRACT_ADDRESS).then((v: unknown) => BigInt(String(v))).catch(() => 0n);
    if (allowance >= opportunity.amountToSwap) return;
    const approveTx = prepareContractCall({
      contract: { address: opportunity.inputToken as `0x${string}` },
      method: "function approve(address spender, uint256 amount) returns (bool)",
      params: [CONTRACT_ADDRESS as `0x${string}`, opportunity.amountToSwap],
    });
    let approveHash = '';
    await new Promise<void>((resolve, reject) => {
      sendTx(approveTx, {
        onSuccess: (data) => { approveHash = data.transactionHash; resolve(); },
        onError: (err: Error) => reject(err),
      });
    });
    addLog(`${opportunity.inputSymbol} approval sent: ${shortenAddress(approveHash)}`);
    await provider.waitForTransaction(approveHash, 1, 120000);
  }, [address, addLog, getProvider, sendTx]);

  const executeArbitrage = useCallback(async () => {
    if (!isConnected || !address) {
      // Redirect to account hub for connection
      router.push('/account');
      return;
    }

    // The vault is the final arbiter: a bid on a row with no auction, or one that would change
    // nothing, reverts cleanly (NoAuction / ZeroOutput) and is shown with a translated message.
    if (!autoRebalanceOpportunity) {
      setArbError(t('rebalance.errorNoOpportunity'));
      return;
    }

    setIsArbitraging(true);
    setArbError(null);
    setArbTxHash(null);

    try {
      await ensureBidAllowance(autoRebalanceOpportunity);

      // The vault holds a Dutch auction and the bidder is the counterparty. The price is the oracle's,
      // adjusted by the current premium, fixed for the block: there is no pool to be sandwiched on, so
      // a zero `minOut` accepts the auction's own price. An empty `data` means no callback.
      const rebalanceTx = prepareContractCall({
        contract: {
          address: CONTRACT_ADDRESS as `0x${string}`,
        },
        method: "function bid(uint256 index, bool vaultBuysAsset, uint256 amountIn, uint256 minOut, bytes data) returns (uint256 amountInUsed, uint256 amountOut)",
        params: [BigInt(autoRebalanceOpportunity.basketIndex), autoRebalanceOpportunity.vaultBuysAsset, autoRebalanceOpportunity.amountToSwap, 0n, '0x' as `0x${string}`],
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
      } else if ((normalizedMessage.includes('noauction') || normalizedMessage.includes('rebalancenotneeded'))) {
        setArbError(t('rebalance.errorNoRebalance'));
      } else if ((normalizedMessage.includes('zerooutput') || normalizedMessage.includes('swapvolumetoolow'))) {
        setArbError(t('rebalance.errorTooLow'));
      } else if ((normalizedMessage.includes('priceunavailable') || normalizedMessage.includes('oracledead')) || normalizedMessage.includes('oracle dead') || normalizedMessage.includes('sequencerdown')) {
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
        await ensureBidAllowance(asset);

        // Same auction bid as above, one row at a time.
        const rebalanceTx = prepareContractCall({
          contract: {
            address: CONTRACT_ADDRESS as `0x${string}`,
          },
          method: "function bid(uint256 index, bool vaultBuysAsset, uint256 amountIn, uint256 minOut, bytes data) returns (uint256 amountInUsed, uint256 amountOut)",
          params: [BigInt(asset.basketIndex), asset.vaultBuysAsset, asset.amountToSwap, 0n, '0x' as `0x${string}`],
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
        } else if ((normalizedMessage.includes('noauction') || normalizedMessage.includes('rebalancenotneeded'))) {
          userMessage = t('rebalance.errorNoRebalance');
        } else if ((normalizedMessage.includes('zerooutput') || normalizedMessage.includes('swapvolumetoolow'))) {
          userMessage = t('rebalance.errorTooLow');
        } else if ((normalizedMessage.includes('priceunavailable') || normalizedMessage.includes('oracledead')) || normalizedMessage.includes('sequencerdown')) {
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

  // A feed the contract cannot price makes the ETH exit swap out with no floor. The in-kind exit
  // reads no oracle, so the UI steers to that path instead of leaving the choice open.
  const isEthRedeemBlocked = oracleHealth.checked && !oracleHealth.ethRedeemSafe;

  // Deliberately not folded into refreshOnChainData: that path returns early on a cache hit, which
  // would leave the guard unevaluated on any revisit inside the TTL. A guard must not be cached.
  useEffect(() => {
    let cancelled = false;
    const read = () => fetchOracleHealth().then((health) => {
      if (cancelled) return;
      setOracleHealth(health);
      if (health.checked && !health.ethRedeemSafe) {
        const names = health.feeds.filter((feed) => feed.unusable).map((feed) => feed.asset).join(', ');
        addLog(`Oracle feed unusable (${names}). ETH redemption disabled; in-kind exit unaffected.`);
      }
    });
    read();
    const timer = setInterval(read, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [addLog]);

  useEffect(() => {
    if (isEthRedeemBlocked && redeemOption === 'eth') setRedeemOption('basket');
  }, [isEthRedeemBlocked, redeemOption]);

  const hasTradeQuote = mode === 'sell' && redeemOption === 'basket'
    ? quote !== '0' && quote !== 'Err' && quote !== 'Basket unavailable'
    : rawQuote > 0n;
  const isTradeDisabled = isTransacting || isLoadingQuote || !amount || Number.parseFloat(amount) <= 0 || (mode === 'buy' && !activeTradeToken) || !hasTradeQuote
    || (mode === 'sell' && redeemOption === 'eth' && isEthRedeemBlocked);
  // Enabled as long as there is an opportunity to bid on, including below the minimum swap size:
  // the attempt is allowed and the contract decides. Disabled only while a transaction is pending.
  const isArbDisabled = isArbitraging || !autoRebalanceOpportunity;

  const sharedProps = {
    t,
    language,
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
        isEthRedeemBlocked={isEthRedeemBlocked}
        isTradeDisabled={isTradeDisabled}
        isTransacting={isTransacting}
        mode={mode}
        oracleHealth={oracleHealth}
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
