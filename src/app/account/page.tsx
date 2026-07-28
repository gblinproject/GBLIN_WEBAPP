"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDER_CODE_SUFFIX } from "@/lib/builder-code";
import Link from "next/link";
import {
  WagmiProvider,
  useAccount,
  useDisconnect,
  useReadContract,
  useSendTransaction as useWagmiSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base } from "wagmi/chains";
import { parseAbi } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { lifiEvmProvider } from "@/lib/lifi-evm";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import { WalletManagementProviders, useWalletMenu } from "@lifi/wallet-management";
import LifiBuyWidget from "@/components/LifiBuyWidget";
import { ArrowRight, Wallet, TrendingUp, Coins, X as LogOut, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  MORALIS_API_KEY,
  shortenAddress,
  LOGO_URL,
  TRADE_TOKEN_OPTIONS,
  GBLIN_ABI,
  ERC20_ABI,
  RPC_URL,
  USDC_ADDRESS,
  WETH_ADDRESS,
  quoteTokenToWeth,
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

// Human-readable ABIs for direct wagmi/viem writes (single wallet stack)
const GBLIN_WRITE_ABI = parseAbi([
  "function buyGBLIN(uint256 minGblinOut) payable",
  "function buyGBLINWithToken(bytes path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut)",
  "function sellGBLIN(uint256 gblinAmount)",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
// User clicked "Reject" in the wallet — not an error, just a cancelled action.
function isUserRejection(msg: string): boolean {
  return /user rejected|user denied|rejected the request|denied transaction|action_rejected|code.*4001/i.test(msg);
}

const ERC20_APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// Connect button: opens the OFFICIAL LI.FI wallet menu (same modal as the
// widget) — every installed EIP-6963 wallet, MetaMask, Coinbase Wallet, with
// proper UI. Connection lands in the shared wagmi config, so the page AND the
// LI.FI widget see the same session.
function WalletConnect({ label }: { label: string }) {
  const { openWalletMenu } = useWalletMenu();
  return (
    <button
      onClick={() => openWalletMenu()}
      className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
    >
      <Wallet className="h-4 w-4" />
      {label}
    </button>
  );
}

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

// Shared providers: ONE wagmi config for the whole page — the LI.FI widget
// auto-detects it (WagmiContext above -> external context) and reuses the
// same wallet connection. One stack, one connect, one wallet popup.
const queryClient = new QueryClient();

// MUI theme for the LI.FI wallet menu (its modal reads theme.breakpoints and
// theme.vars — it CRASHES without a cssVariables theme in context; that crash
// during SSR was the /account 500).
const lifiMuiTheme = createTheme({
  cssVariables: true,
  palette: { mode: "dark" },
});

export default function AccountPage() {
  // Client-only gate: wagmi connectors + the LI.FI wallet menu touch
  // window/IndexedDB and MUI media queries that break Next SSR (500 on
  // GET /account). Render nothing on the server, mount everything client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MuiThemeProvider theme={lifiMuiTheme}>
          {/* LI.FI wallet management: powers the official wallet menu AND creates
              the external EVM context (with the EIP-5792 kill switch) that the
              LI.FI widget detects and reuses — one wallet session everywhere. */}
          <WalletManagementProviders providers={[lifiEvmProvider]}>
            <AccountPageInner />
          </WalletManagementProviders>
        </MuiThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function AccountPageInner() {
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

  // Single wallet stack: wagmi (shared with the LI.FI widget via WagmiProvider)
  const { address: wagmiAddress } = useAccount();
  const account = useMemo(() => (wagmiAddress ? { address: wagmiAddress } : undefined), [wagmiAddress]);
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { writeContractAsync, isPending: isSending } = useWriteContract();
  const { sendTransactionAsync } = useWagmiSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  // Ensure Base before any direct contract write (MetaMask may sit on Ethereum)
  const ensureBase = useCallback(async () => {
    try { await switchChainAsync({ chainId: base.id }); } catch { /* already on Base or user handled it */ }
  }, [switchChainAsync]);
  // When set, opens the LI.FI widget modal: pay with any token on any chain,
  // routed to USDC on Base and zapped into GBLIN via buyGBLINInKind.
  const [lifiParams, setLifiParams] = useState<{ usdcAmount: bigint; minGblinOut: bigint } | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "buy" | "send">("overview");
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
  const [coinbaseAddress, setCoinbaseAddress] = useState("");
  const [coinbaseAmount, setCoinbaseAmount] = useState("");
  const [coinbaseSending, setCoinbaseSending] = useState(false);
  const [coinbaseError, setCoinbaseError] = useState<string | null>(null);

  // Advanced trading states for BuyView
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | 'inkind'>('buy');
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

  // Fetch token balance when selected token changes
  useEffect(() => {
    if (!address || !activeTradeToken || activeTradeToken.isNative) {
      setTokenBalance('0.0000');
      return;
    }
    const provider = getProvider();
    const tokenContract = new ethers.Contract(activeTradeToken.address, ERC20_ABI, provider);
    tokenContract.balanceOf(address)
      .then((bal: bigint) => setTokenBalance(parseFloat(ethers.formatUnits(bal, activeTradeToken.decimals)).toFixed(4)))
      .catch(() => setTokenBalance('0.0000'));
  }, [address, activeTradeToken, getProvider]);

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
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
    chainId: base.id,
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
      const provider = new ethers.JsonRpcProvider("https://cloudflare-eth.com");
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
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: parseAbi(["function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)"]),
    functionName: "quoteSellGBLIN",
    args: [ethers.parseEther("1")],
    chainId: base.id,
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
    const interval = setInterval(() => { if (typeof document === "undefined" || !document.hidden) fetchPrices(); }, 300000);
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
            // Non-ETH token: quote via quoteTokenToWeth then quoteMintFromWeth
            const provider = getProvider();
            const amountIn = ethers.parseUnits(amount, activeTradeToken.decimals);
            const routeQuote = await quoteTokenToWeth(provider, activeTradeToken.address, amountIn);
            if (!routeQuote || routeQuote.amountOut <= 0n) {
              setQuote('No route');
              setRawQuote(0n);
              setUsdValue('$0.00');
            } else {
              const effectiveGblinOut = await quoteMintFromWeth(routeQuote.amountOut);
              setRawQuote(effectiveGblinOut);
              setQuote(parseFloat(ethers.formatEther(effectiveGblinOut)).toFixed(4));
              const wethValue = parseFloat(ethers.formatEther(routeQuote.amountOut)) * ethPriceUsd;
              setUsdValue(`$${wethValue.toFixed(2)}`);
            }
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
    if (tradeMode === 'sell') return balance.toFixed(6);
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
        // SMART ROUTING (founder request): if the funds are ALREADY on Base,
        // buy directly from the wallet — no LI.FI, no bridge fee, instant.
        // Priority: native ETH -> WETH -> USDC (all via the proven on-chain
        // paths). Anything else (other tokens, other chains) -> LI.FI widget.
        // `amount` is ETH-denominated by the form math.
        const ethAmount = ethers.parseEther(amount);
        const quotedGblinOut = await quoteMintFromWeth(ethAmount);
        const minAmountOut = (quotedGblinOut * (10000n - slippageBps)) / 10000n;
        const usdValue = parseFloat(amount) * ethPriceUsd;
        const provider = getProvider();

        // 1) Native ETH on Base. Margin = gas only (~$0.02-0.06 on Base): the
        // tx sends exactly ethAmount and minGblinOut already guards the price,
        // so no % buffer. The old 1% + 0.0001 ETH margin (~$0.20) wrongly sent
        // users with "just enough" ETH to LI.FI for a pointless same-chain swap.
        if (ethBalance >= parseFloat(amount) + 0.00003) {
          await ensureBase();
          const hash = await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: GBLIN_WRITE_ABI,
            functionName: 'buyGBLIN',
            args: [minAmountOut],
            value: ethAmount,
            chainId: base.id,
          });
          setTradeTxHash(hash);
          return;
        }

        // Shared ERC20 path: approve (if needed) + buyGBLINWithToken.
        // Full mint mechanics (keeper reserve + diversification + NAV accretion),
        // proven on-chain by the first LI.FI purchase.
        const buyWithErc20 = async (token: `0x${string}`, amountIn: bigint, path: `0x${string}`) => {
          await ensureBase();
          const erc = new ethers.Contract(token, ERC20_ABI, provider);
          const allowance: bigint = await erc.allowance(address, CONTRACT_ADDRESS).then((v: unknown) => BigInt(String(v))).catch(() => 0n);
          if (allowance < amountIn) {
            const approveHash = await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
              address: token,
              abi: ERC20_APPROVE_ABI,
              functionName: 'approve',
              args: [CONTRACT_ADDRESS as `0x${string}`, amountIn],
              chainId: base.id,
            });
            await provider.waitForTransaction(approveHash, 1, 60000);
          }
          const hash = await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: GBLIN_WRITE_ABI,
            functionName: 'buyGBLINWithToken',
            args: [path, amountIn, 0n, minAmountOut],
            chainId: base.id,
          });
          setTradeTxHash(hash);
        };
        const balanceOf = async (token: string): Promise<bigint> => {
          try {
            const erc = new ethers.Contract(token, ERC20_ABI, provider);
            return BigInt(String(await erc.balanceOf(address)));
          } catch { return 0n; }
        };
        const encodePath = (a: string, fee: number, b: string) => ethers.hexlify(ethers.concat([
          ethers.getBytes(a), ethers.getBytes(ethers.toBeHex(fee, 3)), ethers.getBytes(b),
        ])) as `0x${string}`;

        // 2) WETH on Base (dummy WETH path -> contract skips the internal swap)
        const wethBal = await balanceOf(WETH_ADDRESS);
        if (wethBal >= ethAmount) {
          await buyWithErc20(WETH_ADDRESS as `0x${string}`, ethAmount, encodePath(WETH_ADDRESS, 0, WETH_ADDRESS));
          return;
        }

        // 3) USDC on Base (USDC -> WETH 0.05% pool; +0.3% buffer for the pool fee)
        const usdcNeeded = BigInt(Math.max(1, Math.round(usdValue * 1.003 * 1e6)));
        const usdcBal = await balanceOf(USDC_ADDRESS);
        if (usdcBal >= usdcNeeded) {
          await buyWithErc20(USDC_ADDRESS as `0x${string}`, usdcNeeded, encodePath(USDC_ADDRESS, 500, WETH_ADDRESS));
          return;
        }

        // 4) Everything else (any token, any chain, incl. cbBTC on Base) -> LI.FI
        const usdcAmount = BigInt(Math.max(1, Math.round(usdValue * 1e6)));
        setLifiParams({ usdcAmount, minGblinOut: minAmountOut });
        return;
      } else {
        // Sell: direct wagmi write on Base (opens ONLY the user's wallet — no
        // third-party modal). sellGBLIN = in-kind basket redeem; default =
        // sellGBLINForEth with explicit slippage floor.
        // Fail fast with a HUMAN message when there is no ETH for gas on Base
        // (a raw viem "gas required exceeds allowance (0)" is unreadable).
        if (ethBalance < 0.00001) {
          setTradeError(
            'You need a little ETH on Base to pay gas (a few cents are enough). ' +
            'Withdraw ETH from any exchange choosing the Base network, then retry.'
          );
          return;
        }
        await ensureBase();
        const gblinAmount = ethers.parseEther(amount);
        const hash = redeemOption === 'basket'
          ? await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: GBLIN_WRITE_ABI,
              functionName: 'sellGBLIN',
              args: [gblinAmount],
              chainId: base.id,
            })
          : await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: GBLIN_WRITE_ABI,
              functionName: 'sellGBLINForEth',
              args: [gblinAmount, (rawQuote * (10000n - slippageBps)) / 10000n],
              chainId: base.id,
            });
        setTradeTxHash(hash);
      }
    } catch (err: any) {
      const msg: string = err?.message ?? 'Transaction failed';
      if (isUserRejection(msg)) {
        // The user cancelled in the wallet: no scary red wall of viem text.
        setTradeError('Transaction cancelled.');
      } else if (msg.includes('gas required exceeds allowance')) {
        setTradeError('Not enough ETH on Base to pay gas (a few cents are enough). Withdraw ETH to Base from any exchange, then retry.');
      } else {
        // Keep only the first meaningful line of the viem error, not the dump.
        setTradeError(msg.split('\n')[0].slice(0, 300));
      }
    } finally {
      setIsTransacting(false);
    }
  }, [account, address, activeTradeToken, amount, quoteMintFromWeth, rawQuote, redeemOption, slippage, tradeMode, writeContractAsync, ensureBase, ethPriceUsd, ethBalance, getProvider]);

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
    ethers.id("buyGBLINInKind(address,uint256,uint256)").slice(0, 10).toLowerCase(), // V6 in-kind
    ethers.id("mintInKind(uint256)").slice(0, 10).toLowerCase(),                     // V5 legacy
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
          // Filtro esplicito: SOLO transazioni verso il contratto corrente (V6).
          // I selettori (sellGBLINForEth, buyGBLIN…) sono identici tra V5 e V6, quindi senza
          // questo controllo le vecchie tx V5 passavano (Moralis non sempre rispetta to_address).
          if (tx.to_address?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
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
          // Solo trasferimenti del token V6 (Moralis a volte ignora contract_addresses).
          if (tx.address && tx.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
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

  const handleDisconnect = () => { wagmiDisconnect(); };

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

  // (legacy handleSell for the removed sell tab deleted — selling goes through
  // executeTrade with wagmi writes)

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
    (async () => {
      try {
        await ensureBase();
        const hash = await writeContractAsync({ dataSuffix: BUILDER_CODE_SUFFIX,
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: GBLIN_WRITE_ABI,
          functionName: "transfer",
          args: [transferAddress as `0x${string}`, ethers.parseEther(transferAmount)],
          chainId: base.id,
        });
        showSuccess(hash);
        setTransferAmount("");
        setTransferAddress("");
        refetchBalance();
      } catch (err: any) {
        const msg: string = err?.message ?? '';
        setTransferError(isUserRejection(msg) ? 'Transaction cancelled.' : t("account.errorTxFailed"));
      }
    })();
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
  // Sell tab removed from UI — effect kept inert to avoid large refactor of dependent state.
  useEffect(() => {
    if (false && ethBalance > 0.0001) {
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
      // Sell tab was removed from UI — keep Transak flow intact by redirecting to buy tab.
      setActiveTab("buy");
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
      // Verify order is still active before sending ETH
      const statusRes = await fetch(`/api/transak-order-status?orderId=${transakOrder.orderId}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const orderStatus = statusData?.status as string | undefined;
        const blocked = ["EXPIRED", "CANCELLED", "FAILED", "REFUNDED"];
        if (orderStatus && blocked.includes(orderStatus.toUpperCase())) {
          throw new Error(`Ordine Transak ${orderStatus} — non inviare ETH. Crea un nuovo ordine.`);
        }
      }

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
      await ensureBase();
      await sendTransactionAsync({
        to: transakOrder.walletAddress as `0x${string}`,
        value: amountWei,
        chainId: base.id,
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

  // Send ETH to Coinbase deposit address
  const sendEthToCoinbase = useCallback(async () => {
    if (!account) return;
    setCoinbaseError(null);
    if (!coinbaseAddress || !/^0x[a-fA-F0-9]{40}$/.test(coinbaseAddress)) {
      setCoinbaseError(t("account.errorInvalidAddress") || "Indirizzo non valido");
      return;
    }
    const amount = parseFloat(coinbaseAmount);
    if (!amount || amount <= 0) {
      setCoinbaseError(t("account.errorInvalidAmount") || "Importo non valido");
      return;
    }
    if (amount >= ethBalance) {
      setCoinbaseError(t("account.errorInsufficientEth") || "Importo superiore al saldo (considera il gas)");
      return;
    }
    setCoinbaseSending(true);
    try {
      const amountWei = ethers.parseEther(amount.toFixed(18));
      await ensureBase();
      await sendTransactionAsync({
        to: coinbaseAddress as `0x${string}`,
        value: amountWei,
        chainId: base.id,
      });
      setCoinbaseAddress("");
      setCoinbaseAmount("");
      fetchEthBalance();
      setTxSuccess(t("account.coinbaseSendSuccess") || "ETH inviati con successo! Controlla il tuo account Coinbase.");
    } catch (err) {
      console.error("[coinbase-send] error:", err);
      setCoinbaseError(err instanceof Error ? err.message : "Invio fallito");
    } finally {
      setCoinbaseSending(false);
    }
  }, [account, coinbaseAddress, coinbaseAmount, ethBalance, fetchEthBalance, t]);

  // ─── TABS (always visible) ─────────────────────────────────────────────────
  // Trade tab label maps to "Compra / Vendi" (IT) and equivalents per language
  const tradeTabLabel = ({
    it: "Compra / Vendi",
    en: "Buy / Sell",
    es: "Comprar / Vender",
    fr: "Acheter / Vendre",
    de: "Kaufen / Verkaufen",
    zh: "买入 / 卖出",
    ja: "購入 / 売却",
  } as Record<Language, string>)[language] ?? "Buy / Sell";

  const tabs = [
    { key: "overview", label: t("account.tabOverview"), icon: Wallet },
    { key: "buy",      label: tradeTabLabel,            icon: Coins },
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
        <div className={`${shellContainer} flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8`}>
          <Link className="flex shrink-0 items-center gap-2 sm:gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-amber-500/20 bg-black/40 sm:h-10 sm:w-10">
              <img alt="GBLIN" className="h-full w-full object-cover" src={LOGO_URL} />
            </span>
            <p className="bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 bg-clip-text font-serif text-lg font-bold tracking-tight text-transparent sm:text-xl">GBLIN</p>
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
              <WalletConnect label={t("account.connect")} />
            )}
            <Link
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-zinc-300 transition hover:bg-white/10 sm:px-3 sm:py-2.5"
              href="/"
              aria-label={t('account.homeButton')}
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">{t('account.homeButton')}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className={`${shellContainer} px-3 py-6 sm:px-6 sm:py-8 lg:px-8`}>

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
              <WalletConnect label={t("account.connect")} />
              <p className="text-xs text-zinc-600">{t("account.poweredBy")} <span className="text-zinc-500">LI.FI · Base</span></p>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT (connected only) ───────────────────────────────────── */}
        {address && (
          <>
            {/* ── BALANCE HERO CARD ─────────────────────────────────────────── */}
        <div className={`${shellCard} mb-6 overflow-hidden`}>
          <div className="bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-5 sm:p-10">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 sm:tracking-[0.28em]">{t("account.yourBalance")}</p>
            <div className="mt-3 flex items-end gap-3">
              <h2 className={`break-all text-4xl font-bold tabular-nums sm:text-6xl ${!address ? "text-zinc-600" : "text-white"}`}>
                {address ? formatLocal(balanceUsd) : "—"}
              </h2>
            </div>
            <p className="mt-2 text-lg text-zinc-400">
              {address
                ? <>{balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} GBLIN{gblinPriceUsd > 0 && <span className="ml-3 text-sm text-zinc-500">· {t("account.pricePerToken")}: {formatLocal(gblinPriceUsd)}</span>}</>
                : <span className="text-zinc-600">{t("account.loginHeadline") || "Connetti wallet per vedere il saldo"}</span>
              }
            </p>
          </div>
        </div>

        {/* ── TABS ──────────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-3 gap-2">
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


              {/* ── WALLET MODE: only path now ── */}
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
                  gblinBalance={balance.toFixed(6)}
                  inputBalance={inputBalanceDisplay}
                  isConnected={!!account}
                  address={address}
                  openWallet={() => {}}
                  disconnectWallet={() => {}}
                  copyContract={() => {}}
                  copied={false}
                  marketData={{ priceUsd: gblinPriceUsd, ethPriceUsd, volume24h: 0, change24h: 0, txCount: 0 }}
                  onChainData={{
                    ...onChainData,
                    // Real on-chain NAV per token: quoteSellGBLIN(1 GBLIN) in ETH
                    // (read from the vault) x live ETH price. The old audit
                    // replaced a FAKE value with a dash; this is the honest one.
                    nav: gblinPriceUsd > 0
                      ? `$${gblinPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—',
                  }}
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
            </div>
          );
        })()}


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
                  <button onClick={() => setTransferAmount(balance.toFixed(6))} className="text-xs text-amber-400 hover:text-amber-300">
                    Max: {balance.toFixed(4)} GBLIN
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

      {/* LI.FI widget — pay for a GBLIN buy with any token on any chain */}
      {lifiParams && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4"
          onClick={() => setLifiParams(null)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <LifiBuyWidget
              usdcAmount={lifiParams.usdcAmount}
              minGblinOut={lifiParams.minGblinOut}
            />
            <button
              onClick={() => setLifiParams(null)}
              className="mt-3 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800"
            >
              {t("account.cancel") || "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
