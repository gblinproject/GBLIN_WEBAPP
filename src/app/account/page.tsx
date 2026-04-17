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
import { getContract, prepareContractCall, sendTransaction as sendTxDirect } from "thirdweb";
import { ethereum } from "thirdweb/chains";
import { ArrowRight, Wallet, TrendingUp, Coins, X as LogOut, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
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
  const [cardWizardStep, setCardWizardStep] = useState<1 | 2 | 3 | null>(null); // null = auto-detect based on balances
  const [step3EthAmount, setStep3EthAmount] = useState<string>("");
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [isBridging, setIsBridging] = useState<boolean>(false);
  const [bridgeTimeLeft, setBridgeTimeLeft] = useState<number>(60);
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);
  const [waitingForEth, setWaitingForEth] = useState<boolean>(false);
  const [mainnetBalanceBefore, setMainnetBalanceBefore] = useState<number>(0);
  const [showQrScanner, setShowQrScanner] = useState<boolean>(false);
  const [showMyQr, setShowMyQr] = useState<boolean>(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [sellStep, setSellStep] = useState<"redeem" | "offramp">("redeem");
  const [sellRedeemDone, setSellRedeemDone] = useState<boolean>(false);
  const [transakOrder, setTransakOrder] = useState<{
    orderId: string;
    walletAddress: string;
    cryptoAmount: string;
    cryptoCurrency: string;
    fiatAmount: string;
    fiatCurrency: string;
    network: string;
  } | null>(null);
  const [transakSending, setTransakSending] = useState(false);

  // Advanced trading states for BuyView
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [resolvedCustomToken, setResolvedCustomToken] = useState<TradeTokenOption | null>(null);
  const [redeemOption, setRedeemOption] = useState<'eth' | 'basket'>('eth');

  // Debug: log redeemOption changes
  useEffect(() => {
    console.log('[redeemOption] Changed to:', redeemOption);
  }, [redeemOption]);
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
        // Sell mode - v3 FIX 2024-01-12: Use sellGBLINForEth (swaps to ETH) instead of sellGBLIN (basket)
        const gblinAmount = ethers.parseEther(amount);
        const currentRedeemOption = redeemOption; // Capture current value
        console.log('[executeTrade] Sell mode v2:', { currentRedeemOption, gblinAmount: amount, rawQuote: rawQuote.toString(), timestamp: Date.now() });

        if (currentRedeemOption === 'basket') {
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
          console.log('[executeTrade] Calling sellGBLINForEth (ETH only) v2');
          // Use sellGBLINForEth with explicit slippage instead of sellGBLIN
          const minEthOut = (rawQuote * (10000n - slippageBps)) / 10000n;
          console.log('[executeTrade] minEthOut:', minEthOut.toString());
          const sellTx = prepareContractCall({
            contract: {
              client: thirdwebClient,
              chain: thirdwebChain,
              address: CONTRACT_ADDRESS as `0x${string}`,
            },
            method: "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
            params: [gblinAmount, minEthOut],
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
  const fetchTransactions = useCallback(async () => {
    if (!address) return;
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
  }, [address, gblinPriceUsd]);

  // Auto-fetch transactions on mount/address change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Monitor transaction completion for Step 3
  useEffect(() => {
    if (pendingTx && !isSending) {
      // Transaction completed
      setPendingTx(false);
      setStep3EthAmount("");
      showSuccess("Transazione completata!");
      // Refresh transactions after a delay to allow Moralis to index
      setTimeout(() => fetchTransactions(), 3000);
    }
  }, [pendingTx, isSending, fetchTransactions]);

  // Auto-detect wizard step based on balances when no manual step is set
  // Step 3: has ETH on Base → buy GBLIN directly (min $0.50 worth)
  // Step 2: has ETH on Mainnet → bridge to Base (ignore dust < $0.50)
  // Step 1: no ETH → buy with card
  const MAINNET_DUST_THRESHOLD = ethPriceUsd > 0 ? 0.5 / ethPriceUsd : 0.0002; // Ignore dust < $0.50 on Mainnet
  const BASE_MIN_THRESHOLD = ethPriceUsd > 0 ? 0.5 / ethPriceUsd : 0.0002; // Min $0.50 on Base to show Step 3
  const autoDetectedStep = ethBalance > BASE_MIN_THRESHOLD ? 3 : mainnetEthBalance > MAINNET_DUST_THRESHOLD ? 2 : 1;
  const effectiveStep = cardWizardStep ?? autoDetectedStep;

  // Auto-fill max ETH amount when entering Step 3
  useEffect(() => {
    if (effectiveStep === 3 && ethBalance > BASE_MIN_THRESHOLD) {
      // Delay to ensure balance is fresh after bridge (3 seconds)
      const timeout = setTimeout(() => {
        // Refetch to get latest balance
        fetchEthBalance();
        // Reserve 0.00002 ETH (~$0.05) for gas fees on Base
        const gasReserve = 0.00002;
        const maxEth = Math.max(0, ethBalance - gasReserve);
        setStep3EthAmount(maxEth.toFixed(6));
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [effectiveStep, ethBalance, BASE_MIN_THRESHOLD, fetchEthBalance]);

  // Bridge timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBridging && bridgeStatus === 'processing' && bridgeTimeLeft > 0) {
      interval = setInterval(() => {
        setBridgeTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer expired
            setBridgeStatus('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBridging, bridgeStatus, bridgeTimeLeft]);

  // Poll for ETH arrival after purchase (Step 1 → Step 2)
  useEffect(() => {
    if (!waitingForEth) return;

    let checkCount = 0;
    const maxChecks = 30; // 2 minutes max (30 * 4 seconds)

    const interval = setInterval(async () => {
      checkCount++;
      await fetchMainnetEthBalance();

      // Check if balance increased
      if (mainnetEthBalance > mainnetBalanceBefore + MAINNET_DUST_THRESHOLD) {
        setWaitingForEth(false);
        setCardWizardStep(2);
        showSuccess(t("account.ethArrivedProceedBridge"));
        clearInterval(interval);
      } else if (checkCount >= maxChecks) {
        // Timeout after 2 minutes
        setWaitingForEth(false);
        showSuccess(t("account.checkBalanceClickBridge"));
        clearInterval(interval);
      }
    }, 4000); // Check every 4 seconds

    return () => clearInterval(interval);
  }, [waitingForEth, mainnetEthBalance, mainnetBalanceBefore, fetchMainnetEthBalance, MAINNET_DUST_THRESHOLD, t]);

  // Monitor bridge success (when balance changes during bridging)
  useEffect(() => {
    if (isBridging && bridgeStatus === 'processing') {
      // Check if ETH arrived on Base
      if (ethBalance > 0 && mainnetEthBalance < 0.001) {
        // Bridge likely succeeded
        setBridgeStatus('success');
        setIsBridging(false);
        showSuccess(t("account.bridgeCompleted"));
        // Auto-advance to step 3
        setTimeout(() => setCardWizardStep(3), 2000);
      }
    }
  }, [ethBalance, mainnetEthBalance, isBridging, bridgeStatus, t]);

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
        setSellRedeemDone(true);
        refetchBalance();
        fetchEthBalance();
      },
      onError: () => {},
    });
  };

  const [transakLoading, setTransakLoading] = useState(false);
  const [transakError, setTransakError] = useState<string | null>(null);

  const openTransakOfframp = useCallback(async () => {
    if (!address) return;
    setTransakLoading(true);
    setTransakError(null);
    // Open window immediately (synchronous, within user gesture) to avoid popup blocker
    const newWindow = window.open("about:blank", "_blank");
    try {
      const res = await fetch("/api/transak-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, cryptoAmount: ethBalance > 0 ? ethBalance : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (!data.widgetUrl) {
        throw new Error("No widgetUrl returned");
      }
      if (newWindow) {
        newWindow.location.href = data.widgetUrl;
      } else {
        // Fallback if popup was still blocked
        window.location.href = data.widgetUrl;
      }
    } catch (err) {
      console.error("[transak] offramp error:", err);
      setTransakError(err instanceof Error ? err.message : "Errore Transak");
      if (newWindow) newWindow.close();
    } finally {
      setTransakLoading(false);
    }
  }, [address, ethBalance]);

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

  // ─── QR Scanner ────────────────────────────────────────────────────────────
  const startQrScanner = useCallback(async () => {
    setShowQrScanner(true);
    // Small delay to ensure the DOM element is rendered
    await new Promise((r) => setTimeout(r, 300));
    try {
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract address from ethereum: URI or plain address
          const addr = decodedText.startsWith("ethereum:")
            ? decodedText.replace("ethereum:", "").split("@")[0]
            : decodedText;
          if (addr.startsWith("0x") && addr.length === 42) {
            setTransferAddress(addr);
            stopQrScanner();
          }
        },
        () => {} // ignore errors (no QR found yet)
      );
    } catch (err) {
      console.error("QR scanner error:", err);
      setShowQrScanner(false);
    }
  }, []);

  const stopQrScanner = useCallback(async () => {
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    setShowQrScanner(false);
    if (scanner) {
      try {
        const state = scanner.getState();
        if (state === 2) { // SCANNING
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // Already stopped or cleared — ignore
      }
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;
      if (scanner) {
        try {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Auto-detect sell step: if user has ETH on Base, jump to off-ramp
  useEffect(() => {
    if (activeTab === "sell" && ethBalance > 0.0001) {
      setSellStep("offramp");
      setSellRedeemDone(true);
    }
  }, [activeTab, ethBalance]);

  // Intercept Transak wallet redirection (redirect back with order params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    const walletAddr = params.get("walletAddress");
    const cryptoAmt = params.get("cryptoAmount");
    if (orderId && walletAddr && cryptoAmt) {
      setTransakOrder({
        orderId,
        walletAddress: walletAddr,
        cryptoAmount: cryptoAmt,
        cryptoCurrency: params.get("cryptoCurrency") || "ETH",
        fiatAmount: params.get("fiatAmount") || "",
        fiatCurrency: params.get("fiatCurrency") || "EUR",
        network: params.get("network") || "BASE",
      });
      setActiveTab("sell");
      setSellStep("offramp");
      // Clean URL without reload
      window.history.replaceState({}, "", "/account");
    }
  }, []);

  // Send ETH to Transak deposit address
  const confirmTransakTransfer = useCallback(async () => {
    if (!transakOrder || !account) return;
    setTransakSending(true);
    try {
      // Reserve gas: if the requested amount equals (or exceeds) our balance, subtract a gas buffer
      const GAS_BUFFER = 0.00005; // ~0.00005 ETH for Base L2 gas
      let sendAmount = parseFloat(transakOrder.cryptoAmount);
      if (sendAmount >= ethBalance) {
        sendAmount = ethBalance - GAS_BUFFER;
      }
      if (sendAmount <= 0) {
        throw new Error("Insufficient ETH balance to cover gas fees");
      }
      const amountWei = ethers.parseEther(sendAmount.toFixed(18));
      await sendTxDirect({
        transaction: {
          client: thirdwebClient,
          chain: thirdwebChain,
          to: transakOrder.walletAddress,
          value: amountWei,
        } as any,
        account,
      });
      setTransakOrder(null);
      setTransakError(null);
      fetchEthBalance();
      setTxSuccess(t("account.transakTransferSuccess") || "ETH inviati a Transak! Riceverai EUR sul tuo conto.");
    } catch (err) {
      console.error("[transak] transfer error:", err);
      setTransakError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransakSending(false);
    }
  }, [transakOrder, account, ethBalance, fetchEthBalance, t]);

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
            <Link className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-white/10" href="/">
              <ArrowRight className="h-4 w-4 rotate-180" />
              <span>{t('account.homeButton')}</span>
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

        {/* ── MAIN CONTENT (connected only) ───────────────────────────────────── */}
        {address && (
          <>
            {/* ── BALANCE HERO CARD ─────────────────────────────────────────── */}
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
              <a className="mt-1 inline-flex items-center gap-1 text-emerald-300 hover:text-white" href={`https://basescan.org/tx/${txHash}`} rel="noreferrer" target="_blank">
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

        {/* ── BUY TAB ──────────────────────────────────────────────────────── */}
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
                  {t('account.cardMode')}
                </button>
                <button
                  onClick={() => setBuyMode("wallet")}
                  className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
                    buyMode === "wallet" ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t('account.walletMode')}
                </button>
              </div>

              {/* ── CARD MODE: Simple 2-step for beginners ── */}
              {buyMode === "card" && (
                <div className={`${shellCard} p-6 sm:p-8`}>
                  <div className="mb-6 text-center">
                    <h3 className="mb-2 text-2xl font-bold text-white">{t('account.buyWithCard')}</h3>
                    <p className="text-zinc-400">{t('account.buySimpleDesc')}</p>
                  </div>

                  <div className="mx-auto max-w-md space-y-6">
                    {/* Step 1: Enter amount — only show when on Step 1 (no ETH yet) */}
                    {effectiveStep === 1 && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300">{t('account.howMuchToSpend')}</label>
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
                            {t('account.youWillReceiveAbout')} <span className="font-semibold text-amber-300">{gblinQty.toFixed(4)} GBLIN</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Step 2/3: Automatic flow detection */}
                    {(hasAmount || ethBalance > 0 || mainnetEthBalance > MAINNET_DUST_THRESHOLD) ? (
                      (() => {
                        // Use the globally computed effectiveStep
                        const activeStep = effectiveStep;

                        return (
                          <div className="space-y-4">
                            {/* Visual Wizard Steps - Clickable for manual navigation */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                              <div className="flex items-center justify-between">
                                {/* Step 1 - Clickable */}
                                <button
                                  onClick={() => setCardWizardStep(1)}
                                  className={`flex flex-col items-center gap-2 transition-colors ${activeStep === 1 ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${activeStep === 1 ? 'border-amber-500 bg-amber-500/20' : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'}`}>
                                    <span className="text-sm font-bold">1</span>
                                  </div>
                                  <span className="text-xs font-medium">{t('account.step1Label')}</span>
                                </button>
                                {/* Connector */}
                                <div className={`h-0.5 w-12 ${activeStep >= 2 ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                                {/* Step 2 - Clickable */}
                                <button
                                  onClick={() => setCardWizardStep(2)}
                                  className={`flex flex-col items-center gap-2 transition-colors ${activeStep === 2 ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${activeStep === 2 ? 'border-amber-500 bg-amber-500/20' : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'}`}>
                                    <span className="text-sm font-bold">2</span>
                                  </div>
                                  <span className="text-xs font-medium">{t('account.step2Label')}</span>
                                </button>
                                {/* Connector */}
                                <div className={`h-0.5 w-12 ${activeStep >= 3 ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                                {/* Step 3 - Clickable */}
                                <button
                                  onClick={() => setCardWizardStep(3)}
                                  className={`flex flex-col items-center gap-2 transition-colors ${activeStep === 3 ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${activeStep === 3 ? 'border-amber-500 bg-amber-500/20' : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'}`}>
                                    <span className="text-sm font-bold">3</span>
                                  </div>
                                  <span className="text-xs font-medium">{t('account.step3Label')}</span>
                                </button>
                              </div>
                            </div>

                        {/* Step 3: Buy GBLIN — simplified UI for neofiti */}
                        {activeStep === 3 && (
                          <div className="space-y-4">
                            {/* Wallet balance */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('account.ethAvailable')}</p>
                                <p className="mt-2 text-lg font-semibold text-white">{ethBalance.toFixed(6)} ETH</p>
                                <p className="mt-1 text-xs text-zinc-500">≈ ${(ethBalance * ethPriceUsd).toFixed(2)}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{t('account.gblinInWallet')}</p>
                                <p className="mt-2 text-lg font-semibold text-white">{balance.toFixed(4)} GBLIN</p>
                                <p className="mt-1 text-xs text-zinc-500">≈ ${(balance * gblinPriceUsd).toFixed(2)}</p>
                              </div>
                            </div>

                            {/* ETH amount input with max pre-filled */}
                            <div className="rounded-[24px] border border-amber-500/20 bg-black/20 px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={step3EthAmount}
                                  onChange={(e) => setStep3EthAmount(e.target.value.replace(',', '.'))}
                                  placeholder="0.000000"
                                  className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-zinc-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Reserve 0.00002 ETH (~$0.05) for gas fees on Base
                                    const gasReserve = 0.00002;
                                    const maxEth = Math.max(0, ethBalance - gasReserve);
                                    setStep3EthAmount(maxEth.toFixed(6));
                                  }}
                                  className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20"
                                >
                                  {t('account.maxButton')}
                                </button>
                                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300">ETH</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
                                <span>
                                  {(() => {
                                    const ethAmt = parseFloat(step3EthAmount) || 0;
                                    const usdVal = ethAmt * ethPriceUsd;
                                    const gblinEst = gblinPriceUsd > 0 ? (usdVal / gblinPriceUsd) : 0;
                                    return ethAmt > 0 ? `≈ $${usdVal.toFixed(2)} · ≈ ${gblinEst.toFixed(4)} GBLIN` : '';
                                  })()}
                                </span>
                              </div>
                            </div>

                            {/* Buy button */}
                            <button
                              onClick={async () => {
                                if (!account) return;
                                const ethAmt = parseFloat(step3EthAmount);
                                if (!ethAmt || ethAmt <= 0) return;
                                try {
                                  setPendingTx(true);
                                  const ethAmount = ethers.parseEther(ethAmt.toFixed(18));
                                  const quotedGblinOut = await quoteMintFromWeth(ethAmount);
                                  if (quotedGblinOut <= 0n) {
                                    throw new Error("Importo troppo piccolo - la quota GBLIN è zero. Prova con più ETH.");
                                  }
                                  // 5% slippage for small amounts to ensure success
                                  const minAmountOut = (quotedGblinOut * 9500n) / 10000n;
                                  const tx = prepareContractCall({
                                    contract: gblinContract,
                                    method: "function buyGBLIN(uint256 minGblinOut) payable",
                                    params: [minAmountOut],
                                    value: ethAmount,
                                  });
                                  // Send directly without thirdweb confirmation modal
                                  const result = await sendTxDirect({ transaction: tx, account });
                                  console.log("Buy GBLIN tx:", result.transactionHash);
                                  // Wait 2 seconds for BaseScan indexing
                                  await new Promise(resolve => setTimeout(resolve, 2000));
                                  showSuccess(t("account.txSuccess"));
                                  setTxHash(result.transactionHash);
                                  setTxSuccess(t("account.txSuccess"));
                                  setPendingTx(false);
                                  setStep3EthAmount("");
                                  setTimeout(() => fetchTransactions(), 3000);
                                } catch (err: any) {
                                  setPendingTx(false);
                                  console.error("Buy GBLIN error:", err);
                                  alert(err.message || t("account.errorTxFailed"));
                                }
                              }}
                              disabled={pendingTx || !step3EthAmount || parseFloat(step3EthAmount) <= 0}
                              className="w-full rounded-full bg-amber-400 px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
                            >
                              {pendingTx ? `${t('account.txInProgress')}` : `${t('account.buyGblinButton')} →`}
                            </button>

                            {/* Success message */}
                            {txSuccess && (
                              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                                <p className="font-semibold">{t('account.txSuccessMessage')}</p>
                                {txHash && (
                                  <a className="mt-2 inline-flex items-center gap-2 text-emerald-200 hover:text-white" href={`https://basescan.org/tx/${txHash}`} rel="noreferrer" target="_blank">
                                    {t('account.viewOnExplorer')} <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 2: Bridge ETH to Base */}
                        {activeStep === 2 && (
                          <>
                            {/* Bridge Progress Modal */}
                            {isBridging && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                                <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-900 p-8 text-center">
                                  {bridgeStatus === 'processing' && (
                                    <>
                                      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-500/30">
                                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
                                      </div>
                                      <h3 className="mb-2 text-xl font-bold text-white">{t('account.txInProgress')}</h3>
                                      <p className="text-zinc-400">{t('account.dontClosePage')}</p>
                                      <div className="mt-6">
                                        <div className="mb-2 flex justify-between text-sm">
                                          <span className="text-zinc-500">{t('account.maxWait')}</span>
                                          <span className="text-amber-400">{bridgeTimeLeft}s</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-zinc-800">
                                          <div 
                                            className="h-2 rounded-full bg-amber-500 transition-all duration-1000"
                                            style={{ width: `${(60 - bridgeTimeLeft) / 60 * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {bridgeStatus === 'failed' && (
                                    <>
                                      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-500/30">
                                        <span className="text-2xl">❌</span>
                                      </div>
                                      <h3 className="mb-2 text-xl font-bold text-rose-400">{t('account.txFailed')}</h3>
                                      <p className="text-zinc-400">{t('account.retryBridge')}</p>
                                      <button
                                        onClick={() => {
                                          setIsBridging(false);
                                          setBridgeStatus('idle');
                                          setBridgeTimeLeft(60);
                                        }}
                                        className="mt-6 w-full rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400"
                                      >
                                        {t('account.retry')}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                              <p className="text-sm text-amber-200">
                                <span className="font-semibold">{t('account.step2Title')}</span> {t('account.transferEthToBase')}
                              </p>
                              <p className="mt-1 text-xs text-amber-300/80">
                                {t('account.youHaveEthOnMainnet').replace('{{amount}}', mainnetEthBalance.toFixed(4))}
                              </p>
                            </div>
                            <BridgeWidget
                              client={thirdwebClient}
                              theme="dark"
                              swap={{
                                prefill: {
                                  sellToken: {
                                    chainId: 1, // Ethereum Mainnet
                                    // Pre-fill with max amount minus 1% for gas fees
                                    amount: mainnetEthBalance > 0 
                                      ? String((mainnetEthBalance * 0.99).toFixed(6))
                                      : undefined,
                                  },
                                  buyToken: {
                                    chainId: 8453, // Base
                                    tokenAddress: undefined, // ETH only, NO SWAP to GBLIN
                                  },
                                },
                                onSuccess: () => {
                                  setIsBridging(false);
                                  showSuccess(t("account.bridgeCompleted"));
                                  setTimeout(() => setCardWizardStep(3), 2000);
                                },
                                onError: () => {
                                  setBridgeStatus('failed');
                                },
                              }}
                            />
                            <p className="text-xs text-zinc-500">
                              {t('account.bridgeEthDescription')}
                            </p>
                          </>
                        )}

                        {/* Step 1: Buy ETH with card */}
                        {activeStep === 1 && (
                          <>
                            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                              <p className="text-sm font-medium text-rose-300">
                                🔴 <strong>Avviso per utenti EU:</strong> Consigliato Transak, attesa circa 2 minuti.
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
                                },
                                onPurchaseSuccess: (info) => {
                                  console.log("Purchase success:", info);
                                  showSuccess(t("account.ethPurchasedPreparing"));
                                  // Save current balance and start polling for ETH arrival
                                  setMainnetBalanceBefore(mainnetEthBalance);
                                  setWaitingForEth(true);
                                },
                              }}
                            />
                            <p className="text-xs text-zinc-500">
                              {t('account.afterPurchaseDetect')}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                        <p className="text-zinc-500">{t('account.enterAmountToStart')}</p>
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
                  isTradeDisabled={isTransacting || !amount || Number.parseFloat(amount) <= 0 || (tradeMode === 'buy' && !activeTradeToken) || (redeemOption !== 'basket' && !isLoadingQuote && rawQuote <= 0n)}
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

            {/* Step indicator */}
            <div className="mx-auto mb-6 flex max-w-md items-center gap-3">
              <button
                onClick={() => { setSellStep("redeem"); }}
                className={`flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  sellStep === "redeem"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : sellRedeemDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-zinc-500"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  sellRedeemDone ? "bg-emerald-500 text-white" : sellStep === "redeem" ? "bg-rose-500 text-white" : "bg-zinc-700 text-zinc-400"
                }`}>
                  {sellRedeemDone ? "✓" : "1"}
                </span>
                {t("account.sellStep1Label")}
              </button>
              <div className="h-px w-4 bg-zinc-700" />
              <button
                onClick={() => { if (sellRedeemDone || ethBalance > 0) setSellStep("offramp"); }}
                className={`flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  sellStep === "offramp"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-white/10 bg-white/5 text-zinc-500"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  sellStep === "offramp" ? "bg-amber-500 text-white" : "bg-zinc-700 text-zinc-400"
                }`}>
                  2
                </span>
                {t("account.sellStep2Label")}
              </button>
            </div>

            {/* Step 1: Redeem GBLIN → ETH */}
            {sellStep === "redeem" && (
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

                {sellRedeemDone && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-300">{t("account.sellRedeemSuccess")}</p>
                    <p className="mt-1 text-xs text-zinc-400">ETH: {ethBalance.toFixed(6)}</p>
                    <button
                      onClick={() => setSellStep("offramp")}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-400"
                    >
                      <ArrowRight className="h-4 w-4" />
                      {t("account.sellGoToOfframp")}
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-zinc-400">{t("account.sellNote")}</p>
                </div>
              </div>
            )}

            {/* Step 2: Off-ramp ETH → EUR via Transak */}
            {sellStep === "offramp" && (
              <div className="mx-auto max-w-md space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.22em] text-amber-400">{t("account.sellOfframpEthAvailable")}</p>
                  <p className="text-2xl font-bold text-white">{ethBalance.toFixed(6)} <span className="text-base font-normal text-zinc-400">ETH</span></p>
                  {ethBalance > 0 && ethPriceUsd > 0 && (
                    <p className="mt-1 text-sm text-zinc-400">≈ {formatLocal(ethBalance * ethPriceUsd)}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-sm font-semibold text-zinc-200">{t("account.sellOfframpHow")}</p>
                  <ul className="space-y-1.5 text-sm text-zinc-400">
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-400">1.</span>{t("account.sellOfframpStep1")}</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-400">2.</span>{t("account.sellOfframpStep2")}</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-400">3.</span>{t("account.sellOfframpStep3")}</li>
                  </ul>
                </div>

                <button
                  onClick={openTransakOfframp}
                  disabled={ethBalance < 0.00422897 || transakLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  {transakLoading ? (
                    <><RefreshCw className="h-5 w-5 animate-spin" />{t("account.processing")}</>
                  ) : (
                    <><ExternalLink className="h-5 w-5" />{t("account.sellOfframpBtn")}</>
                  )}
                </button>

                {transakError && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                    <p className="text-sm text-rose-300">{transakError}</p>
                  </div>
                )}

                {ethBalance > 0 && ethBalance < 0.00422897 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                    <p className="text-sm text-amber-300">{t("account.sellOfframpMinEth") || "Minimo richiesto da Transak: 0.00422897 ETH"}</p>
                  </div>
                )}

                {ethBalance <= 0 && (
                  <div className="rounded-2xl border border-zinc-500/20 bg-zinc-500/10 p-4 text-center">
                    <p className="text-sm text-zinc-400">{t("account.sellOfframpNoEth")}</p>
                    <button
                      onClick={() => setSellStep("redeem")}
                      className="mt-2 text-sm font-semibold text-rose-400 hover:text-rose-300 transition"
                    >
                      ← {t("account.sellStep1Label")}
                    </button>
                  </div>
                )}

                {address && (
                  <a
                    href={`https://basescan.org/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("account.viewTransactionsBasescan") || "Verifica transazioni su Basescan"}
                  </a>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-zinc-400">{t("account.sellOfframpNote")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SEND TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "send" && (
          <div className={`${shellCard} p-6 sm:p-8`}>
            <h3 className="mb-1 text-2xl font-bold text-white">{t("account.sendTitle")}</h3>
            <p className="mb-6 text-zinc-400">{t("account.sendDesc")}</p>

            {/* My address - QR + copy */}
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-400">{t("account.yourAddressToShare")}</p>
                <button
                  onClick={() => setShowMyQr(!showMyQr)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition hover:bg-amber-500/30"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  {showMyQr ? t("account.hideQr") : t("account.showQr")}
                </button>
              </div>
              {showMyQr && address && (
                <div className="mb-3 flex justify-center">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCodeSVG
                      value={`ethereum:${address}`}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="H"
                      imageSettings={{
                        src: LOGO_URL,
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                      }}
                    />
                  </div>
                </div>
              )}
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={transferAddress}
                    onChange={(e) => setTransferAddress(e.target.value)}
                    placeholder={t("account.recipientPlaceholder")}
                    className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
                  />
                  <button
                    onClick={startQrScanner}
                    className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-300 transition hover:bg-blue-500/20"
                    title={t("account.scanQr")}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">{t("account.recipientHint")}</p>

                {/* QR Scanner Modal */}
                {showQrScanner && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative mx-4 w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-lg font-bold text-white">{t("account.scanQr")}</h4>
                        <button
                          onClick={stopQrScanner}
                          className="rounded-xl bg-white/10 p-2 text-zinc-400 transition hover:bg-white/20 hover:text-white"
                        >
                          <LogOut className="h-5 w-5" />
                        </button>
                      </div>
                      <div id="qr-reader" className="overflow-hidden rounded-2xl" />
                      <p className="mt-3 text-center text-xs text-zinc-500">{t("account.scanQrHint")}</p>
                    </div>
                  </div>
                )}
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
          </>
        )}
      </main>

      {/* Transak Transfer Confirmation Modal */}
      {transakOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-900 p-8">
            <h3 className="mb-4 text-xl font-bold text-white text-center">
              {t("account.transakConfirmTitle") || "Conferma Trasferimento"}
            </h3>
            <p className="mb-6 text-sm text-zinc-400 text-center">
              {t("account.transakConfirmDesc") || "Transak richiede l'invio degli ETH per completare la vendita. Conferma per inviare."}
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between rounded-xl bg-black/30 p-3">
                <span className="text-sm text-zinc-500">Importo</span>
                <span className="text-sm font-semibold text-white">{parseFloat(transakOrder.cryptoAmount).toFixed(6)} {transakOrder.cryptoCurrency}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-black/30 p-3">
                <span className="text-sm text-zinc-500">Riceverai</span>
                <span className="text-sm font-semibold text-emerald-400">{transakOrder.fiatAmount} {transakOrder.fiatCurrency}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-black/30 p-3">
                <span className="text-sm text-zinc-500">Rete</span>
                <span className="text-sm text-white">{transakOrder.network}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-black/30 p-3">
                <span className="text-sm text-zinc-500">Destinazione</span>
                <span className="text-xs text-zinc-300 font-mono">{transakOrder.walletAddress.slice(0, 10)}...{transakOrder.walletAddress.slice(-8)}</span>
              </div>
            </div>

            {transakError && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                <p className="text-sm text-rose-300">{transakError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setTransakOrder(null); setTransakError(null); }}
                disabled={transakSending}
                className="flex-1 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("account.cancel") || "Annulla"}
              </button>
              <button
                onClick={confirmTransakTransfer}
                disabled={transakSending}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {transakSending ? (
                  <span className="flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />{t("account.processing")}</span>
                ) : (
                  t("account.transakConfirmBtn") || "Conferma e Invia"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
