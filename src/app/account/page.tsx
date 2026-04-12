"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useActiveAccount,
  useActiveWallet,
  useReadContract,
  useSendTransaction,
} from "thirdweb/react";
import { ConnectButton, PayEmbed, BridgeWidget } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { ethereum } from "thirdweb/chains";
import { ArrowRight, Wallet, TrendingUp, Coins, X as LogOut, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { ethers } from "ethers";
import { thirdwebClient, wallets, chain as thirdwebChain } from "@/lib/thirdweb";
import {
  CONTRACT_ADDRESS,
  MORALIS_API_KEY,
  shortenAddress,
  LOGO_URL,
  TRADE_TOKEN_OPTIONS,
  GBLIN_ABI,
  RPC_URL,
  type TradeTokenOption,
} from "@/components/protocol/protocol-data";
import { BuyView } from "@/components/protocol/protocol-sections";
import { translations, type Language } from "@/translations/index";
import { protocolTranslations } from "@/components/protocol/protocol-translations";
import { LANGUAGES } from "@/components/protocol/protocol-data";

// Currency config per language
const CURRENCY_CONFIG: Record<Language, { symbol: string; code: string; fxKey: string | null }> = {
  en: { symbol: "$", code: "USD", fxKey: null },
  it: { symbol: "€", code: "EUR", fxKey: "coingecko:eur" },
  es: { symbol: "€", code: "EUR", fxKey: "coingecko:eur" },
  fr: { symbol: "€", code: "EUR", fxKey: "coingecko:eur" },
  de: { symbol: "€", code: "EUR", fxKey: "coingecko:eur" },
  zh: { symbol: "¥", code: "CNY", fxKey: "coingecko:cny" },
  ja: { symbol: "¥", code: "JPY", fxKey: "coingecko:jpy" },
};

const shellCard = "rounded-[2rem] border border-white/10 bg-[#0A0A0A]/90 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl";
const shellContainer = "mx-auto w-full max-w-[1720px]";

// Contract instances
const gblinContract = getContract({
  client: thirdwebClient,
  chain: thirdwebChain,
  address: CONTRACT_ADDRESS,
});

interface Transaction {
  hash: string;
  type: "buy" | "sell" | "transfer_in" | "transfer_out" | "rebalance";
  amount: string;
  valueUsd: string;
  time: string;
  timestamp: number;
}

function isSupportedLanguage(value: string | null): value is Language {
  return LANGUAGES.some((item) => item.code === value);
}

export default function AccountPage() {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLanguage = window.localStorage.getItem("gblin-language");
    if (isSupportedLanguage(storedLanguage)) {
      setLanguageState(storedLanguage);
      return;
    }
    const browserLang = navigator.language.split("-")[0].toLowerCase();
    if (isSupportedLanguage(browserLang)) setLanguageState(browserLang);
  }, []);

  const t = useCallback(
    (key: string) => {
      const segments = key.split(".");
      const getValue = (source: any) =>
        segments.reduce<any>((acc, part) => (acc && typeof acc === "object" && part in acc ? acc[part] : null), source);
      const current = getValue(protocolTranslations[language]) ?? getValue(translations[language]);
      if (typeof current === "string") return current;
      const fallback = getValue(protocolTranslations.en) ?? getValue(translations.en);
      return typeof fallback === "string" ? fallback : key;
    },
    [language]
  );

  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { mutate: sendTx, isPending: isSending } = useSendTransaction();

  const [activeTab, setActiveTab] = useState<"overview" | "buy" | "sell" | "send">("overview");
  const [buyMode, setBuyMode] = useState<"card" | "wallet">("card");
  const [buyInputMode, setBuyInputMode] = useState<"currency" | "gblin">("currency");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferAddress, setTransferAddress] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [mainnetEthBalance, setMainnetEthBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [copied, setCopied] = useState(false);

  // Advanced trading states for BuyView
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [resolvedCustomToken, setResolvedCustomToken] = useState<TradeTokenOption | null>(null);
  const [redeemOption, setRedeemOption] = useState<'eth' | 'basket'>('eth');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1);
  const [quote, setQuote] = useState('0');
  const [rawQuote, setRawQuote] = useState<bigint>(0n);
  const [usdValue, setUsdValue] = useState('$0.00');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeTxHash, setTradeTxHash] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState('0.0000');
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const [marketData, setMarketData] = useState({ priceUsd: 0, volume24h: 0, change24h: 0, txCount: 0 });
  const [onChainData, setOnChainData] = useState<any>(null);

  // Prices
  const [ethPriceUsd, setEthPriceUsd] = useState(3500);
  const [fxRate, setFxRate] = useState(1); // USD → local currency

  const currencyConfig = CURRENCY_CONFIG[language];

  // Format value in local currency
  const formatLocal = useCallback(
    (usdValue: number) => {
      const localValue = usdValue * fxRate;
      return `${currencyConfig.symbol}${localValue.toLocaleString(language === "ja" || language === "zh" ? "en" : language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [fxRate, currencyConfig, language]
  );

  const address = account?.address;

  // Provider for advanced trading
  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new ethers.JsonRpcProvider(RPC_URL);
    }
    return providerRef.current;
  }, []);

  // Quote GBLIN output from WETH input
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

  // Format basket redeem quote for display
  const formatBasketRedeemQuote = useCallback((gblinAmount: number) => {
    if (!onChainData?.supplyNum || !onChainData?.basketData?.length || gblinAmount <= 0) return null;

    const activeSupply = Number(onChainData.supplyNum);
    if (!Number.isFinite(activeSupply) || activeSupply <= 0) return null;

    const shareRatio = gblinAmount / activeSupply;
    const basketData = onChainData.basketData;
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
      summary: `${cbBtcOut.toFixed(8)} cbBTC • ${wethOut.toFixed(6)} WETH • ${usdcOut.toFixed(2)} USDC`
    };
  }, [onChainData]);

  // Active trade token
  const activeTradeToken = useMemo<TradeTokenOption | null>(() => {
    if (selectedToken === 'CUSTOM') {
      return resolvedCustomToken;
    }
    return TRADE_TOKEN_OPTIONS.find((token) => token.symbol === selectedToken) ?? null;
  }, [resolvedCustomToken, selectedToken]);

  // Quote asset label
  const quoteAssetLabel = useMemo(() => {
    if (tradeMode === 'buy') return 'GBLIN';
    return redeemOption === 'basket' ? 'BASKET' : 'ETH';
  }, [tradeMode, redeemOption]);

  // Resolved token symbol
  const resolvedTokenSymbol = useMemo(() => {
    if (selectedToken === 'CUSTOM') {
      return resolvedCustomToken?.symbol ?? '???';
    }
    return selectedToken;
  }, [resolvedCustomToken, selectedToken]);

  // Buy token options
  const buyTokenOptions = useMemo(() => TRADE_TOKEN_OPTIONS.map((t) => t.symbol), []);

  // Read GBLIN balance — also refetch every 15s so external purchases (MetaMask) show up
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract: gblinContract,
    method: "function balanceOf(address) view returns (uint256)",
    params: [address ?? "0x0000000000000000000000000000000000000000"],
  });

  // Fetch ETH balance via ethers provider (Base)
  const fetchEthBalance = useCallback(async () => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
      const bal = await provider.getBalance(address);
      setEthBalance(Number(ethers.formatEther(bal)));
    } catch {
      setEthBalance(0);
    }
  }, [address]);

  // Fetch ETH balance on Mainnet for bridge detection
  const fetchMainnetEthBalance = useCallback(async () => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider("https://ethereum.publicnode.com");
      const bal = await provider.getBalance(address);
      setMainnetEthBalance(Number(ethers.formatEther(bal)));
    } catch {
      setMainnetEthBalance(0);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    void fetchEthBalance();
    void fetchMainnetEthBalance();
    const id = setInterval(() => {
      void refetchBalance();
      void fetchEthBalance();
      void fetchMainnetEthBalance();
    }, 15000);
    return () => clearInterval(id);
  }, [address, refetchBalance, fetchEthBalance, fetchMainnetEthBalance]);

  // Read GBLIN price via quoteSell
  const { data: quoteData } = useReadContract({
    contract: gblinContract,
    method: "function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)",
    params: [ethers.parseEther("1")],
  });

  // Fetch ETH price + FX rate together
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ethRes = await fetch(
          "https://coins.llama.fi/prices/current/ethereum:0x0000000000000000000000000000000000000000?searchWidth=4h"
        );
        if (ethRes.ok) {
          const data = await ethRes.json();
          const price = data.coins?.["ethereum:0x0000000000000000000000000000000000000000"]?.price;
          if (price) setEthPriceUsd(price);
        }
      } catch {}

      // Fetch FX rate from CoinGecko simple endpoint (free, no key needed)
      if (currencyConfig.fxKey !== null) {
        try {
          const fxRes = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${currencyConfig.code.toLowerCase()}`
          );
          if (fxRes.ok) {
            const data = await fxRes.json();
            const rate = data["usd-coin"]?.[currencyConfig.code.toLowerCase()];
            if (rate) setFxRate(rate);
          }
        } catch {}
      } else {
        setFxRate(1);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 120000);
    return () => clearInterval(interval);
  }, [currencyConfig]);

  // Resolve custom token address
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
      try {
        const provider = getProvider();
        const tokenContract = new ethers.Contract(nextAddress, ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'], provider);
        const [symbol, decimals] = await Promise.all([tokenContract.symbol(), tokenContract.decimals()]);
        if (!cancelled) {
          setResolvedCustomToken({ symbol, decimals: Number(decimals), address: nextAddress, isNative: false });
        }
      } catch {
        if (!cancelled) setResolvedCustomToken(null);
      }
    };
    void resolveToken();
    return () => { cancelled = true; };
  }, [customTokenAddress, getProvider, selectedToken]);

  // Calculate quote for buy/sell
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

        if (tradeMode === 'buy') {
          if (!activeTradeToken) {
            setQuote('Token required');
            setRawQuote(0n);
            setUsdValue('$0.00');
            return;
          }

          if (activeTradeToken.isNative) {
            const wethAmount = ethers.parseEther(amount);
            const effectiveGblinOut = await quoteMintFromWeth(wethAmount);
            setRawQuote(effectiveGblinOut);
            setQuote(parseFloat(ethers.formatEther(effectiveGblinOut)).toFixed(4));
            setUsdValue(`$${(Number.parseFloat(amount) * ethPriceUsd).toFixed(2)}`);
          } else {
            setQuote('Use ETH for trading');
            setRawQuote(0n);
            setUsdValue('$0.00');
          }
        } else {
          // Sell mode
          const gblinAmount = ethers.parseEther(amount);
          const ethOut: bigint = await contract.quoteSellGBLIN(gblinAmount).catch(() => 0n);
          console.log('[Quote] Sell quote:', { gblinAmount: amount, ethOut: ethOut.toString(), ethOutFormatted: ethers.formatEther(ethOut) });

          if (redeemOption === 'basket') {
            const basketQuote = formatBasketRedeemQuote(Number.parseFloat(amount));
            setRawQuote(gblinAmount);
            setQuote(basketQuote?.summary ?? 'Basket unavailable');
            setUsdValue(`$${(Number.parseFloat(ethers.formatEther(ethOut)) * ethPriceUsd).toFixed(2)}`);
          } else {
            setRawQuote(ethOut);
            setQuote(parseFloat(ethers.formatEther(ethOut)).toFixed(6));
            setUsdValue(`$${(Number.parseFloat(ethers.formatEther(ethOut)) * ethPriceUsd).toFixed(2)}`);
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
  }, [activeTradeToken, amount, ethPriceUsd, formatBasketRedeemQuote, getProvider, quoteMintFromWeth, redeemOption, tradeMode]);

  const balance = useMemo(() => {
    if (!balanceData) return 0;
    return parseFloat(ethers.formatEther(balanceData));
  }, [balanceData]);

  // Input balance display (computed after balance is defined)
  const inputBalanceDisplay = useMemo(() => {
    if (tradeMode === 'sell') return balance.toFixed(4);
    return activeTradeToken?.isNative ? String(ethBalance) : tokenBalance;
  }, [activeTradeToken, balance, ethBalance, tokenBalance, tradeMode]);

  // Execute trade function
  const executeTrade = useCallback(async () => {
    if (!account || !address) return;

    if (!amount || Number.parseFloat(amount) <= 0) {
      setTradeError('Enter a valid amount.');
      return;
    }

    if (tradeMode === 'buy' && !activeTradeToken) {
      setTradeError('Select a valid input token.');
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
      if (tradeMode === 'buy') {
        if (!activeTradeToken?.isNative) {
          throw new Error('Only ETH is supported for buy');
        }

        const ethAmount = ethers.parseEther(amount);
        const quotedGblinOut = await quoteMintFromWeth(ethAmount);
        const minAmountOut = (quotedGblinOut * (10000n - slippageBps)) / 10000n;

        const buyTx = prepareContractCall({
          contract: {
            client: thirdwebClient,
            chain: thirdwebChain,
            address: CONTRACT_ADDRESS as `0x${string}`,
          },
          method: "function buyGBLIN(uint256 minGblinOut) payable",
          params: [minAmountOut],
          value: ethAmount,
        });

        await new Promise<void>((resolve, reject) => {
          sendTx(buyTx, {
            onSuccess: (data) => {
              setTradeTxHash(data.transactionHash);
              resolve();
            },
            onError: (err: Error) => reject(err),
          });
        });
      } else {
        // Sell mode
        const gblinAmount = ethers.parseEther(amount);
        console.log('[executeTrade] Sell mode:', { redeemOption, gblinAmount: amount, rawQuote: rawQuote.toString() });

        if (redeemOption === 'basket') {
          console.log('[executeTrade] Calling redeemInKind (basket)');
          const sellTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: thirdwebChain,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function redeemInKind(uint256 gblinAmount)",
            params: [gblinAmount],
          });

          await new Promise<void>((resolve, reject) => {
            sendTx(sellTx, {
              onSuccess: (data) => {
                setTradeTxHash(data.transactionHash);
                resolve();
              },
              onError: (err: Error) => reject(err),
            });
          });
        } else {
          console.log('[executeTrade] Calling sellGBLIN (ETH only)');
          const sellTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: thirdwebChain,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function sellGBLIN(uint256 minEthOut)",
            params: [(rawQuote * (10000n - slippageBps)) / 10000n],
          });

          await new Promise<void>((resolve, reject) => {
            sendTx(sellTx, {
              onSuccess: (data) => {
                setTradeTxHash(data.transactionHash);
                resolve();
              },
              onError: (err: Error) => reject(err),
            });
          });
        }
      }
    } catch (err: any) {
      setTradeError(err?.message ?? 'Transaction failed');
    } finally {
      setIsTransacting(false);
    }
  }, [account, address, activeTradeToken, amount, quoteMintFromWeth, rawQuote, redeemOption, slippage, tradeMode, sendTx]);

  const gblinPriceUsd = useMemo(() => {
    if (!quoteData) return 0;
    return parseFloat(ethers.formatEther(quoteData)) * ethPriceUsd;
  }, [quoteData, ethPriceUsd]);

  const balanceUsd = balance * gblinPriceUsd;

  // Selector map for identifying tx type from input data
  const REBALANCE_SELECTOR = ethers.id("incentivizedRebalance(uint256,bool,uint256)").slice(0, 10).toLowerCase();
  const BUY_SELECTORS = new Set([
    ethers.id("buyGBLIN(uint256)").slice(0, 10).toLowerCase(),
    ethers.id("buyGBLINWithToken(bytes,uint256,uint256,uint256)").slice(0, 10).toLowerCase(),
    ethers.id("mintInKind(uint256)").slice(0, 10).toLowerCase(),
  ]);
  const SELL_SELECTORS = new Set([
    ethers.id("sellGBLIN(uint256)").slice(0, 10).toLowerCase(),
    ethers.id("sellGBLINForEth(uint256,uint256)").slice(0, 10).toLowerCase(),
    ethers.id("sellGBLINForToken(uint256,address,uint24,uint256)").slice(0, 10).toLowerCase(),
    ethers.id("redeemInKind(uint256)").slice(0, 10).toLowerCase(),
  ]);

  // Fetch user transactions via Moralis (ERC-20 transfers + contract txs for rebalance)
  useEffect(() => {
    if (!address) return;
    const fetchTxs = async () => {
      setLoadingTx(true);
      try {
        const headers = { accept: "application/json", "X-API-Key": MORALIS_API_KEY };
        const erc20Url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=base&contract_addresses=${CONTRACT_ADDRESS}&order=DESC&limit=25`;
        const contractTxUrl = `https://deep-index.moralis.io/api/v2.2/${address}?chain=base&order=DESC&limit=25&to_address=${CONTRACT_ADDRESS}`;

        const [erc20Res, contractRes] = await Promise.all([
          fetch(erc20Url, { headers }),
          fetch(contractTxUrl, { headers }),
        ]);

        // Build map: hash → { erc20Amount, timestamp, type from input }
        const txMap = new Map<string, { hash: string; amount: number; timestamp: number; type: Transaction["type"] }>();

        if (contractRes.ok) {
          const data = await contractRes.json();
          for (const tx of (data.result || [])) {
            const selector = tx.input?.slice(0, 10)?.toLowerCase();
            const ts = new Date(tx.block_timestamp).getTime();
            let type: Transaction["type"] = "buy";
            if (selector === REBALANCE_SELECTOR) type = "rebalance" as Transaction["type"];
            else if (SELL_SELECTORS.has(selector)) type = "sell";
            else if (BUY_SELECTORS.has(selector)) type = "buy";
            else continue; // skip unrelated txs
            txMap.set(tx.hash, { hash: tx.hash, amount: 0, timestamp: ts, type });
          }
        }

        if (erc20Res.ok) {
          const data = await erc20Res.json();
          for (const tx of (data.result || [])) {
            const amount = parseFloat(ethers.formatUnits(tx.value, 18));
            const ts = new Date(tx.block_timestamp).getTime();
            const hash = tx.transaction_hash;
            const existing = txMap.get(hash);
            if (existing) {
              existing.amount = amount;
            } else {
              const isIncoming = tx.to_address?.toLowerCase() === address.toLowerCase();
              const type: Transaction["type"] = isIncoming
                ? tx.from_address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? "buy" : "transfer_in"
                : tx.to_address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? "sell" : "transfer_out";
              txMap.set(hash, { hash, amount, timestamp: ts, type });
            }
          }
        }

        const txs: Transaction[] = Array.from(txMap.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((tx) => ({
            hash: tx.hash,
            type: tx.type,
            amount: tx.amount.toFixed(4),
            valueUsd: (tx.amount * gblinPriceUsd).toFixed(2),
            time: new Date(tx.timestamp).toLocaleString(),
            timestamp: tx.timestamp,
          }));

        setTransactions(txs);
      } catch {}
      finally { setLoadingTx(false); }
    };
    fetchTxs();
  }, [address, gblinPriceUsd]);

  const handleDisconnect = () => { if (wallet) wallet.disconnect(); };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showSuccess = (hash: string) => {
    setTxHash(hash);
    setTxSuccess(t("account.txSuccess"));
    setTimeout(() => { setTxSuccess(null); setTxHash(null); }, 8000);
  };

  const handleSell = () => {
    if (!address || !sellAmount) return;
    const amount = parseFloat(sellAmount);
    if (isNaN(amount) || amount <= 0) return;
    const tx = prepareContractCall({
      contract: gblinContract,
      method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external",
      params: [ethers.parseEther(sellAmount), 0n],
    });
    sendTx(tx, {
      onSuccess: (data: any) => {
        showSuccess(data?.transactionHash ?? "");
        setSellAmount("");
        refetchBalance();
      },
      onError: () => {},
    });
  };

  const handleTransfer = () => {
    setTransferError(null);
    if (!address || !transferAmount || !transferAddress) {
      setTransferError(t("account.errorMissingFields"));
      return;
    }
    if (!transferAddress.startsWith("0x") || transferAddress.length !== 42) {
      setTransferError(t("account.errorInvalidAddress"));
      return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError(t("account.errorInvalidAmount"));
      return;
    }
    const tx = prepareContractCall({
      contract: gblinContract,
      method: "function transfer(address to, uint256 amount) external",
      params: [transferAddress as `0x${string}`, ethers.parseEther(transferAmount)],
    });
    sendTx(tx, {
      onSuccess: (data: any) => {
        showSuccess(data?.transactionHash ?? "");
        setTransferAmount("");
        setTransferAddress("");
        refetchBalance();
      },
      onError: () => setTransferError(t("account.errorTxFailed")),
    });
  };

  // ─── TABS (always visible) ─────────────────────────────────────────────────
  const tabs = [
    { key: "overview", label: t("account.tabOverview"), icon: Wallet },
    { key: "buy",      label: t("account.tabBuy"),      icon: Coins },
    { key: "sell",     label: t("account.tabSell"),     icon: TrendingUp },
    { key: "send",     label: t("account.tabSend"),     icon: ArrowRight },
  ] as const;

  return (
    <div className="min-h-screen bg-[#040404] text-white selection:bg-amber-500/30 selection:text-amber-100">
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: "url('https://raw.githubusercontent.com/rubbe89/gblin-assets/main/TheGoldenVault.png')" }}
      />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#050505_0%,#050505_100%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020202]/80 backdrop-blur-xl">
        <div className={`${shellContainer} flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8`}>
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-amber-500/20 bg-black/40">
              <img alt="GBLIN" className="h-full w-full object-cover" src={LOGO_URL} />
            </span>
            <p className="bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 bg-clip-text font-serif text-xl font-bold tracking-tight text-transparent">GBLIN</p>
          </Link>
          <div className="flex items-center gap-2">
            {address ? (
              <>
                <button
                  onClick={copyAddress}
                  className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 sm:inline-flex"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                  <span className="text-zinc-300">{shortenAddress(address)}</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("account.disconnect")}</span>
                </button>
              </>
            ) : (
              <ConnectButton
                client={thirdwebClient}
                wallets={wallets}
                theme="dark"
                connectButton={{ label: t("account.connect") }}
                connectModal={{
                  size: "wide",
                  title: t("account.loginHeadline"),
                  showThirdwebBranding: false,
                }}
              />
            )}
            <Link className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10" href="/">
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </div>
      </header>

      <main className={`${shellContainer} px-4 py-8 sm:px-6 lg:px-8`}>

        {/* ── CONNECT BANNER (not connected) ────────────────────────────────── */}
        {!address && (
          <div className={`${shellCard} mb-6 overflow-hidden relative`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            <div className="flex flex-col items-center gap-5 p-8 sm:p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <img alt="GBLIN" className="h-full w-full object-cover" src={LOGO_URL} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{t("account.loginHeadline")}</h2>
                <p className="mt-2 text-zinc-400">{t("account.loginSubheadline")}</p>
              </div>
              <ConnectButton
                client={thirdwebClient}
                wallets={wallets}
                theme="dark"
                connectButton={{ label: t("account.connect") }}
                connectModal={{
                  size: "wide",
                  title: t("account.loginHeadline"),
                  showThirdwebBranding: false,
                }}
              />
              <p className="text-xs text-zinc-600">{t("account.poweredBy")} <span className="text-zinc-500">Thirdweb · Base</span></p>
            </div>
          </div>
        )}

        {/* ── BALANCE HERO CARD ───────────────────────────────────────────────────── */}
        <div className={`${shellCard} mb-6 overflow-hidden`}>
          <div className="bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-6 sm:p-10">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{t("account.yourBalance")}</p>
            <div className="mt-3 flex items-end gap-3">
              <h2 className={`text-5xl font-bold tabular-nums sm:text-6xl ${!address ? "text-zinc-600" : "text-white"}`}>
                {address ? formatLocal(balanceUsd) : "—"}
              </h2>
            </div>
            <p className="mt-2 text-lg text-zinc-400">
              {address
                ? <>{balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} GBLIN{gblinPriceUsd > 0 && <span className="ml-3 text-sm text-zinc-500">· {t("account.pricePerToken")}: {formatLocal(gblinPriceUsd)}</span>}</>
                : <span className="text-zinc-600">{t("account.loginHeadline") || "Connetti wallet per vedere il saldo"}</span>
              }
            </p>
          </div>
        </div>

        {/* ── TABS ──────────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── SUCCESS BANNER ────────────────────────────────────────────────── */}
        {txSuccess && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-emerald-100">
            <p className="font-semibold">{txSuccess}</p>
            {txHash && (
              <a className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-white" href={`https://basescan.org/tx/${txHash}`} rel="noreferrer" target="_blank">
                {t("account.viewOnExplorer")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Transaction history */}
            <div className={`${shellCard} p-6`}>
              <h3 className="mb-5 text-lg font-semibold text-white">{t("account.transactions")}</h3>
              {loadingTx ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-zinc-400">{t("account.noTransactions")}</p>
                  <button
                    onClick={() => setActiveTab("buy")}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
                  >
                    <Coins className="h-4 w-4" />
                    {t("account.tabBuy")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const isIn = tx.type === "buy" || tx.type === "transfer_in";
                    const label =
                      tx.type === "buy" ? t("account.typeBuy") :
                      tx.type === "sell" ? t("account.typeSell") :
                      tx.type === "rebalance" ? "Rebalance" :
                      tx.type === "transfer_in" ? t("account.typeTransferIn") :
                      t("account.typeTransferOut");
                    return (
                      <a
                        key={tx.hash}
                        href={`https://basescan.org/tx/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 transition hover:bg-white/[0.06]"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            tx.type === "rebalance" ? "bg-amber-500/15 text-amber-400" :
                            isIn ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                          }`}>
                            {tx.type === "buy" ? <Coins className="h-4 w-4" /> :
                             tx.type === "sell" ? <TrendingUp className="h-4 w-4 rotate-180" /> :
                             tx.type === "rebalance" ? <RefreshCw className="h-4 w-4" /> :
                             <ArrowRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">{label}</p>
                            <p className="text-xs text-zinc-500">{tx.time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            tx.type === "rebalance" ? "text-amber-400" :
                            isIn ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {tx.type === "rebalance" ? "swap" : (isIn ? "+" : "-") + tx.amount + " GBLIN"}
                          </p>
                          <p className="text-xs text-zinc-500">≈ {formatLocal(parseFloat(tx.valueUsd))}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Address card */}
            <div className={`${shellCard} p-5`}>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">{t("account.walletAddress")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-white/5 px-3 py-2.5 text-sm text-zinc-200">{address}</code>
                <button
                  onClick={copyAddress}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-amber-500/20 hover:text-amber-300"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("account.addressCopied") : t("account.copy")}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{t("account.shareAddressHint")}</p>
            </div>
          </div>
        )}

        {/* ── BUY TAB ───────────────────────────────────────────────────────── */}
        {activeTab === "buy" && (() => {
          const numVal = parseFloat(buyAmount) || 0;
          // gblinQty: how many GBLIN the user wants to buy
          // If currency mode, convert local currency → USD first, then → GBLIN
          const numValUsd = buyInputMode === "currency" && fxRate > 0 ? numVal / fxRate : numVal;
          const gblinQty = buyInputMode === "gblin"
            ? numVal
            : gblinPriceUsd > 0 ? numValUsd / gblinPriceUsd : 0;
          // ethValue: how much ETH to send
          const ethValue = gblinPriceUsd > 0 && ethPriceUsd > 0
            ? gblinQty * gblinPriceUsd / ethPriceUsd
            : 0;
          const hasAmount = numVal > 0 && gblinQty > 0 && ethValue > 0;

          return (
            <div className="space-y-5">

              {/* ── Sub-tabs: Card vs Wallet ── */}
              <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1">
                <button
                  onClick={() => setBuyMode("card")}
                  className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
                    buyMode === "card" ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  💳 Carta
                </button>
                <button
                  onClick={() => setBuyMode("wallet")}
                  className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
                    buyMode === "wallet" ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  🔐 Wallet — Ho già crypto
                </button>
              </div>

              {/* ── CARD MODE: Simple 2-step for beginners ── */}
              {buyMode === "card" && (
                <div className={`${shellCard} p-6 sm:p-8`}>
                  <div className="mb-6 text-center">
                    <h3 className="mb-2 text-2xl font-bold text-white">Acquista GBLIN con Carta</h3>
                    <p className="text-zinc-400">Semplice e veloce. Inserisci l'importo e paga con carta.</p>
                  </div>

                  <div className="mx-auto max-w-md space-y-6">
                    {/* Step 1: Enter amount */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-300">Quanto vuoi spendere?</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="100"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-white placeholder-zinc-500 outline-none ring-amber-500/20 transition focus:border-amber-500 focus:ring-2"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-amber-400">
                          EUR
                        </span>
                      </div>
                      {hasAmount && (
                        <p className="mt-2 text-sm text-zinc-400">
                          Riceverai circa <span className="font-semibold text-amber-300">{gblinQty.toFixed(4)} GBLIN</span>
                        </p>
                      )}
                    </div>

                    {/* Step 2: Automatic flow detection */}
                    {hasAmount ? (
                      (() => {
                        const requiredEth = ethValue * 1.02;
                        const hasMainnetEth = mainnetEthBalance >= requiredEth * 0.8; // 80% tolerance
                        const hasBaseEth = ethBalance >= requiredEth;

                        // Step 3: Has Base ETH -> Buy GBLIN directly
                        if (hasBaseEth) {
                          return (
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                                <p className="text-sm text-emerald-200">
                                  <span className="font-semibold">Pronto!</span> Hai {ethBalance.toFixed(4)} ETH su Base
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  if (!account) return;
                                  const tx = prepareContractCall({
                                    contract: gblinContract,
                                    method: "function buyGBLIN(uint256 minGblinOut)",
                                    params: [ethers.parseEther((gblinQty * 0.98).toFixed(18))],
                                    value: ethers.parseEther(requiredEth.toFixed(18)),
                                  });
                                  await sendTx(tx);
                                }}
                                disabled={isSending}
                                className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                              >
                                {isSending ? "Acquisto in corso..." : `Acquista ${gblinQty.toFixed(4)} GBLIN`}
                              </button>
                            </div>
                          );
                        }

                        // Step 2: Has Mainnet ETH but not Base -> Bridge to Base
                        if (hasMainnetEth) {
                          return (
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                                <p className="text-sm text-amber-200">
                                  <span className="font-semibold">Passo 2:</span> Trasferisci ETH su Base
                                </p>
                                <p className="mt-1 text-xs text-amber-300/80">
                                  Hai {mainnetEthBalance.toFixed(4)} ETH su Mainnet. Trasferiscili su Base per completare l'acquisto.
                                </p>
                              </div>
                              <BridgeWidget
                                client={thirdwebClient}
                                theme="dark"
                                currency="EUR"
                                swap={{
                                  prefill: {
                                    sellToken: {
                                      chainId: 1, // Ethereum Mainnet
                                      amount: (ethValue * 1.05).toFixed(4),
                                    },
                                    buyToken: {
                                      chainId: 8453, // Base
                                      tokenAddress: CONTRACT_ADDRESS, // GBLIN
                                    },
                                  },
                                }}
                              />
                              <p className="text-xs text-zinc-500">
                                Il bridge convertirà automaticamente i tuoi ETH in GBLIN su Base.
                              </p>
                            </div>
                          );
                        }

                        // Step 1: No ETH -> Buy on Mainnet with card
                        return (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                              <p className="text-sm text-amber-200">
                                <span className="font-semibold">Passo 1:</span> Acquista ETH con carta
                              </p>
                              <p className="mt-1 text-xs text-amber-300/80">
                                L'ETH verrà acquistato su Ethereum Mainnet e poi trasferito su Base.
                              </p>
                            </div>
                            <PayEmbed
                              key={`card-${buyAmount}`}
                              client={thirdwebClient}
                              theme="dark"
                              payOptions={{
                                mode: "fund_wallet",
                                prefillBuy: {
                                  chain: ethereum,
                                  amount: String((ethValue * 1.05).toFixed(4)),
                                },
                                buyWithFiat: {
                                  prefillSource: {
                                    currency: "EUR",
                                  },
                                  preferredProvider: "transak",
                                },
                              }}
                            />
                            <p className="text-xs text-zinc-500">
                              Dopo l'acquisto, il sistema rileverà automaticamente gli ETH e ti guiderà al passo successivo.
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                        <p className="text-zinc-500">Inserisci un importo per iniziare</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── WALLET MODE: Full buy-gblin interface for advanced users ── */}
              {buyMode === "wallet" && (
                <BuyView
                  t={t}
                  mode={tradeMode}
                  setMode={setTradeMode}
                  amount={amount}
                  setAmount={setAmount}
                  slippage={slippage}
                  setSlippage={setSlippage}
                  quote={quote}
                  usdValue={usdValue}
                  isLoadingQuote={isLoadingQuote}
                  isTransacting={isTransacting}
                  isTradeDisabled={isTransacting || !amount || Number.parseFloat(amount) <= 0 || (tradeMode === 'buy' && !activeTradeToken) || (redeemOption !== 'basket' && rawQuote <= 0n)}
                  executeTrade={executeTrade}
                  tradeError={tradeError}
                  tradeTxHash={tradeTxHash}
                  ethBalance={String(ethBalance)}
                  gblinBalance={balance.toFixed(4)}
                  inputBalance={inputBalanceDisplay}
                  isConnected={!!account}
                  address={address}
                  openWallet={() => {}}
                  disconnectWallet={() => {}}
                  copyContract={() => {}}
                  copied={false}
                  marketData={{ priceUsd: gblinPriceUsd, ethPriceUsd, volume24h: 0, change24h: 0, txCount: 0 }}
                  onChainData={{ nav: `$${(gblinPriceUsd * balance).toFixed(2)}`, ...onChainData }}
                  basketData={[]}
                  lastYieldDistribution={0}
                  discountPercentage={0}
                  isMarketLoading={false}
                  isOnChainLoading={false}
                  isTransactionsLoading={false}
                  transactions={[]}
                  logs={[]}
                  refreshAllData={() => {}}
                  buyTokenOptions={buyTokenOptions}
                  customTokenAddress={customTokenAddress}
                  quoteAssetLabel={quoteAssetLabel}
                  redeemOption={redeemOption}
                  resolvedTokenSymbol={resolvedTokenSymbol}
                  selectedToken={selectedToken}
                  setCustomTokenAddress={setCustomTokenAddress}
                  setRedeemOption={setRedeemOption}
                  setSelectedToken={setSelectedToken}
                  tokenBalance={tokenBalance}
                />
              )}
            </div>
          );
        })()}

        {/* ── SELL TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "sell" && (
          <div className={`${shellCard} p-6 sm:p-8`}>
            <h3 className="mb-1 text-2xl font-bold text-white">{t("account.sellTitle")}</h3>
            <p className="mb-6 text-zinc-400">{t("account.sellDesc")}</p>

            <div className="mx-auto max-w-md space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">{t("account.sellAmount")}</label>
                  <button
                    onClick={() => setSellAmount(balance.toFixed(4))}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Max: {balance.toFixed(2)} GBLIN
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={balance}
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg text-white placeholder-zinc-600 outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-medium text-zinc-400">GBLIN</span>
                </div>
                {sellAmount && parseFloat(sellAmount) > 0 && gblinPriceUsd > 0 && (
                  <p className="mt-2 text-sm text-zinc-400">
                    {t("account.sellReceive")}: <span className="font-semibold text-emerald-300">{formatLocal(parseFloat(sellAmount) * gblinPriceUsd)}</span>
                  </p>
                )}
              </div>

              <button
                onClick={handleSell}
                disabled={isSending || !sellAmount || parseFloat(sellAmount) <= 0 || parseFloat(sellAmount) > balance}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-6 py-4 text-base font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isSending ? <><RefreshCw className="h-5 w-5 animate-spin" />{t("account.processing")}</> : <><TrendingUp className="h-5 w-5 rotate-180" />{t("account.sellBtn")}</>}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-zinc-400">{t("account.sellNote")}</p>
            </div>
          </div>
        )}

        {/* ── SEND TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "send" && (
          <div className={`${shellCard} p-6 sm:p-8`}>
            <h3 className="mb-1 text-2xl font-bold text-white">{t("account.sendTitle")}</h3>
            <p className="mb-6 text-zinc-400">{t("account.sendDesc")}</p>

            {/* My address - share to receive */}
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-amber-400">{t("account.yourAddressToShare")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-200">{shortenAddress(address ?? "")}</code>
                <button
                  onClick={copyAddress}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-500/30"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {t("account.copy")}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t("account.shareAddressHint")}</p>
            </div>

            <div className="mx-auto max-w-md space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">{t("account.recipient")}</label>
                <input
                  type="text"
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  placeholder={t("account.recipientPlaceholder")}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
                />
                <p className="mt-1.5 text-xs text-zinc-500">{t("account.recipientHint")}</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">{t("account.sendAmount")}</label>
                  <button onClick={() => setTransferAmount(balance.toFixed(4))} className="text-xs text-amber-400 hover:text-amber-300">
                    Max: {balance.toFixed(2)} GBLIN
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg text-white placeholder-zinc-600 outline-none focus:border-blue-500/60"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-medium text-zinc-400">GBLIN</span>
                </div>
                {transferAmount && parseFloat(transferAmount) > 0 && gblinPriceUsd > 0 && (
                  <p className="mt-2 text-sm text-zinc-400">
                    ≈ <span className="font-semibold text-blue-300">{formatLocal(parseFloat(transferAmount) * gblinPriceUsd)}</span>
                  </p>
                )}
              </div>

              {transferError && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {transferError}
                </div>
              )}

              <button
                onClick={handleTransfer}
                disabled={isSending || !transferAddress || !transferAmount || parseFloat(transferAmount) <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-base font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isSending ? <><RefreshCw className="h-5 w-5 animate-spin" />{t("account.processing")}</> : <><ArrowRight className="h-5 w-5" />{t("account.sendBtn")}</>}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-zinc-400">{t("account.sendNote")}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
