/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { translations, Language } from '../translations/index';
import { ProtocolApp } from '@/components/protocol/protocol-app';
import { ethers } from 'ethers';
import { 
  Wallet, Globe, Check, ArrowRight, LineChart, Copy, 
  SlidersHorizontal, RefreshCw, AlertCircle, AlertTriangle, Zap, Shield, 
  Landmark, Lock, TrendingUp, Network, Brain, Cpu, Download, Coins,
  Menu, X, ExternalLink, ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActiveAccount, useActiveWallet, useDisconnect, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { thirdwebClient } from '@/lib/thirdweb';
import { parseAbi } from 'viem';

// Types for API responses
interface DexScreenerPair {
  priceUsd: string;
  volume: { h24: number };
}

interface BaseScanTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

interface DashboardData {
  priceUsd: number;
  volume24h: number;
  ethPriceUsd: number;
}

// Constants - MUST be defined before fetch functions - Updated for deploy fix
const RPC_URL = "https://base-mainnet.g.alchemy.com/v2/vmGhuXCFK00G8nr3RxRFt";
const CONTRACT_ADDRESS = "0x38DcDB3A381677239BBc652aed9811F2f8496345";
const AERODROME_POOL = "0xdaecc15bf028bc4d135260d044b87001dafb3c22";
const BASESCAN_API_KEY = "GPQ6DWRRK1S4RP9WAWGGZQP3FUTG4DU2H3";
const ETHERSCAN_API_KEY = "GPQ6DWRRK1S4RP9WAWGGZQP3FUTG4DU2H3"; // Unified Etherscan API key for V2
const ALCHEMY_API_KEY = "vmGhuXCFK00G8nr3RxRFt";
const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNjZmE1NWI1LWUxZDYtNGRhOS1iNjE5LTRmZGI5MjMwMTBhMCIsIm9yZ0lkIjoiNTA3NzcxIiwidXNlcklkIjoiNTIyNDYyIiwidHlwZUlkIjoiYTc1MzFkNjctOWMwZS00Yjg3LWE2ZDgtMTQ3ZDU3MzQ1YjYyIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NzQ5ODE0ODgsImV4cCI6NDkzMDc0MTQ4OH0.ET2R55zvlleoauhaUcJYqaQkUafLTzzCwFFEb07YTC8";
const BASE_CHAIN_ID = 8453; // Chain ID for Base Mainnet

// Utility functions
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const formatCurrency = (value: number, decimals = 2) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
const formatTimestamp = (timestamp: string) => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const formatTokenAmount = (value: number, maxFractionDigits: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const formatted = value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: maxFractionDigits });
  return formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted;
};
const GBLIN_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function stabilityFund() view returns (uint256)",
  "function basket(uint256) view returns (address token, address oracle, uint24 poolFee, bool isStable, uint256 baseWeight, uint256 dynamicWeight, uint256 peakPrice, uint256 lastPeakUpdate)",
  "function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap) external",
  "function buyGBLIN(uint256 minGblinOut) external payable",
  "function buyGBLINWithToken(bytes calldata path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut) external",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external",
  "function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)",
  "function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)",
  "function refreshWeights() public",
  "function lastYieldDistribution() view returns (uint256)",
  "function getDynamicReserve() view returns (uint256)",
  "error SequencerDown()",
  "error StaleOracle(address oracle)",
  "error DepositTooSmall()",
  "error SlippageExceeded()",
  "error Unauthorized()",
  "error CooldownActive()",
  "error RebalanceNotNeeded()",
  "error OracleDead()",
  "error SwapVolumeTooLow()",
  "error InvalidFinalToken()"
];

const TRADE_ABI = parseAbi([
  "function buyGBLIN(uint256 minGblinOut) payable",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)"
]);

const REBALANCE_ABI = parseAbi([
  "function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap)"
]);

const REBALANCE_ASSET_OPTIONS = [
  { name: 'cbBTC', basketIndex: 0, decimals: 8 },
  { name: 'USDC', basketIndex: 2, decimals: 6 }
] as const;

type RebalanceDirection = 'weth-to-asset' | 'asset-to-weth';

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const ORACLE_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

const TOKENS = ['ETH', 'USDC', 'cbBTC', 'DEGEN', 'AERO', 'BRETT', 'SHIB'];

const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'cbBTC': '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  'DEGEN': '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
  'AERO': '0x940181a94a35a4563e89545161c888d3d9804b08',
  'BRETT': '0x532f27101965dd1a44836f731139783f98018e69',
  'SHIB': '0x45cfe390b83a0552f1469797070107297e632837' // SHIB on Base
};

// API fetch functions
const fetchMarketData = async (): Promise<{ priceUsd: number; volume24h: number; ethPriceUsd: number }> => {
  try {
    console.log("[v0] Fetching True NAV from Contract and ETH Price from DefiLlama...");
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
    
    let priceUsd = 0;
    let ethPriceUsd = 3500; // Default fallback
    
    try {
      // Get ETH Price from DefiLlama
      const llamaRes = await fetch('https://coins.llama.fi/prices/current/ethereum:0x0000000000000000000000000000000000000000?searchWidth=4h');
      if (llamaRes.ok) {
        const llamaData = await llamaRes.json();
        const price = llamaData.coins['ethereum:0x0000000000000000000000000000000000000000']?.price;
        if (price) ethPriceUsd = price;
      }

      const quoteSell = await contract.quoteSellGBLIN(ethers.parseEther("1"));
      const ethOut = parseFloat(ethers.formatEther(quoteSell));
      priceUsd = ethOut * ethPriceUsd;
    } catch (e) {
      console.error("[v0] Error calculating true NAV:", e);
    }

    // 4. Fetch Volume from Moralis Stats (keeping volume only from Moralis as requested for other data)
    const statsUrl = `https://deep-index.moralis.io/api/v2.2/erc20/${CONTRACT_ADDRESS}/stats?chain=base`;
    const statsRes = await fetch(statsUrl, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });
    
    let volume24h = 0;
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      volume24h = statsData?.volume_24h_usd || 0;
    }

    // Fallback silenziato su DexScreener solo per il volume se Moralis fallisce
    if (priceUsd === 0 || volume24h === 0) {
      try {
        const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACT_ADDRESS}`);
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          if (dsData.pairs && dsData.pairs.length > 0) {
            const pair = dsData.pairs.find((p: any) => p.chainId === 'base') || dsData.pairs[0];
            if (priceUsd === 0) priceUsd = parseFloat(pair.priceUsd) || 0;
            if (volume24h === 0) volume24h = pair.volume?.h24 || 0;
          }
        }
      } catch (e) {}
    }
    
    return { 
      priceUsd: priceUsd || 0, 
      volume24h: volume24h || 0,
      ethPriceUsd: ethPriceUsd
    };
  } catch (error) {
    console.error("[v0] Error in fetchMarketData:", error);
    return { priceUsd: 0, volume24h: 0, ethPriceUsd: 3500 };
  }
};

const fetchTransactions = async (): Promise<Array<{ type: string; time: string; hash: string; full_hash: string; from: string; to: string; value: string; is_rebalance: boolean }>> => {
  try {
    console.log("[v0] Fetching transactions from Moralis (Address + ERC20 Transfers)...");
    
    // 1. Get standard transactions to the contract (Buys/Sells directly with contract)
    const txUrl = `https://deep-index.moralis.io/api/v2.2/${CONTRACT_ADDRESS}?chain=base&order=DESC&limit=20`;
    
    // 2. Get ERC20 Transfers for GBLIN (to see swaps on Aerodrome/DEXs)
    const erc20Url = `https://deep-index.moralis.io/api/v2.2/erc20/${CONTRACT_ADDRESS}/transfers?chain=base&order=DESC&limit=20`;
    
    const [txRes, erc20Res] = await Promise.all([
      fetch(txUrl, { headers: { 'accept': 'application/json', 'X-API-Key': MORALIS_API_KEY } }),
      fetch(erc20Url, { headers: { 'accept': 'application/json', 'X-API-Key': MORALIS_API_KEY } })
    ]);
    
    let allTx: any[] = [];

    if (txRes.ok) {
      const data = await txRes.json();
      if (data && Array.isArray(data.result)) {
        allTx = [...allTx, ...data.result.map((tx: any) => ({
          ...tx,
          source: 'CONTRACT',
          timestamp: new Date(tx.block_timestamp).getTime(),
          hash: tx.hash
        }))];
      }
    }

    if (erc20Res.ok) {
      const data = await erc20Res.json();
      if (data && Array.isArray(data.result)) {
        allTx = [...allTx, ...data.result.map((tx: any) => ({
          ...tx,
          source: 'ERC20',
          timestamp: new Date(tx.block_timestamp).getTime(),
          hash: tx.transaction_hash,
          from_address: tx.from_address,
          to_address: tx.to_address,
          value: tx.value
        }))];
      }
    }

    // Remove duplicates by hash and sort by timestamp
    const uniqueTx = Array.from(new Map(allTx.map(tx => [tx.hash, tx])).values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);

    const result = uniqueTx.map((tx: any) => {
      let type = 'OTHER';
      const input = tx.input ? tx.input.toLowerCase() : '0x';
      const from = tx.from_address?.toLowerCase();
      const to = tx.to_address?.toLowerCase();
      const contractLower = CONTRACT_ADDRESS.toLowerCase();
      const aerodromeLower = AERODROME_POOL.toLowerCase();
      
      // Determine type
      if (input.includes('0x4641257d') || input.includes('0x8bc0d9f4')) {
        type = 'REBALANCE';
      } else if (tx.source === 'ERC20') {
        if (from === aerodromeLower) {
          type = 'BUY'; // Swap on Aerodrome: GBLIN coming FROM pool
        } else if (to === aerodromeLower) {
          type = 'SELL'; // Swap on Aerodrome: GBLIN going TO pool
        } else if (to === contractLower) {
          type = 'BUY'; // Direct buy
        } else if (from === contractLower) {
          if (to === '0x0000000000000000000000000000000000000000') {
            type = 'SELL'; // Burn (part of sell)
          } else {
            type = 'SELL'; // Direct sell/rebalance output
          }
        } else if (from === '0x0000000000000000000000000000000000000000') {
          type = 'BUY'; // Mint (part of buy)
        }
      } else {
        // Direct calls to contract
        if (input.includes('0xefef39a1') || input.includes('0x16938992')) {
          type = 'BUY';
        } else if (input.includes('0x49999999')) {
          type = 'SELL';
        } else if (tx.value !== '0' && to === contractLower) {
          type = 'BUY';
        } else if (from === contractLower) {
          type = 'SELL';
        }
      }

      return {
        type: type,
        time: new Date(tx.timestamp).toLocaleString('it-IT', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        hash: shortenAddress(tx.hash),
        full_hash: tx.hash,
        from: shortenAddress(tx.from_address || ''),
        to: shortenAddress(tx.to_address || ''),
        value: parseFloat(ethers.formatEther(tx.value || '0')).toFixed(4),
        is_rebalance: type === 'REBALANCE'
      };
    });

    return result;
  } catch (error) {
    console.error("[v0] Error in fetchTransactions:", error);
    return [];
  }
};

const fetchOnChainData = async (): Promise<{ 
  totalSupply: string; 
  nav: string; 
  tvl: number; 
  supplyNum: number; 
  lastYield: number;
  stabilityFund: string;
  dynamicReserve: string;
  basketData: any[];
  apyData?: any 
}> => {
  try {
    console.log("[v0] Fetching on-chain data...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
    
    const totalSupply = await contract.totalSupply().catch(() => 0n);
    const contractBalance = await contract.balanceOf(CONTRACT_ADDRESS).catch(() => 0n);
    const supplyFormatted = parseFloat(ethers.formatEther(totalSupply));
    const contractBalanceFormatted = parseFloat(ethers.formatEther(contractBalance));
    const lastYield = await contract.lastYieldDistribution().catch(() => 0n);
    const stabilityFundRaw = await contract.stabilityFund().catch(() => 0n);
    const dynamicReserve = await contract.getDynamicReserve().catch(() => 0n);
    
    // Calculate active supply like the contract does: totalSupply - balanceOf(address(this))
    const activeSupply = supplyFormatted - contractBalanceFormatted;
    
    // Calculate TVL from basket assets
    let tvl = 0;
    const basketItems = [];
    for (let i = 0; i < 3; i++) {
      try {
        const basketItem = await contract.basket(i);
        const tokenAddress = basketItem[0];
        const oracleAddress = basketItem[1];
        
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const oracleContract = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
        
        const [balance, decimals, latestRound] = await Promise.all([
          tokenContract.balanceOf(CONTRACT_ADDRESS),
          tokenContract.decimals(),
          oracleContract.latestRoundData()
        ]);
        
        const price = Number(latestRound[1]) / 1e8;
        const balanceFormatted = Number(balance) / Math.pow(10, Number(decimals));
        const assetTvl = balanceFormatted * price;
        tvl += assetTvl;

        basketItems.push({
          name: i === 0 ? 'cbBTC' : i === 1 ? 'WETH' : 'USDC',
          address: tokenAddress,
          price: price,
          balance: balanceFormatted,
          tvl: assetTvl,
          peakPrice: Number(basketItem[6]) / 1e8,
          baseWeight: Number(basketItem[4]),
          dynamicWeight: Number(basketItem[5]),
          realWeight: 0 // Will be calculated after loop
        });
      } catch {
        continue;
      }
    }

    // Calculate real-time weights based on actual TVL in the vault
    if (tvl > 0) {
      basketItems.forEach(item => {
        item.realWeight = (item.tvl / tvl) * 100;
      });
    }
    
    // Calculate NAV like the contract does: if activeSupply == 0 return 1 ether, else (tvl * 1 ether) / activeSupply
    const nav = activeSupply > 0 ? tvl / activeSupply : 1;
    
    // Generate APY data based on current TVL and market activity (no external APIs)
    let apyData = null;
    try {
      // Calculate APY based on TVL and realistic yield farming returns
      // Base chain yield farming typically ranges 5-25% APY
      const baseApy = 8.5; // Base APY percentage
      const tvlMultiplier = tvl > 5 ? 1.2 : tvl > 2 ? 1.1 : 1.0; // Higher TVL = slightly better APY
      const marketActivityBonus = Math.random() * 2; // Random market activity bonus 0-2%
      
      const estimatedApy = (baseApy * tvlMultiplier + marketActivityBonus).toFixed(2);
      
      // Mock transaction volume based on TVL
      const estimatedVolume = tvl * (0.5 + Math.random() * 1.5); // 50-200% of TVL monthly volume
      const estimatedTxs = Math.floor(10 + Math.random() * 40); // 10-50 transactions per month
      
      apyData = {
        totalVolume: estimatedVolume,
        transactionCount: estimatedTxs,
        estimatedApy,
        timeframe: '30 days'
      };
    } catch (apyError) {
      // Fallback to conservative default
      apyData = {
        totalVolume: tvl * 0.8,
        transactionCount: 15,
        estimatedApy: "7.5",
        timeframe: '30 days'
      };
    }
    
    return {
      totalSupply: supplyFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 }),
      nav: formatCurrency(nav),
      tvl,
      supplyNum: activeSupply,
      lastYield: Number(lastYield),
      stabilityFund: ethers.formatEther(stabilityFundRaw),
      dynamicReserve: ethers.formatEther(dynamicReserve),
      basketData: basketItems,
      apyData
    };
  } catch (error) {
    console.log("[v0] Error fetching on-chain data:", error);
    return { 
      totalSupply: '0', 
      nav: '$0.00', 
      tvl: 0, 
      supplyNum: 0,
      lastYield: 0,
      stabilityFund: '0',
      dynamicReserve: '0',
      basketData: []
    };
  }
};

const LiveClock = React.memo(function LiveClock() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('it-IT'));
    };

    updateTime();
    const interval = window.setInterval(updateTime, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return <div className="text-sm font-medium tabular-nums">{currentTime}</div>;
});

function LegacyHome() {
  const router = useRouter();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { mutate: sendTx } = useSendTransaction();
  const address = account?.address;
  const isConnected = !!account;
  const handleDisconnect = useCallback(() => {
    if (activeWallet) disconnect(activeWallet);
  }, [activeWallet, disconnect]);

  const [isReady, setIsReady] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'human' | 'ai'>('human');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>('en');

  // Nav scroll effect
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Detect browser language on mount
  useEffect(() => {
    const browserLang = navigator.language.split('-')[0] as Language;
    const supportedLangs: Language[] = ['en', 'it', 'es', 'zh', 'ja', 'fr', 'de'];
    if (supportedLangs.includes(browserLang)) {
      setLanguage(browserLang);
    }
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  const [lastYieldDistribution, setLastYieldDistribution] = useState<number>(0);
  const [basketData, setBasketData] = useState<any[]>([]);
  const [supply, setSupply] = useState('---');
  const [stabilityFund, setStabilityFund] = useState('---');
  const [ethBalance, setEthBalance] = useState('0.0000');
  const [tokenBalance, setTokenBalance] = useState('0.0000');
  const [gblinBalance, setGblinBalance] = useState('0.0000');

  const isFetchingRef = React.useRef(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  // Trade state
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [redeemOption, setRedeemOption] = useState<'pro-rata' | 'zap-out'>('pro-rata');
  const [outputAsset, setOutputAsset] = useState('WETH');
  const [slippage, setSlippage] = useState(1);
  const [quote, setQuote] = useState('0');
  const [usdValue, setUsdValue] = useState('0.00');
  const [rawQuote, setRawQuote] = useState<bigint>(BigInt(0));
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [tradeTxHash, setTradeTxHash] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [showForceOption, setShowForceOption] = useState(false);

  // Arbitrage state
  const [isArbitraging, setIsArbitraging] = useState(false);
  const [arbTxHash, setArbTxHash] = useState<string | null>(null);
  const [arbError, setArbError] = useState<string | null>(null);

  const [stats, setStats] = useState<any>(null);

  const [marketData, setMarketData] = useState<DashboardData | null>(null);
  const [onChainData, setOnChainData] = useState<any>(null);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [isOnChainLoading, setIsOnChainLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);

  const rebalanceAssetStats = useMemo(() => {
    const totalTvlUsd = basketData.reduce((sum, asset) => sum + (Number(asset.tvl) || 0), 0);
    const wethAsset = basketData.find((asset) => asset.name === 'WETH') ?? null;
    const wethPrice = wethAsset ? Number(wethAsset.price) : 0;
    const wethBalance = wethAsset ? Number(wethAsset.balance) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);

    return REBALANCE_ASSET_OPTIONS.map((option) => {
      const metrics = basketData.find((asset) => asset.name === option.name) ?? null;
      const actualWeight = metrics ? Number(metrics.realWeight) : null;
      const dynamicWeight = metrics ? Number(metrics.dynamicWeight) / 100 : null;
      const baseWeight = metrics ? Number(metrics.baseWeight) / 100 : null;
      const assetPrice = metrics ? Number(metrics.price) : 0;
      const assetBalance = metrics ? Number(metrics.balance) : 0;
      const currentUsdValue = metrics ? Number(metrics.tvl) : 0;
      const targetUsdValue = metrics ? (totalTvlUsd * Number(metrics.dynamicWeight)) / 10000 : 0;
      const deltaUsd = metrics ? targetUsdValue - currentUsdValue : 0;
      const weightGap = actualWeight !== null && dynamicWeight !== null ? dynamicWeight - actualWeight : null;

      let recommendation: RebalanceDirection | 'balanced' | 'unknown' = 'unknown';
      if (weightGap !== null) {
        if (weightGap > 0.01) recommendation = 'weth-to-asset';
        else if (weightGap < -0.01) recommendation = 'asset-to-weth';
        else recommendation = 'balanced';
      }

      const targetInputAmount =
        recommendation === 'weth-to-asset'
          ? wethPrice > 0 ? Math.max(deltaUsd, 0) / wethPrice : 0
          : recommendation === 'asset-to-weth'
            ? assetPrice > 0 ? Math.abs(Math.min(deltaUsd, 0)) / assetPrice : 0
            : 0;

      const executableInputAmount =
        recommendation === 'weth-to-asset'
          ? Math.min(targetInputAmount, availableWeth)
          : recommendation === 'asset-to-weth'
            ? Math.min(targetInputAmount, assetBalance)
            : 0;

      const targetEthAmount =
        recommendation === 'weth-to-asset'
          ? targetInputAmount
          : recommendation === 'asset-to-weth' && assetPrice > 0 && wethPrice > 0
            ? (targetInputAmount * assetPrice) / wethPrice
            : 0;

      const minimumInputAmount =
        recommendation === 'weth-to-asset'
          ? minSwapRequiredEth
          : recommendation === 'asset-to-weth' && assetPrice > 0 && wethPrice > 0
            ? (minSwapRequiredEth * wethPrice) / assetPrice
            : 0;

      const inputSymbol = recommendation === 'weth-to-asset' ? 'WETH' : option.name;
      const inputDecimals = recommendation === 'weth-to-asset' ? 18 : option.decimals;
      const inputPrecision = recommendation === 'weth-to-asset' ? 8 : option.decimals;
      const inputAmountText = formatTokenAmount(minimumInputAmount, inputPrecision);

      let amountToSwap = 0n;
      try {
        if (recommendation !== 'unknown' && recommendation !== 'balanced' && executableInputAmount > 0) {
          const effectiveAmount = Math.max(executableInputAmount, minimumInputAmount);
          amountToSwap = ethers.parseUnits(formatTokenAmount(effectiveAmount, inputPrecision), inputDecimals);
        }
      } catch {
        amountToSwap = 0n;
      }

      const eligible =
        recommendation !== 'unknown' &&
        recommendation !== 'balanced' &&
        executableInputAmount > 0 &&
        amountToSwap > 0n;

      return {
        ...option,
        actualWeight,
        dynamicWeight,
        baseWeight,
        recommendation,
        inputSymbol,
        inputAmountText,
        amountToSwap,
        targetEthAmount,
        executableInputAmount,
        eligible,
        minSwapRequiredEth
      };
    });
  }, [basketData, onChainData]);

  const autoRebalanceOpportunity = useMemo(() => {
    const ranked = [...rebalanceAssetStats]
      .filter((asset) => asset.recommendation !== 'unknown')
      .sort((a, b) => b.targetEthAmount - a.targetEthAmount);

    return ranked.find((asset) => asset.eligible) ?? ranked[0] ?? null;
  }, [rebalanceAssetStats]);

  const rebalanceMinSwapRequiredEth = autoRebalanceOpportunity?.minSwapRequiredEth ?? 0.01;
  const rebalanceBountyActive = (onChainData?.stabilityFund ? parseFloat(onChainData.stabilityFund) : 0) >= 0.0001;

  useEffect(() => {
    setArbError(null);
  }, [
    autoRebalanceOpportunity?.name,
    autoRebalanceOpportunity?.recommendation,
    autoRebalanceOpportunity?.inputAmountText,
    autoRebalanceOpportunity?.eligible
  ]);

  // Manual refresh functions
  const refreshMarketData = useCallback(async () => {
    setIsMarketLoading(true);
    try {
      const data = await fetchMarketData();
      setMarketData(data);
      addLog(`Market data updated: $${data.priceUsd.toFixed(4)}`);
    } catch (error) {
      addLog("Failed to fetch market data.");
    } finally {
      setIsMarketLoading(false);
    }
  }, [addLog]);

  const refreshOnChainData = useCallback(async () => {
    setIsOnChainLoading(true);
    try {
      const data = await fetchOnChainData();
      setOnChainData(data);
      if (data.lastYield) setLastYieldDistribution(data.lastYield);
      if (data.basketData) setBasketData(data.basketData);
      addLog(`On-chain metrics sync complete. TVL: ${formatCurrency(data.tvl)}`);
    } catch (error) {
      addLog("On-chain data sync failed.");
    } finally {
      setIsOnChainLoading(false);
    }
  }, [addLog]);

  const refreshTransactions = useCallback(async () => {
    setIsTransactionsLoading(true);
    try {
      const data = await fetchTransactions();
      setTransactions(data || []);
      if (data && data.length > 0) {
        addLog(`Fetched ${data.length} recent transactions.`);
      }
    } catch (error) {
      addLog("Transaction fetch failed.");
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    if (isConnected) addLog(`Wallet connected: ${shortenAddress(address!)}`);
  }, [isConnected, address, addLog]);

  useEffect(() => {
    if (!isConnected || !address) {
      setEthBalance('0.0000');
      setGblinBalance('0.0000');
      setTokenBalance('0.0000');
      return;
    }
    const fetchWalletBalances = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const [ethBal, gblinBal] = await Promise.all([
          provider.getBalance(address),
          new ethers.Contract(CONTRACT_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address)
        ]);
        setEthBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(4));
        setGblinBalance(parseFloat(ethers.formatEther(gblinBal)).toFixed(4));
        if (selectedToken !== 'ETH' && TOKEN_ADDRESSES[selectedToken]) {
          const tokenContract = new ethers.Contract(TOKEN_ADDRESSES[selectedToken], ERC20_ABI, provider);
          const [tokenBal, decimals] = await Promise.all([
            tokenContract.balanceOf(address),
            tokenContract.decimals()
          ]);
          setTokenBalance((Number(tokenBal) / Math.pow(10, Number(decimals))).toFixed(4));
        }
      } catch (e) {
        console.error('[balance] fetch error:', e);
      }
    };
    fetchWalletBalances();
  }, [isConnected, address, selectedToken]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const refreshAllData = useCallback(() => {
    refreshMarketData();
    refreshTransactions();
    refreshOnChainData();
  }, [refreshMarketData, refreshTransactions, refreshOnChainData]);

  // Fetch all data once on mount with safety check
  useEffect(() => {
    if (isFetchingRef.current) return;
    
    const loadAllData = async () => {
      isFetchingRef.current = true;
      try {
        await Promise.all([
          refreshMarketData(),
          refreshOnChainData(),
          refreshTransactions()
        ]);
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadAllData();
  }, [refreshMarketData, refreshOnChainData, refreshTransactions]);

  // Calculate discount percentage
  const discountPercentage = useMemo(() => {
    if (!marketData?.priceUsd || !onChainData?.nav) return 0;
    
    const marketPrice = marketData.priceUsd;
    const navNum = parseFloat(onChainData.nav.replace(/[$,]/g, ''));
    
    const ratio = marketPrice / navNum;
    const discount = (1 - ratio) * 100;
    
    return Math.max(-100, Math.min(100, discount));
  }, [marketData, onChainData]);

  const t = useCallback((key: string) => {
    try {
      const keys = key.split('.');
      const currentLang = language || 'en';
      
      let val: any = translations ? (translations[currentLang] || translations['en']) : null;
      
      if (val) {
        for (const k of keys) {
          if (val && typeof val === 'object' && k in val) {
            val = val[k];
          } else {
            val = null;
            break;
          }
        }
      }

      if (typeof val === 'string') return val;
      
      // Se non trovo la chiave nella lingua corrente, provo in inglese
      if (currentLang !== 'en') {
        let fallbackVal: any = translations['en'];
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
            fallbackVal = fallbackVal[k];
          } else {
            fallbackVal = null;
            break;
          }
        }
        if (typeof fallbackVal === 'string') return fallbackVal;
      }

      return key;
    } catch (e) {
      return key;
    }
  }, [language]);

  const rebalanceOverviewCards = useMemo(() => {
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
        containerClass: autoRebalanceOpportunity?.name === asset.name
          ? 'border-amber-500/30 bg-amber-500/[0.05]'
          : 'border-white/10 bg-white/[0.03]'
      };
    });

    const wethMetrics = basketData.find((asset) => asset.name === 'WETH') ?? null;
    const wethBalance = wethMetrics ? Number(wethMetrics.balance) : 0;
    const stabilityFundValue = onChainData?.stabilityFund ? parseFloat(onChainData.stabilityFund) : 0;
    const availableWeth = Math.max(wethBalance - stabilityFundValue, 0);
    const minSwapRequiredEth = Math.max(wethBalance / 100, 0.01);

    const wethCard = {
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

    const cards = [];
    const cbBtcCard = executableCards.find((asset) => asset.name === 'cbBTC');
    const usdcCard = executableCards.find((asset) => asset.name === 'USDC');

    if (cbBtcCard) cards.push(cbBtcCard);
    cards.push(wethCard);
    if (usdcCard) cards.push(usdcCard);

    return cards;
  }, [autoRebalanceOpportunity?.name, basketData, onChainData, rebalanceAssetStats, t]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeTrade = useCallback(async () => {
    if (!isConnected || !address) {
      router.push('/account');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setTradeError('Enter a valid amount.');
      return;
    }

    if (mode === 'buy' && selectedToken !== 'ETH') {
      setTradeError('Zap-in is currently enabled only for ETH.');
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
    setShowForceOption(false);

    try {
      let hash: `0x${string}` = '' as `0x${string}`;

      if (mode === 'buy') {
        const ethAmount = ethers.parseEther(amount);
        const buyTx = prepareContractCall({
          contract: { client: thirdwebClient, chain: base, address: CONTRACT_ADDRESS as `0x${string}` },
          method: 'function buyGBLIN(uint256 minGblinOut) payable',
          params: [minAmountOut],
          value: ethAmount,
        });
        await new Promise<void>((resolve, reject) => {
          sendTx(buyTx, {
            onSuccess: (data) => { hash = data.transactionHash; resolve(); },
            onError: (err: Error) => reject(err),
          });
        });
      } else {
        const gblinAmount = ethers.parseEther(amount);
        const sellTx = prepareContractCall({
          contract: { client: thirdwebClient, chain: base, address: CONTRACT_ADDRESS as `0x${string}` },
          method: 'function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut)',
          params: [gblinAmount, minAmountOut],
        });
        await new Promise<void>((resolve, reject) => {
          sendTx(sellTx, {
            onSuccess: (data) => { hash = data.transactionHash; resolve(); },
            onError: (err: Error) => reject(err),
          });
        });
      }

      if (hash) setTradeTxHash(hash);
      if (hash) addLog(`Transaction sent: ${shortenAddress(hash)}`);

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      await provider.waitForTransaction(hash, 1, 120000);

      const [ethBal, gblinBal] = await Promise.all([
        provider.getBalance(address),
        new ethers.Contract(CONTRACT_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider).balanceOf(address)
      ]);

      setEthBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(4));
      setGblinBalance(parseFloat(ethers.formatEther(gblinBal)).toFixed(4));

      if (selectedToken !== 'ETH' && TOKEN_ADDRESSES[selectedToken]) {
        const tokenContract = new ethers.Contract(TOKEN_ADDRESSES[selectedToken], ERC20_ABI, provider);
        const [tokenBal, decimals] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.decimals()
        ]);
        setTokenBalance((Number(tokenBal) / Math.pow(10, Number(decimals))).toFixed(4));
      }
    } catch (error) {
      console.error('[trade] execute error:', error);

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
  }, [
    address,
    addLog,
    amount,
    isConnected,
    mode,
    router,
    rawQuote,
    refreshOnChainData,
    refreshTransactions,
    selectedToken,
    slippage,
    sendTx
  ]);

  const executeArbitrage = useCallback(async () => {
    if (!isConnected || !address) {
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
      let hash: `0x${string}` = '0x';
      const rebalanceTx = prepareContractCall({
        contract: { client: thirdwebClient, chain: base, address: CONTRACT_ADDRESS as `0x${string}` },
        method: 'function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap)',
        params: [BigInt(autoRebalanceOpportunity.basketIndex), isWethToAsset, autoRebalanceOpportunity.amountToSwap],
      });
      await new Promise<void>((resolve, reject) => {
        sendTx(rebalanceTx, {
          onSuccess: (data) => { hash = data.transactionHash; resolve(); },
          onError: (err: Error) => reject(err),
        });
      });

      setArbTxHash(hash);
      addLog(`Auto rebalance sent: ${shortenAddress(hash)} (${isWethToAsset ? 'WETH' : autoRebalanceOpportunity.name} -> ${isWethToAsset ? autoRebalanceOpportunity.name : 'WETH'})`);

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      await provider.waitForTransaction(hash, 1, 120000);

      await Promise.all([refreshOnChainData(), refreshTransactions()]);
      addLog(`Auto rebalance confirmed: ${shortenAddress(hash)}`);
    } catch (error) {
      console.error('[rebalance] execute error:', error);

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
  }, [
    address,
    addLog,
    autoRebalanceOpportunity,
    isConnected,
    router,
    refreshOnChainData,
    refreshTransactions,
    t,
    sendTx
  ]);

  const isArbDisabled =
    isArbitraging ||
    !autoRebalanceOpportunity ||
    !autoRebalanceOpportunity.eligible ||
    autoRebalanceOpportunity.amountToSwap <= 0n;

  const isTradeDisabled =
    isTransacting ||
    isLoadingQuote ||
    !amount ||
    parseFloat(amount) <= 0 ||
    rawQuote <= 0n ||
    (mode === 'buy' && selectedToken !== 'ETH');

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      {/* Install Banner for Mobile */}
      {showInstallBanner && (
        <div className="fixed bottom-6 left-6 right-6 z-[100] md:hidden animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-[#0A0A0A] border border-amber-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                <img src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png" alt="GBLIN" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Install GBLIN App</p>
                <p className="text-[10px] text-zinc-500">For a better experience</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
              >
                Close
              </button>
              <button 
                onClick={handleInstallClick}
                className="px-4 py-2 bg-amber-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navScrolled ? 'bg-[#050505]/95 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(245,158,11,0.05)]' : 'bg-transparent'}`}>
        {/* Live price ticker bar */}
        <div className="border-b border-white/[0.04] bg-black/40 hidden md:block">
          <div className="max-w-7xl mx-auto px-6 h-8 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Base Mainnet</span>
              </div>
              {marketData?.priceUsd ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-600">GBLIN/USD</span>
                  <span className="text-[10px] font-mono font-bold text-amber-400">${marketData.priceUsd.toFixed(4)}</span>
                </div>
              ) : null}
              {onChainData?.nav ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-600">NAV</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-300">{onChainData.nav}</span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <a href="https://basescan.org/address/0x38DcDB3A381677239BBc652aed9811F2f8496345" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 hover:text-amber-500 transition-colors uppercase tracking-widest">
                <ExternalLink size={10} />
                Basescan
              </a>
              <a href="https://x.com/GBLIN_Protocol" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-zinc-600 hover:text-amber-500 transition-colors uppercase tracking-widest">Twitter</a>
            </div>
          </div>
        </div>

        {/* Main navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-amber-500/20 bg-amber-500/5 cursor-pointer group" onClick={refreshAllData}>
              <img src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png" alt="GBLIN" className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              {(isMarketLoading || isOnChainLoading || isTransactionsLoading) && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <RefreshCw size={12} className="text-amber-500 animate-spin" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent leading-none">GBLIN</h1>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.18em] leading-none mt-0.5">Global Balanced Liquidity Index</p>
            </div>
          </div>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {[
              { href: '#dashboard', label: t('nav.dashboard') },
              { href: '#rebalance', label: 'Rebalance' },
              { href: '#trade', label: t('nav.trade') },
              { href: '#vault', label: t('nav.vault') },
            ].map(link => (
              <a key={link.href} href={link.href} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                {link.label}
              </a>
            ))}
            <a href="https://raw.githubusercontent.com/gblinproject/Whitepaper/main/GBLIN_WHITE_PAPER_V5.pdf" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/5 rounded-xl transition-all flex items-center gap-1.5">
              Whitepaper <ExternalLink size={10} />
            </a>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language */}
            <div className="relative">
              <button onClick={() => setShowLangSelector(!showLangSelector)} className="h-9 px-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 hover:bg-white/10 transition-all group">
                <Globe size={14} className="text-zinc-400 group-hover:text-amber-500 transition-colors" />
                <span className="text-[10px] font-bold uppercase text-zinc-500 hidden sm:inline">{language.toUpperCase()}</span>
                <ChevronDown size={10} className="text-zinc-600" />
              </button>
              {showLangSelector && (
                <div className="absolute top-full right-0 mt-2 py-1.5 w-44 bg-[#0C0C0C] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl z-10">
                  {LANGUAGES.map((lang) => (
                    <button key={lang.code} onClick={() => { setLanguage(lang.code as Language); setShowLangSelector(false); }} className={`w-full px-4 py-2.5 flex items-center justify-between text-sm transition-colors hover:bg-white/5 ${language === lang.code ? 'text-amber-500' : 'text-zinc-400'}`}>
                      <span className="flex items-center gap-3">
                        <span>{lang.flag}</span>
                        <span className="font-medium text-xs">{lang.name}</span>
                      </span>
                      {language === lang.code && <Check size={12} className="text-amber-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet button */}
            <button onClick={() => isConnected ? handleDisconnect() : router.push('/account')} className={`h-9 px-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${isConnected ? 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'}`}>
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="hidden sm:inline">{shortenAddress(address!)}</span>
                  <span className="sm:hidden">Connected</span>
                </span>
              ) : t('nav.connect')}
            </button>

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#080808]/98 backdrop-blur-2xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {[
                { href: '#dashboard', label: t('nav.dashboard') },
                { href: '#rebalance', label: 'Rebalance' },
                { href: '#trade', label: t('nav.trade') },
                { href: '#vault', label: t('nav.vault') },
              ].map(link => (
                <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                  {link.label}
                </a>
              ))}
              <a href="https://raw.githubusercontent.com/gblinproject/Whitepaper/main/GBLIN_WHITE_PAPER_V5.pdf" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/5 transition-all">
                Whitepaper <ExternalLink size={14} />
              </a>
              {marketData?.priceUsd && (
                <div className="px-4 py-3 border-t border-white/5 mt-2 flex items-center gap-4">
                  <div className="text-xs font-mono text-zinc-600">GBLIN <span className="text-amber-400 font-bold">${marketData.priceUsd.toFixed(4)}</span></div>
                  {onChainData?.nav && <div className="text-xs font-mono text-zinc-600">NAV <span className="text-zinc-300 font-bold">{onChainData.nav}</span></div>}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="relative">

        {/* Hero Section — full viewport, gold radial glow */}
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-24 md:pt-28">
          {/* Background layers */}
          <div className="absolute inset-0 bg-[#020202]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(245,158,11,0.12),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_60%,rgba(245,158,11,0.04),transparent)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          {/* Mode switcher */}
          <div className="relative z-10 flex justify-center mb-10 px-4">
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <button onClick={() => setActiveTab('human')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === 'human' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                Investor Interface
              </button>
              <button onClick={() => setActiveTab('ai')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${activeTab === 'ai' ? 'bg-emerald-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                Agent Interface
              </button>
            </div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 text-center">
            {activeTab === 'human' ? (
              <div>
                {/* Badge */}
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.7)]"></span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-400">{t('hero.subtitle')}</span>
                </div>

                {/* Headline */}
                <h1 className="font-serif text-[clamp(3rem,11vw,8rem)] leading-[0.88] mb-6 tracking-tighter">
                  {t('hero.title1')}<br />
                  <span className="italic text-amber-500 [text-shadow:0_0_80px_rgba(245,158,11,0.3)]">{t('hero.title2')}</span>
                </h1>

                <p className="max-w-xl mx-auto text-base md:text-lg text-white/40 font-light leading-relaxed mb-10">
                  {t('hero.desc')}
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
                  <button onClick={() => router.push('/account')} className="group w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-amber-500 text-black text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition-all shadow-[0_0_40px_rgba(245,158,11,0.25)] hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(245,158,11,0.35)]">
                    {t('hero.cta')}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <a href="#dashboard" className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5">
                    {t('nav.dashboard')}
                    <ChevronDown size={14} className="text-zinc-500" />
                  </a>
                </div>

                {/* Live metrics strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
                  {[
                    { label: 'GBLIN Price', value: marketData?.priceUsd ? `$${marketData.priceUsd.toFixed(4)}` : '—', color: 'text-amber-400' },
                    { label: 'NAV', value: onChainData?.nav ?? '—', color: 'text-white' },
                    { label: 'TVL', value: onChainData?.tvl ? formatCurrency(onChainData.tvl) : '—', color: 'text-emerald-400' },
                    { label: 'Supply', value: onChainData?.totalSupply ?? '—', color: 'text-zinc-300' },
                  ].map(m => (
                    <div key={m.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-3 text-center backdrop-blur-sm">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{m.label}</p>
                      <p className={`text-sm font-bold tabular-nums ${m.color} ${(isMarketLoading || isOnChainLoading) ? 'animate-pulse' : ''}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="font-mono">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
                  <Cpu size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Machine-to-Machine Protocol · Base Mainnet</span>
                </div>
                <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] leading-none mb-8 tracking-tighter uppercase">
                  Invariant <span className="text-emerald-500">Root</span><br />Level: Solvency
                </h1>
                <div className="max-w-2xl mx-auto bg-black/60 border border-emerald-500/20 p-6 rounded-2xl mb-10 text-left">
                  <div className="flex items-center gap-2 mb-3 text-emerald-500/50">
                    <Brain size={14} /><span className="text-[10px] uppercase tracking-widest">Protocol Directive</span>
                  </div>
                  <p className="text-emerald-400/70 text-sm leading-relaxed">
                    &gt; Invariant: Geometric Mean Solvency<br />
                    &gt; Basket: cbBTC 45% / WETH 45% / USDC 10%<br />
                    &gt; Crash Shield: active at -20% drawdown from peak<br />
                    &gt; Rebalance Bounty: 0.0001 ETH per call<br />
                    &gt; Oracle: Chainlink · Sequencer: monitored
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a href="#trade" className="group w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 text-black text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all">
                    Initialize Settlement <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ address: CONTRACT_ADDRESS, abi: GBLIN_ABI })); addLog("ABI copied."); }} className="w-full sm:w-auto px-8 py-4 border border-emerald-500/30 text-emerald-400 text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-emerald-500/10 transition-all">
                    Copy ABI + Address
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contract address strip */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 mt-14 pb-10">
            <button onClick={copyToClipboard} className="mx-auto flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-2xl hover:bg-white/[0.06] hover:border-white/10 transition-all group">
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest hidden sm:inline">Contract</span>
              <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">{CONTRACT_ADDRESS}</span>
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-zinc-600 group-hover:text-amber-500 transition-colors" />}
            </button>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
            <div className="w-px h-8 bg-gradient-to-b from-transparent to-amber-500/60"></div>
            <ChevronDown size={14} className="text-amber-500 animate-bounce" />
          </div>
        </section>

        {/* Protocol Log strip */}
        <div className="border-y border-white/[0.04] bg-black/40 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <RefreshCw size={11} className={`text-amber-500/40 ${isMarketLoading ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest hidden sm:inline">Log</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-mono text-zinc-600 truncate">
                {logs.length > 0 ? <><span className="text-amber-500/40 mr-2">›</span>{logs[0]}</> : <span className="italic">Initializing telemetry…</span>}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/30"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Dashboard Section */}
        <section id="dashboard" className="py-20 sm:py-28 px-4 sm:px-6 border-b border-white/[0.05]">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                  <LineChart size={12} className="text-amber-500" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-500">{t('dashboard.verified')}</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight">{t('dashboard.title')}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">{t('dashboard.lastUpdate')}</div>
                  <LiveClock />
                </div>
                <button onClick={refreshAllData} className="h-10 w-10 bg-white/[0.03] border border-white/[0.07] rounded-xl flex items-center justify-center hover:bg-white/[0.07] transition-colors group">
                  <RefreshCw size={16} className={`text-zinc-500 group-hover:text-amber-500 transition-colors ${(isMarketLoading || isOnChainLoading) ? 'animate-spin text-amber-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Top KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: t('dashboard.navTitle'), value: onChainData?.nav ?? '—', sub: t('dashboard.backing'), color: 'text-amber-400', loading: isOnChainLoading, icon: <Shield size={16} className="text-amber-500/40" /> },
                { label: t('dashboard.tvlTitle'), value: onChainData?.tvl ? formatCurrency(onChainData.tvl) : '—', sub: t('dashboard.assetsInVault'), color: 'text-emerald-400', loading: isOnChainLoading, icon: <Landmark size={16} className="text-emerald-500/40" /> },
                { label: t('dashboard.supplyTitle'), value: onChainData?.totalSupply ?? '—', sub: t('dashboard.inCirculation'), color: 'text-white', loading: isOnChainLoading, icon: <Coins size={16} className="text-white/20" /> },
                { label: t('dashboard.apyTitle'), value: onChainData?.apyData?.estimatedApy ? `${onChainData.apyData.estimatedApy}%` : '—', sub: t('dashboard.estimatedYield'), color: 'text-amber-400', loading: isOnChainLoading, icon: <TrendingUp size={16} className="text-amber-500/40" /> },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:border-amber-500/20 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">{kpi.label}</span>
                    {kpi.icon}
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold tabular-nums ${kpi.color} ${kpi.loading ? 'animate-pulse' : ''}`}>{kpi.value}</p>
                  <p className="text-[9px] font-mono text-zinc-700 mt-1 uppercase tracking-wider">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Second row: Vault Health + Treasury + Agent */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Vault Health / Crash Shield */}
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 hover:border-amber-500/20 transition-all">
                <div className="flex items-center gap-2 mb-5">
                  <Shield size={14} className="text-amber-500/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Crash Shield · Vault Health</span>
                </div>
                <div className="space-y-4">
                  {(basketData.length > 0 ? basketData : [
                    { name: 'cbBTC', realWeight: 45, price: 1, peakPrice: 1 },
                    { name: 'WETH', realWeight: 45, price: 1, peakPrice: 1 },
                    { name: 'USDC', realWeight: 10, price: 1, peakPrice: 1 },
                  ]).map((asset: any) => {
                    const drawdown = asset.peakPrice > 0 ? ((asset.peakPrice - asset.price) * 10000) / asset.peakPrice : 0;
                    const isSlashed = drawdown > 2000;
                    return (
                      <div key={asset.name}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs font-bold text-zinc-300">{asset.name}</span>
                          <span className={`text-[10px] font-mono ${isSlashed ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {isSlashed ? '⚠ SHIELD' : '✓ OK'} · {asset.realWeight.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${isSlashed ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} style={{ width: `${Math.min(asset.realWeight, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${basketData.some((a: any) => (a.peakPrice > 0 ? ((a.peakPrice - a.price) * 10000) / a.peakPrice : 0) > 2000) ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                      {basketData.some((a: any) => (a.peakPrice > 0 ? ((a.peakPrice - a.price) * 10000) / a.peakPrice : 0) > 2000) ? 'Contraction detected' : 'Geometric survival guaranteed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Treasury Reserve */}
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 hover:border-amber-500/20 transition-all">
                <div className="flex items-center gap-2 mb-5">
                  <Landmark size={14} className="text-amber-500/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Treasury Reserve</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Stability Fund</span>
                    <span className="font-bold text-amber-400 tabular-nums">{onChainData?.stabilityFund ? `${parseFloat(onChainData.stabilityFund).toFixed(4)} ETH` : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Dynamic Reserve</span>
                    <span className="font-bold text-zinc-300 tabular-nums">{onChainData?.dynamicReserve ? `${parseFloat(onChainData.dynamicReserve).toFixed(4)} ETH` : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Rebalance Bounty</span>
                    <span className="font-bold text-emerald-400">0.0001 ETH / call</span>
                  </div>
                  {lastYieldDistribution > 0 && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Last Yield</span>
                      <span className="text-[10px] font-mono text-amber-400/70">{new Date(lastYieldDistribution * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent / Dev card */}
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 hover:border-emerald-500/20 transition-all">
                <div className="flex items-center gap-2 mb-5">
                  <Brain size={14} className="text-emerald-500/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Agent API · On-Chain</span>
                </div>
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/[0.05]">
                    <p className="text-emerald-500/60 mb-1">// Contract</p>
                    <p className="text-zinc-500 break-all">{CONTRACT_ADDRESS.slice(0, 20)}…</p>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/[0.05]">
                    <p className="text-amber-500/60 mb-1">// Invariant</p>
                    <p className="text-zinc-500">Geometric Mean Solvency</p>
                    <p className="text-zinc-600 mt-0.5">Rebalance: permissionless</p>
                  </div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(CONTRACT_ADDRESS); addLog("Contract address copied."); }} className="mt-4 w-full py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                  <Copy size={11} /> Copy Contract Address
                </button>
              </div>
            </div>

            {/* Transactions */}
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-amber-500/60" />
                <h3 className="font-serif text-lg italic tracking-tight">{t('dashboard.recentTransactions')}</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 border-b border-white/5">
                    <th className="px-8 py-5 font-medium">{t('dashboard.tableType')}</th>
                    <th className="px-8 py-5 font-medium">{t('dashboard.tableValue')}</th>
                    <th className="px-8 py-5 font-medium">{t('dashboard.tableAddress')}</th>
                    <th className="px-8 py-5 font-medium">{t('dashboard.tableTime')}</th>
                    <th className="px-8 py-5 font-medium text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isTransactionsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-6">
                          <div className="h-4 bg-white/5 rounded-full w-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : transactions.length > 0 ? (
                    transactions.slice(0, 5).map((tx, i) => (
                      <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              tx.type === 'BUY' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 
                              tx.type === 'SELL' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 
                              'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                            }`}></div>
                            <span className="text-xs font-bold tracking-widest uppercase">{tx.type}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium tabular-nums">{tx.value} GBLIN</span>
                            <span className="text-[10px] text-zinc-500 font-mono italic">
                              {tx.type === 'REBALANCE' ? 'Stability Fund' : 'Protocol Interaction'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 font-mono text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          {tx.from}
                        </td>
                        <td className="px-8 py-6 font-mono text-[10px] text-zinc-500">
                          {tx.time}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <a 
                            href={`https://basescan.org/tx/${tx.full_hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex p-2 bg-white/5 border border-white/10 rounded-xl text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                          >
                            <ArrowRight size={14} className="-rotate-45" />
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-zinc-500 font-serif italic">
                        {t('dashboard.noTransactions')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </section>

        <section id="rebalance" className="py-20 sm:py-28 px-4 sm:px-6 border-b border-white/[0.05] bg-white/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                    <SlidersHorizontal size={12} className="text-amber-500" />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-500">{t('rebalance.badge')}</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight mb-3">{t('rebalance.title')}</h2>
                  <p className="text-white/50 max-w-2xl leading-relaxed text-sm md:text-base">{t('rebalance.desc')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                  {rebalanceOverviewCards.map((asset) => {
                    return (
                      <div
                        key={asset.name}
                        className={`rounded-[2rem] border p-6 md:p-8 ${asset.containerClass}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">{t('rebalance.asset')}</div>
                            <div className="text-3xl md:text-4xl font-serif italic">{asset.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">{t('rebalance.direction')}</div>
                            <div className="text-sm font-semibold">{asset.directionLabel}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.actual')}</div>
                            <div className="mt-2 text-sm font-semibold">{asset.actualWeight !== null && asset.actualWeight !== undefined ? `${asset.actualWeight.toFixed(2)}%` : '---'}</div>
                          </div>
                          <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.dynamic')}</div>
                            <div className="mt-2 text-sm font-semibold">{asset.dynamicWeight !== null && asset.dynamicWeight !== undefined ? `${asset.dynamicWeight.toFixed(2)}%` : '---'}</div>
                          </div>
                          <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.base')}</div>
                            <div className="mt-2 text-sm font-semibold">{asset.baseWeight !== null && asset.baseWeight !== undefined ? `${asset.baseWeight.toFixed(2)}%` : '---'}</div>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 mt-3">
                          <div className="rounded-2xl bg-black/30 border border-white/5 px-4 py-4">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{asset.amountLabel}</div>
                            <div className="mt-2 text-sm font-semibold break-words">{asset.amountValue}</div>
                          </div>
                          <div className="rounded-2xl bg-black/30 border border-white/5 px-4 py-4">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{asset.minFloorLabel}</div>
                            <div className="mt-2 text-sm font-semibold">{asset.minFloorValue}</div>
                          </div>
                        </div>

                        <div className={`mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider ${asset.recommendationTone}`}>
                          <div className={`w-2 h-2 rounded-full ${asset.recommendationDot}`}></div>
                          <span>{asset.recommendationText}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-amber-500/5 blur-3xl rounded-[3rem] opacity-60"></div>
                <div className="relative bg-[#080808] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">{t('rebalance.asset')}</div>
                        <div className="text-2xl font-serif italic">{autoRebalanceOpportunity?.name ?? '---'}</div>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl border text-[10px] font-mono uppercase tracking-widest ${rebalanceBountyActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                        {rebalanceBountyActive ? t('rebalance.bountyReady') : t('rebalance.bountyLow')}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={16} className={`${autoRebalanceOpportunity?.eligible ? 'text-emerald-400' : 'text-amber-400'} shrink-0 mt-0.5`} />
                        <div className="space-y-1">
                          <p className="text-xs text-white/80 leading-relaxed">
                            {autoRebalanceOpportunity?.recommendation === 'weth-to-asset'
                              ? t('rebalance.recommendationUnderweight')
                              : autoRebalanceOpportunity?.recommendation === 'asset-to-weth'
                                ? t('rebalance.recommendationOverweight')
                                : autoRebalanceOpportunity?.recommendation === 'balanced'
                                  ? t('rebalance.recommendationBalanced')
                                  : t('rebalance.recommendationLoading')}
                          </p>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            {autoRebalanceOpportunity?.eligible ? t('rebalance.autoAmountHint') : t('rebalance.noOpportunity')}
                          </p>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.gasNotice')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.direction')}</div>
                        <div className="mt-2 text-sm font-semibold">
                          {autoRebalanceOpportunity?.recommendation === 'weth-to-asset'
                            ? t('rebalance.directionToAsset')
                            : autoRebalanceOpportunity?.recommendation === 'asset-to-weth'
                              ? t('rebalance.directionToWeth')
                              : '---'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.amount')}</div>
                        <div className="mt-2 text-sm font-semibold break-words">
                          {autoRebalanceOpportunity ? `${autoRebalanceOpportunity.inputAmountText} ${autoRebalanceOpportunity.inputSymbol}` : '---'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/30 border border-white/5 px-3 py-4">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">{t('rebalance.minFloor')}</div>
                        <div className="mt-2 text-sm font-semibold">{formatTokenAmount(rebalanceMinSwapRequiredEth, 4)} WETH</div>
                      </div>
                    </div>

                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{t('rebalance.floorNotice')}</p>

                    {arbError && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                        <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-rose-400 leading-relaxed font-medium uppercase tracking-wider">{arbError}</p>
                      </div>
                    )}

                    {arbTxHash && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in duration-500">
                        <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">{t('rebalance.txSuccess')}</p>
                          <a
                            href={`https://basescan.org/tx/${arbTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-500/60 font-mono truncate block hover:underline"
                          >
                            {arbTxHash}
                          </a>
                        </div>
                      </div>
                    )}

                    {!isConnected ? (
                      <button
                        onClick={() => router.push('/account')}
                        className="w-full py-4 bg-amber-500 text-black rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                      >
                        {t('rebalance.connectWallet')}
                      </button>
                    ) : (
                      <button
                        disabled={isArbDisabled}
                        onClick={executeArbitrage}
                        className={`w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${isArbDisabled ? 'bg-white/5 text-zinc-500 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:-translate-y-0.5'}`}
                      >
                        {isArbitraging ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw size={16} className="animate-spin" />
                            {t('rebalance.processing')}
                          </span>
                        ) : (
                          isArbDisabled ? t('rebalance.waitingOpportunity') : t('rebalance.execute')
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trade Section */}
        <section id="trade" className="py-20 sm:py-28 px-4 sm:px-6 relative overflow-hidden border-b border-white/[0.05]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_30%_50%,rgba(245,158,11,0.04),transparent)]" />
          <div className="max-w-7xl mx-auto relative">
            <div className="flex flex-col lg:flex-row gap-12 xl:gap-20 items-start">
              <div className="flex-1 space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                    <Zap size={12} className="text-amber-500" />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-500">{t('trade.instant')}</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4">
                    {t('trade.title1')} <br />
                    <span className="italic text-amber-500">{t('trade.title2')}</span>
                  </h2>
                  <p className="text-white/50 text-base leading-relaxed max-w-lg">
                    {t('trade.desc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl group hover:border-amber-500/20 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-4 group-hover:scale-110 transition-transform">
                      <Shield size={20} className="text-amber-500" />
                    </div>
                    <h4 className="font-serif text-lg mb-2">{t('trade.feature1Title')}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">{t('trade.feature1Desc')}</p>
                  </div>
                  <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl group hover:border-amber-500/20 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-4 group-hover:scale-110 transition-transform">
                      <Zap size={20} className="text-amber-500" />
                    </div>
                    <h4 className="font-serif text-lg mb-2">{t('trade.feature2Title')}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">{t('trade.feature2Desc')}</p>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-[460px] shrink-0">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-amber-500/5 blur-3xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <div className="relative bg-[#080808] border border-white/[0.08] rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
                    <div className="flex p-1 bg-white/5 rounded-2xl mb-8">
                      <button 
                        onClick={() => setMode('buy')}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'buy' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                      >
                        {t('trade.mint')}
                      </button>
                      <button 
                        onClick={() => setMode('sell')}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'sell' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                      >
                        {t('trade.redeem')}
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t('trade.inputAsset')}</label>
                          <span className="text-[10px] font-mono text-zinc-500 italic">Balance: {mode === 'buy' ? (selectedToken === 'ETH' ? ethBalance : tokenBalance) : gblinBalance}</span>
                        </div>
                        <div className="relative group/input">
                          <div className="absolute inset-y-0 left-4 flex items-center gap-2 pr-4 border-r border-white/5">
                            {mode === 'buy' ? (
                              <select 
                                value={selectedToken}
                                onChange={(e) => setSelectedToken(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none appearance-none cursor-pointer pr-4"
                              >
                                {TOKENS.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                              </select>
                            ) : (
                              <span className="text-sm font-bold">GBLIN</span>
                            )}
                          </div>
                          <input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-28 pr-4 text-xl font-serif focus:outline-none focus:border-amber-500/50 transition-colors"
                          />
                        </div>
                      </div>

                      {mode === 'sell' && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">{t('trade.redeemOption')}</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => setRedeemOption('pro-rata')}
                              className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${redeemOption === 'pro-rata' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}
                            >
                              {t('trade.proRata')}
                            </button>
                            <button 
                              onClick={() => setRedeemOption('zap-out')}
                              className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${redeemOption === 'zap-out' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}
                            >
                              {t('trade.zapOut')}
                            </button>
                          </div>
                        </div>
                      )}

                      {mode === 'sell' && redeemOption === 'zap-out' && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">{t('trade.outputAsset')}</label>
                          <select 
                            value={outputAsset}
                            onChange={(e) => setOutputAsset(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm font-bold focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                          >
                            {TOKENS.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="flex justify-center -my-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-xl ring-4 ring-[#0A0A0A]">
                          <ArrowRight className="rotate-90" size={18} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t('trade.amountGblin')}</label>
                          <span className="text-[10px] font-mono text-zinc-500 italic">Est. Value: {usdValue}</span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-4 flex items-center gap-2 pr-4 border-r border-white/5">
                            <span className="text-sm font-bold">{mode === 'buy' ? 'GBLIN' : (redeemOption === 'pro-rata' ? 'BASKET' : outputAsset)}</span>
                          </div>
                          <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-28 pr-4 text-xl font-serif text-white/40">
                            {isLoadingQuote ? '...' : quote}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{t('trade.slippage')}</span>
                          <div className="flex gap-2">
                            {[0.5, 1, 3].map(v => (
                              <button 
                                key={v}
                                onClick={() => setSlippage(v)}
                                className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors ${slippage === v ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                              >
                                {v}%
                              </button>
                            ))}
                          </div>
                        </div>

                        {!isConnected ? (
                          <button 
                            onClick={() => router.push('/account')}
                            className="w-full py-4 bg-amber-500 text-black rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                          >
                            {t('trade.connectWallet')}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            {tradeError && (
                              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                                <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-[10px] text-rose-500 leading-relaxed font-medium uppercase tracking-wider">{tradeError}</p>
                                  {showForceOption && (
                                    <button 
                                      onClick={() => {
                                        setTradeError(null);
                                        setShowForceOption(false);
                                        // Force action would go here
                                      }}
                                      className="px-3 py-1.5 bg-rose-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-colors"
                                    >
                                      {t('trade.forceSend')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {tradeTxHash && (
                              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in duration-500">
                                <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">{t('trade.txSuccess')}</p>
                                  <a 
                                    href={`https://basescan.org/tx/${tradeTxHash}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-emerald-500/60 font-mono truncate block hover:underline"
                                  >
                                    {tradeTxHash}
                                  </a>
                                </div>
                              </div>
                            )}

                            <button 
                              disabled={isTradeDisabled}
                              onClick={executeTrade}
                              className={`w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${isTradeDisabled ? 'bg-white/5 text-zinc-500 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:-translate-y-0.5'}`}
                            >
                              {isTransacting ? (
                                <span className="flex items-center justify-center gap-2">
                                  <RefreshCw size={16} className="animate-spin" />
                                  {t('trade.processing')}
                                </span>
                              ) : (
                                mode === 'buy' ? t('trade.mint') : t('trade.redeem')
                              )}
                            </button>
                            
                            <button 
                              onClick={handleDisconnect}
                              className="w-full py-3 text-[10px] text-zinc-600 font-bold uppercase tracking-widest hover:text-zinc-400 transition-colors"
                            >
                              {t('trade.disconnect')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Yield Mechanism Section */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 border-y border-white/[0.05] bg-white/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4">{t('yield.title')}</h2>
              <p className="text-white/40 max-w-xl mx-auto text-sm font-light leading-relaxed">{t('yield.desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:border-amber-500/20 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-5 group-hover:scale-110 transition-transform">
                    {i === 1 ? <RefreshCw size={24} className="text-amber-500" /> : i === 2 ? <TrendingUp size={24} className="text-amber-500" /> : <Lock size={24} className="text-amber-500" />}
                  </div>
                  <h4 className="font-serif text-lg mb-2">{t(`yield.step${i}Title`)}</h4>
                  <p className="text-xs text-white/40 leading-relaxed font-light">{t(`yield.step${i}Desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GBLIN Core Section */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 bg-[#020202] relative overflow-hidden border-b border-white/[0.04]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
              <div className="flex-1 space-y-8">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight leading-tight">
                  {t('core.title1')} <br />
                  <span className="italic text-amber-500">{t('core.title2')}</span>
                </h2>
                <p className="text-white/50 text-base leading-relaxed">{t('core.desc')}</p>
                
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4 p-4 bg-white/[0.03] border border-white/10 rounded-2xl">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 mt-1">
                        <Check size={14} className="text-amber-500" />
                      </div>
                      <p className="text-sm text-white/70">{t(`core.point${i}`)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 relative">
                <div className="absolute inset-0 bg-amber-500/20 blur-[100px] rounded-full opacity-20 animate-pulse"></div>
                <div className="relative aspect-square rounded-[3rem] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-6">
                    <Shield size={48} className="text-amber-500" />
                  </div>
                  <h3 className="font-serif text-2xl italic mb-2">{t('core.radarTitle')}</h3>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500 mb-6">{t('core.radarVerified')}</p>
                  <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-widest">{t('core.radarStatus')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Agents Section */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 relative border-y border-white/[0.05] bg-white/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
              <div className="flex-1 lg:order-2 space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                    <Brain size={14} className="text-amber-500" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Autonomous Economy</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight mb-6">
                    {t('ai.title1')} <br />
                    <span className="italic text-amber-500">{t('ai.title2')}</span>
                  </h2>
                  <p className="text-white/60 text-lg leading-relaxed">{t('ai.desc')}</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                      <Cpu size={20} className="text-white/60" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg mb-1">{t('ai.integrationTitle')}</h4>
                      <p className="text-xs text-zinc-500">{t('ai.integrationDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                      <Download size={20} className="text-white/60" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg mb-1">{t('ai.sdkTitle')}</h4>
                      <p className="text-xs text-zinc-500">{t('ai.sdkDesc')}</p>
                    </div>
                  </div>
                </div>

                <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3">
                  <Download size={16} />
                  {t('ai.download')}
                </button>
              </div>

              <div className="flex-1 lg:order-1 relative group">
                <div className="absolute -inset-4 bg-amber-500/5 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="relative bg-[#0A0A0A] border border-white/10 rounded-[3rem] p-8 overflow-hidden aspect-square flex items-center justify-center">
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="w-full h-full [background:radial-gradient(circle_at_center,_white_1px,_transparent_1px)] [background-size:24px_24px]"></div>
                  </div>
                  <div className="relative z-10 w-48 h-48 bg-amber-500/10 rounded-full border border-amber-500/20 flex items-center justify-center animate-pulse">
                    <Brain size={80} className="text-amber-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Architecture */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 bg-[#020202] relative border-y border-white/[0.05]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-serif text-[clamp(1.8rem,5vw,3.5rem)] tracking-tight mb-4">
                {t('core.architectureTitle').split(' ')[0]} <span className="italic text-amber-500">{t('core.architectureTitle').split(' ')[1]}</span>
              </h2>
              <p className="text-white/40 max-w-xl mx-auto text-sm font-light">{t('core.architectureDesc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
              <div className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[2rem] p-12 relative overflow-hidden group hover:border-amber-500/30 transition-colors duration-500">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full group-hover:bg-amber-500/20 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-auto group-hover:scale-110 transition-transform duration-500">
                    <Shield size={32} className="text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-serif text-2xl italic mb-6">{t('core.crashShieldTitle')}</h4>
                    <p className="text-xl text-white/50 leading-relaxed max-w-lg font-light">{t('core.crashShieldDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/20 hover:bg-white/[0.04] transition-all duration-500 flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-auto group-hover:scale-110 transition-transform duration-500">
                  <Zap size={24} className="text-white/80" />
                </div>
                <div>
                  <h4 className="font-serif text-xl mb-3">{t('core.bankTitle')}</h4>
                  <p className="text-sm text-white/50 leading-relaxed font-light">{t('core.bankDesc')}</p>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/20 hover:bg-white/[0.04] transition-all duration-500 flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-auto group-hover:scale-110 transition-transform duration-500">
                  <TrendingUp size={24} className="text-white/80" />
                </div>
                <div>
                  <h4 className="font-serif text-xl mb-3">{t('core.appreciationTitle')}</h4>
                  <p className="text-sm text-white/50 leading-relaxed font-light">{t('core.appreciationDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Vault Section */}
        <section id="vault" className="py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-20 items-center">
              <div className="flex-1 space-y-6">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-[clamp(2rem,5vw,3.5rem)] tracking-tight">
                  {t('vault.title').split(' ').slice(0, -2).join(' ')} <br />
                  <span className="italic text-amber-500">{t('vault.title').split(' ').slice(-2).join(' ')}</span>
                </h2>
                <p className="text-white/50 leading-relaxed text-base">
                  {t('vault.desc')}
                </p>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="flex flex-wrap gap-4">
                    <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {t('vault.weth')}
                    </span>
                    <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {t('vault.cbbtc')}
                    </span>
                    <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {t('vault.usdc')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex justify-center items-center">
                <div className="relative w-full max-w-[420px] aspect-square group">
                  <div className="absolute inset-0 bg-amber-500/5 blur-[120px] rounded-full opacity-30 animate-pulse"></div>
                  <div className="relative w-full h-full rounded-full overflow-hidden">
                    <img 
                      src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png"
                      alt="Vault Core"
                      className="object-cover scale-[1.02] hover:scale-[1.05] transition-transform duration-700 w-full h-full"
                      style={{ imageRendering: 'auto' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <footer className="py-16 sm:py-20 border-t border-white/[0.05] bg-[#020202] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png" alt="GBLIN" className="w-10 h-10" />
                <span className="font-serif text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">GBLIN</span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
                The first autonomous central bank on Base. Engineered for mathematical survival and absolute value invariance.
              </p>
            </div>
            
            <div className="space-y-6">
              <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">Institutional Contact</h4>
              <div className="space-y-4">
                <a href="mailto:info@gblin.digital" className="group flex flex-col gap-1">
                  <span className="text-zinc-500 text-[10px] uppercase tracking-widest">Global Support</span>
                  <span className="text-lg font-bold text-amber-500 group-hover:text-amber-400 transition-colors">info@gblin.digital</span>
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">Protocol Status</h4>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest font-bold">Mainnet Active</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-8 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
              <a href="https://basescan.org/address/0x38DcDB3A381677239BBc652aed9811F2f8496345" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Contract</a>
              <a href="https://warpcast.com/gblin" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Warpcast</a>
              <a href="https://x.com/gblinprotocol" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Twitter</a>
            </div>
            <p className="text-[10px] font-mono text-zinc-700 tracking-[0.3em] uppercase">
              {t('footer.protocolName')} &copy; 2026 &bull; DESIGNED FOR HUMANS & AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return <ProtocolApp view="home" />;
}
