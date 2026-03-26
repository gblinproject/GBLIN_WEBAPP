/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { translations, Language } from '@/translations';
import { 
  Wallet, Globe, Check, ArrowRight, LineChart, Copy, 
  SlidersHorizontal, RefreshCw, AlertCircle, AlertTriangle, Zap, Shield, 
  Landmark, Lock, TrendingUp, Network, Brain, Cpu, Download, Coins
} from 'lucide-react';
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';

const RPC_URL = "https://mainnet.base.org";
const CONTRACT_ADDRESS = "0xc475851f9101A2AC48a84EcF869766A94D301FaA";
const GBLIN_ABI = [
  "function totalSupply() view returns (uint256)",
  "function stabilityFund() view returns (uint256)",
  "function basket(uint256) view returns (address token, address oracle, uint24 poolFee, bool isStable, uint256 baseWeight, uint256 dynamicWeight, uint256 peakPrice, uint256 lastPeakUpdate)",
  "function incentivizedRebalance() external",
  "function buyGBLIN(uint256 minGblinOut) external payable",
  "function buyGBLINWithToken(bytes calldata path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut) external",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external",
  "function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)",
  "function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)",
  "function balanceOf(address account) view returns (uint256)",
  "error SequencerDown()",
  "error StaleOracle(address oracle)",
  "error DepositTooSmall()",
  "error SlippageExceeded()",
  "error Unauthorized()",
  "error CooldownActive()",
  "error RebalanceNotNeeded()",
  "error OracleDead()"
];

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

const MOCK_TRANSACTIONS = [
  { type: 'TRANSAZIONE', time: '24/03/2026, 22:08:05', hash: '0x13a2...d094', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '22/03/2026, 16:15:45', hash: '0x3975...8c03', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '21/03/2026, 10:57:43', hash: '0xb094...564a', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '21/03/2026, 10:54:05', hash: '0x0c02...9047', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00120000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '21/03/2026, 00:05:53', hash: '0x40e6...5368', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '21/03/2026, 00:05:37', hash: '0x58c6...f2c9', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'REBALANCE', time: '19/03/2026, 20:52:41', hash: '0xcd56...deca', from: '0x14d4...83a1', to: '0xc475...1FaA', value: '0.00000000', isRebalance: true },
  { type: 'TRANSAZIONE', time: '19/03/2026, 20:45:29', hash: '0xbd3f...f3fd', from: '0x14d4...83a1', to: '0xc475...1FaA', value: '0.00000000', isRebalance: false },
  { type: 'TRANSAZIONE', time: '18/03/2026, 14:22:11', hash: '0x1a2b...3c4d', from: '0x9ffa...a9ee', to: '0xc475...1FaA', value: '0.00500000', isRebalance: false },
  { type: 'REBALANCE', time: '17/03/2026, 09:11:02', hash: '0x5e6f...7g8h', from: '0x14d4...83a1', to: '0xc475...1FaA', value: '0.00000000', isRebalance: true },
];

export default function Home() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  const [language, setLanguage] = useState<Language>('it');
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dashboard state
  const [supply, setSupply] = useState('---');
  const [stabilityFund, setStabilityFund] = useState('---');
  const [ethBalance, setEthBalance] = useState('0.0000');
  const [tokenBalance, setTokenBalance] = useState('0.0000');
  const [gblinBalance, setGblinBalance] = useState('0.0000');

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
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('it-IT'));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('it-IT'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const t = useMemo(() => {
    const dict = translations[language] || translations['en'];
    return (key: string) => {
      const keys = key.split('.');
      let val: any = dict;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          return key;
        }
      }
      return val as string;
    };
  }, [language]);

  const displayQuote = useMemo(() => {
    if (quote === '0') return '0.00';
    const num = parseFloat(quote);
    if (num === 0) return '0.00';
    if (num < 0.000001) return quote;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }, [quote]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchData = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

      const [totalSupply, stabFund] = await Promise.all([
        contract.totalSupply().catch(() => 0n),
        contract.stabilityFund().catch(() => 0n)
      ]);
      
      setSupply(parseFloat(ethers.formatEther(totalSupply)).toLocaleString(undefined, {maximumFractionDigits: 2}));
      setStabilityFund(parseFloat(ethers.formatEther(stabFund)).toFixed(8));

      if (address) {
        const [ethBal, gblinBal] = await Promise.all([
          provider.getBalance(address),
          contract.balanceOf(address).catch(() => 0n)
        ]);
        setEthBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(8));
        setGblinBalance(parseFloat(ethers.formatEther(gblinBal)).toFixed(8));

        // Fetch selected token balance
        if (selectedToken === 'ETH') {
          setTokenBalance(parseFloat(ethers.formatEther(ethBal)).toFixed(8));
        } else {
          const tokenContract = new ethers.Contract(TOKEN_ADDRESSES[selectedToken], ERC20_ABI, provider);
          const [bal, decimals] = await Promise.all([
            tokenContract.balanceOf(address).catch(() => 0n),
            tokenContract.decimals().catch(() => 18)
          ]);
          setTokenBalance(parseFloat(ethers.formatUnits(bal, decimals)).toFixed(8));
        }
      } else {
        setEthBalance('0.00000000');
        setGblinBalance('0.00000000');
        setTokenBalance('0.00000000');
      }

      // Fetch basket details
      const basket0 = await contract.basket(0).catch(() => null);
      const basket1 = await contract.basket(1).catch(() => null);
      const basket2 = await contract.basket(2).catch(() => null);

      let tvlUsd = 0;
      const weights = [];

      if (basket0 && basket1 && basket2) {
        const baskets = [basket0, basket1, basket2];
        const symbols = ['cbBTC', 'WETH', 'USDC']; // Based on constructor order in contract
        
        for (let i = 0; i < baskets.length; i++) {
          const b = baskets[i];
          const tokenContract = new ethers.Contract(b.token, ERC20_ABI, provider);
          const oracleContract = new ethers.Contract(b.oracle, ORACLE_ABI, provider);
          
          const [bal, decimals, roundData] = await Promise.all([
            tokenContract.balanceOf(CONTRACT_ADDRESS).catch(() => 0n),
            tokenContract.decimals().catch(() => 18),
            oracleContract.latestRoundData().catch(() => ({ answer: 0n }))
          ]);
          
          const priceUsd = Number(ethers.formatUnits(roundData.answer, 8)); // Chainlink USD pairs have 8 decimals
          const balance = Number(ethers.formatUnits(bal, decimals));
          const valueUsd = balance * priceUsd;
          
          tvlUsd += valueUsd;
          
          weights.push({
            symbol: symbols[i],
            actual: 0, // Will calculate after loop
            dynamic: Number(b.dynamicWeight) / 100, // BPS to percentage
            base: Number(b.baseWeight) / 100,
            valueUsd
          });
        }
        
        // Calculate actual weights
        weights.forEach(w => {
          w.actual = tvlUsd > 0 ? (w.valueUsd / tvlUsd) * 100 : 0;
        });
      }

      setStats({
        tvlUsd: tvlUsd,
        fundEth: parseFloat(ethers.formatEther(stabFund)) || 0,
        weights: weights.length > 0 ? weights : [
          { symbol: 'cbBTC', actual: 45, dynamic: 45, base: 45 },
          { symbol: 'WETH', actual: 45, dynamic: 45, base: 45 },
          { symbol: 'USDC', actual: 10, dynamic: 10, base: 10 }
        ]
      });
    } catch (e) {
      console.error("Error fetching data", e);
    }
  }, [address, selectedToken]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateAmount = async (val: string) => {
    val = val.replace(',', '.');
    setAmount(val);
    
    if (!val || isNaN(Number(val)) || Number(val) <= 0) {
      setQuote('0');
      setRawQuote(0n);
      return;
    }

    setIsLoadingQuote(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

      if (mode === 'buy') {
        const wethAmount = ethers.parseEther(val);
        const result = await contract.quoteBuyGBLIN(wethAmount);
        
        const gblinOut = result[0] ? BigInt(result[0]) : 0n;
        const founderFee = result[1] ? BigInt(result[1]) : 0n;
        const stabFee = result[2] ? BigInt(result[2]) : 0n;
        
        let netGblinOut = gblinOut - founderFee - stabFee;
        const safetyMargin = (netGblinOut * 35n) / 1000n;
        netGblinOut = netGblinOut - safetyMargin;
        
        setRawQuote(netGblinOut);
        setQuote(ethers.formatEther(netGblinOut));

        // Calculate USD value
        if (stats && stats.tvlUsd && supply !== '---') {
            const supplyNum = parseFloat(supply.replace(/,/g, ''));
            const pricePerGblin = stats.tvlUsd / supplyNum;
            setUsdValue((Number(val) * pricePerGblin).toFixed(2));
        }
      } else {
        const parsedAmount = ethers.parseEther(val);
        const ethOut = await contract.quoteSellGBLIN(parsedAmount);
        const netEthOut = BigInt(ethOut);
        
        setRawQuote(netEthOut);
        setQuote(ethers.formatEther(netEthOut));
      }
    } catch (e) {
      console.error("Quote error:", e);
      setQuote('0');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleTrade = async (force = false) => {
    if (!isConnected || !window.ethereum || !amount || Number(amount) <= 0) return;

    try {
      setIsTransacting(true);
      setTradeError(null);
      setShowForceOption(false);
      setTradeTxHash(null);

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      
      if (network.chainId !== 8453n) {
        setTradeError(t('trade.errors.wrongNetwork'));
        setIsTransacting(false);
        return;
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, signer);

      const slippageBps = BigInt(Math.round(slippage * 100));
      const minOut = (rawQuote * (10000n - slippageBps)) / 10000n;

      let tx;
      if (mode === 'buy') {
        const parsedAmount = ethers.parseEther(amount);
        const data = contract.interface.encodeFunctionData("buyGBLIN", [minOut]);
        console.log("Buying GBLIN:", { minOut: minOut.toString(), value: parsedAmount.toString(), data });
        tx = await signer.sendTransaction({
          to: CONTRACT_ADDRESS,
          data: data,
          value: parsedAmount
        });
      } else {
        const parsedAmount = ethers.parseEther(amount);
        tx = await contract.sellGBLINForEth(parsedAmount, minOut);
      }
      
      setTradeTxHash(tx.hash);
      await tx.wait();
      setAmount('');
      setQuote('0');
      fetchData();
    } catch (err: any) {
      console.error(err);
      setTradeError(err.message || t('trade.errors.txError'));
    } finally {
      setIsTransacting(false);
    }
  };

  const handleArbitrage = async () => {
    if (!isConnected || !window.ethereum) {
      open();
      return;
    }

    try {
      setIsArbitraging(true);
      setArbError(null);
      setArbTxHash(null);

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, signer);

      const tx = await contract.incentivizedRebalance({ gasLimit: 1000000 });
      setArbTxHash(tx.hash);
      await tx.wait();
      fetchData();
    } catch (err: any) {
      console.error(err);
      setArbError(err.message || t('trade.errors.txError'));
    } finally {
      setIsArbitraging(false);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-amber-500/30 bg-[#050505] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 aspect-square rounded-full overflow-hidden">
              <img 
                src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png"
                alt="GBLIN Logo"
                className="object-cover scale-[1.02] w-full h-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-serif text-3xl tracking-tighter font-bold bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 bg-clip-text text-transparent">GBLIN</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium tracking-widest uppercase opacity-60">
            <a href="#" className="hover:opacity-100 transition-opacity">HOME</a>
            <a href="#concept" className="hover:opacity-100 transition-opacity">{t('nav.manifesto')}</a>
            <a href="#core" className="hover:opacity-100 transition-opacity">{t('nav.core')}</a>
            <a href="#agents" className="hover:opacity-100 transition-opacity">{t('nav.agents')}</a>
            <a href="#vault" className="hover:opacity-100 transition-opacity">VAULT</a>
            <a href="#dashboard" className="hover:opacity-100 transition-opacity">{t('nav.dashboard')}</a>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <button 
                  onClick={() => open()}
                  className="px-4 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  <Wallet size={14} />
                  {t('nav.connect')}
                </button>
              ) : (
                <button 
                  onClick={() => open()}
                  className="px-4 py-2 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-amber-400 transition-all flex items-center gap-2"
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </button>
              )}
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowLangSelector(!showLangSelector)}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
              >
                <Globe size={14} className="text-amber-500" />
                {language}
              </button>
              
              {showLangSelector && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code as Language); setShowLangSelector(false); }}
                      className={`w-full px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center justify-between transition-colors ${language === lang.code ? 'text-amber-500 bg-amber-500/5' : 'text-zinc-400'}`}
                    >
                      <span>{lang.flag} {lang.name}</span>
                      {language === lang.code && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[95vh] flex flex-col justify-center pt-20 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/15 via-amber-900/5 to-transparent blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-50"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-12 hover:bg-white/10 transition-colors cursor-pointer group">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-white/80 group-hover:text-white transition-colors">{t('dashboard.verifiedOnBase')}</span>
              <ArrowRight size={14} className="text-white/40 group-hover:text-white transition-colors" />
            </div>
            
            <h1 className="font-serif text-6xl md:text-[130px] leading-[0.85] mb-8 tracking-tighter">
              THE GOLDEN <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 italic pr-4">VAULT</span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg md:text-2xl text-white/50 font-light leading-relaxed mb-14">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16">
              <a 
                href="#trade"
                className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-amber-500 text-black text-sm font-bold uppercase tracking-widest rounded-full hover:bg-amber-400 transition-all overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)] hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <span className="relative z-10">{t('hero.cta')}</span>
                <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              </a>
              <a 
                href="https://www.geckoterminal.com/base/pools/0xdaecc15bf028bc4d135260d044b87001dafb3c22"
                target="_blank"
                className="group flex items-center justify-center gap-3 px-10 py-5 bg-white/5 border border-white/10 text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-white/10 transition-all backdrop-blur-md hover:-translate-y-1"
              >
                LIVE CHART 
                <LineChart size={18} className="text-white/50 group-hover:text-white transition-colors" />
              </a>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={copyToClipboard}
                className="group flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full hover:border-white/30 transition-all hover:bg-white/5"
              >
                <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Contract</span>
                <code className="font-mono text-xs text-white/80 tracking-wider">
                  {CONTRACT_ADDRESS}
                </code>
                {copied ? (
                  <Check size={16} className="text-emerald-500" />
                ) : (
                  <Copy size={16} className="text-white/30 group-hover:text-white transition-colors" />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trade Section */}
      <section id="trade" className="py-20 px-6 bg-[#050505] border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="flex-1 space-y-8 text-center lg:text-left">
              <span className="text-amber-500 text-xs font-mono uppercase tracking-[0.3em]">{t('trade.title')}</span>
              <h2 className="font-serif text-5xl md:text-6xl tracking-tight leading-tight">
                {t('trade.heading')} <br />
                <span className="italic text-amber-500">{t('trade.subheading')}</span>
              </h2>
              <p className="text-white/60 leading-relaxed text-lg max-w-xl mx-auto lg:mx-0">
                {t('trade.desc')}
              </p>
              
              <div className="flex flex-col gap-4 pt-4 max-w-md mx-auto lg:mx-0">
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Check size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">{t('trade.feature1Title')}</h4>
                    <p className="text-sm text-zinc-400">{t('trade.feature1Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Network size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-1">{t('trade.feature2Title')}</h4>
                    <p className="text-sm text-zinc-400">{t('trade.feature2Desc')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full max-w-md lg:max-w-none flex justify-center">
              <div className="w-full max-w-md mx-auto bg-[#050505] border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative text-left group hover:border-white/20 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                
                <div className="flex border-b border-white/10 relative z-10">
                  <button 
                    onClick={() => { setMode('buy'); setAmount(''); setQuote('0'); }}
                    className={`flex-1 py-5 text-xs font-bold uppercase tracking-widest transition-all ${mode === 'buy' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                  >
                    Mint (Zap-In)
                  </button>
                  <button 
                    onClick={() => { setMode('sell'); setAmount(''); setQuote('0'); }}
                    className={`flex-1 py-5 text-xs font-bold uppercase tracking-widest transition-all ${mode === 'sell' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                  >
                    Redeem (Zap-Out)
                  </button>
                </div>

                <div className="p-6 space-y-6 relative z-10">
                  {mode === 'buy' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">
                          <span>Input Asset</span>
                          <span>Balance: {tokenBalance} {selectedToken}</span>
                        </div>
                        <select 
                          value={selectedToken}
                          onChange={(e) => setSelectedToken(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500/50 transition-all"
                        >
                          {TOKENS.map(token => (
                            <option key={token} value={token}>{token}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">
                          <span>Amount</span>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center justify-between focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all">
                          <input 
                            type="number"
                            value={amount}
                            onChange={(e) => updateAmount(e.target.value)}
                            placeholder="0.0"
                            className="bg-transparent text-4xl font-serif text-white outline-none w-full placeholder:text-zinc-700"
                          />
                          <span className="text-sm text-zinc-500 font-mono">≈ ${usdValue}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 cursor-pointer" onClick={() => setRedeemOption('pro-rata')}>
                          <input type="radio" checked={redeemOption === 'pro-rata'} readOnly className="accent-amber-500" />
                          <span className="text-sm font-bold">Rimborso Frazionario (Pro-Rata)</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 cursor-pointer" onClick={() => setRedeemOption('zap-out')}>
                          <input type="radio" checked={redeemOption === 'zap-out'} readOnly className="accent-amber-500" />
                          <span className="text-sm font-bold">Uscita Singola (Zap-Out)</span>
                        </div>
                      </div>
                      {redeemOption === 'zap-out' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">
                            <span>Output Asset</span>
                          </div>
                          <select 
                            value={outputAsset}
                            onChange={(e) => setOutputAsset(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500/50 transition-all"
                          >
                            {['WETH', 'cbBTC', 'USDC'].map(token => (
                              <option key={token} value={token}>{token}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">
                          <span>Amount GBLIN</span>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center justify-between focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all">
                          <input 
                            type="number"
                            value={amount}
                            onChange={(e) => updateAmount(e.target.value)}
                            placeholder="0.0"
                            className="bg-transparent text-4xl font-serif text-white outline-none w-full placeholder:text-zinc-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal size={14} />
                      <span>{t('trade.slippage')}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[0.5, 1, 2, 3, 5].map(val => (
                        <button 
                          key={val}
                          onClick={() => setSlippage(val)}
                          className={`px-2.5 py-1 rounded-md transition-colors ${slippage === val ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    {!isConnected ? (
                      <button
                        onClick={() => open()}
                        className="w-full py-4 bg-white text-black text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                      >
                        <Wallet size={18} />
                        {t('nav.connect')}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={() => handleTrade()}
                          disabled={isTransacting || !amount || amount === '0' || isLoadingQuote}
                          className="w-full py-4 bg-amber-500 text-black text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        >
                          {isTransacting ? (
                            <><RefreshCw size={18} className="animate-spin" /> {t('trade.transacting')}</>
                          ) : !amount || amount === '0' ? (
                            t('trade.enterAmount')
                          ) : (
                            mode === 'buy' ? t('trade.buyBtn') : t('trade.sellBtn')
                          )}
                        </button>
                        <button
                          onClick={() => disconnect()}
                          className="w-full py-3 bg-transparent border border-white/10 text-zinc-500 text-[10px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all rounded-xl"
                        >
                          {t('trade.disconnect')}
                        </button>
                      </div>
                    )}
                  </div>

                  {tradeError && (
                    <div className={`p-3 rounded-xl flex items-start gap-2 text-xs mt-4 ${showForceOption ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      {showForceOption ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                      <div className="space-y-2">
                        <p className="break-words">{tradeError}</p>
                        {showForceOption && (
                          <button 
                            onClick={() => handleTrade(true)}
                            disabled={isTransacting}
                            className="px-3 py-1.5 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1"
                          >
                            <Zap size={14} />
                            {t('trade.forceSend')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {tradeTxHash && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-emerald-400 text-xs mt-4">
                      {isTransacting ? <RefreshCw size={14} className="animate-spin mt-0.5 shrink-0" /> : <Check size={14} className="mt-0.5 shrink-0" />}
                      <div>
                        <p className="font-bold mb-0.5">
                          {isTransacting ? t('trade.transacting') : t('trade.success')}
                        </p>
                        <a 
                          href={`https://basescan.org/tx/${tradeTxHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-emerald-300"
                        >
                          {t('trade.viewTx')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Presentation Letter Section */}
      <section id="concept" className="py-32 px-6 bg-[#050505]">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="space-y-4">
            <h2 className="font-serif text-4xl md:text-5xl tracking-tight leading-tight">
              {t('manifesto.title')}
            </h2>
          </div>
          
          <div className="space-y-8 text-white/70 font-light leading-relaxed text-lg">
            <p>
              {t('manifesto.text')}
            </p>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Shield size={24} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-widest">{t('common.protocol')}</p>
                <p className="text-xs text-white/40 uppercase tracking-widest">{t('common.centralBank')}</p>
              </div>
            </div>
            <a 
              href={`https://basescan.org/token/${CONTRACT_ADDRESS}`}
              target="_blank"
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
            >
              {t('common.verifyContract')} <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Yield Mechanism Section */}
      <section id="yield" className="py-32 px-6 bg-[#080808] border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20 space-y-4">
            <h2 className="font-serif text-4xl md:text-5xl tracking-tight leading-tight">
              {t('yield.title')}
            </h2>
            <p className="text-amber-500 font-mono uppercase tracking-widest text-sm">
              {t('yield.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                <Landmark size={24} className="text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{t('yield.accumulationTitle')}</h3>
              <p className="text-white/60 leading-relaxed text-sm">
                {t('yield.accumulationDesc')}
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                <Lock size={24} className="text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{t('yield.mechanismTitle')}</h3>
              <p className="text-white/60 leading-relaxed text-sm">
                {t('yield.mechanismDesc')}
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                <TrendingUp size={24} className="text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{t('yield.actionTitle')}</h3>
              <p className="text-white/60 leading-relaxed text-sm">
                {t('yield.actionDesc')}
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                <Zap size={24} className="text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{t('yield.automationTitle')}</h3>
              <p className="text-white/60 leading-relaxed text-sm">
                {t('yield.automationDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GBLIN CORE Section */}
      <section id="core" className="py-32 px-6 bg-[#080808] border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="flex-1 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold tracking-widest uppercase">
                <Network size={14} />
                {t('core.title')}
              </div>
              <h2 className="font-serif text-5xl md:text-7xl tracking-tighter leading-[0.9]">
                {t('core.subtitle')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
                  <h3 className="text-xl font-serif italic text-amber-500">{t('core.m2mTitle')}</h3>
                  <p className="text-white/60 leading-relaxed text-sm">
                    {t('core.m2mDesc')}
                  </p>
                </div>
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4 hover:border-amber-500/30 transition-colors">
                  <h3 className="text-xl font-serif italic text-amber-500">{t('core.solvencyTitle')}</h3>
                  <p className="text-white/60 leading-relaxed text-sm">
                    {t('core.solvencyDesc')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full max-w-lg">
              <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 space-y-6">
                <h3 className="text-2xl font-serif italic text-white">Crash Shield & Vault Radar</h3>
                <div className="space-y-4">
                  {!stats ? (
                    <div className="text-zinc-500 text-sm italic py-4 animate-pulse">Caricamento dati in corso...</div>
                  ) : (
                    stats.weights.map((w: any) => (
                      <div key={w.symbol} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-white">{w.symbol}</span>
                          <span className="font-mono text-xs text-zinc-500">{w.actual.toFixed(1)}% / {w.base.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="h-2 flex-1 bg-[#111] rounded-full overflow-hidden flex">
                            <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${w.actual}%` }}></div>
                          </div>
                          <div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500">
                            INATTIVO / SAFE
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agents Section */}
      <section id="agents" className="py-32 px-6 bg-[#050505] relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <span className="text-amber-500 text-xs font-mono uppercase tracking-[0.3em]">{t('agents.title')}</span>
            <h2 className="font-serif text-5xl md:text-6xl tracking-tight">
              {t('core.sdkTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-[#050505] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col group hover:border-white/20 transition-colors duration-500">
              <div className="px-5 py-3 bg-[#0a0a0a] border-b border-white/5 flex items-center gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
                </div>
                <div className="flex-1 text-center pr-10">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">gblin-agent-sdk.ts</span>
                </div>
              </div>
              <div className="p-8 font-mono text-sm space-y-4 overflow-x-auto bg-[#050505]">
                <div className="text-zinc-600">{"// "}{t('agents.directive')}</div>
                <div className="text-amber-400">const GBLIN_DIRECTIVE = &quot;{t('agents.directiveCode')}&quot;;</div>
                <div className="pt-4 text-zinc-400">
                  <span className="text-blue-400">async function</span> <span className="text-emerald-400">ensureSolvency</span>(agent: Agent) {'{'}<br/>
                  <span className="pl-4 text-blue-400">const</span> balance = <span className="text-blue-400">await</span> agent.getBalance(<span className="text-green-400">&apos;GBLIN&apos;</span>);<br/>
                  <span className="pl-4 text-blue-400">if</span> (balance {'<'} agent.minSolvencyFloor) {'{'}<br/>
                  <span className="pl-8 text-zinc-600">{"// "}{t('core.autoRebalance')}</span><br/>
                  <span className="pl-8 text-blue-400">await</span> agent.swapToGBLIN(agent.shortfall);<br/>
                  <span className="pl-4">{'}'}</span><br/>
                  {'}'}
                </div>
              </div>
              <div className="mt-auto p-6 bg-[#0a0a0a] border-t border-white/5">
                <a href="https://github.com/gblinproject/gblin-dapp" target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-3">
                  <Download size={18} />
                  {t('core.cta')}
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-3xl space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Brain size={24} className="text-amber-500" />
                </div>
                <h3 className="text-2xl font-serif italic text-white">{t('agents.integrationTitle')}</h3>
                <p className="text-white/60 leading-relaxed">
                  {t('agents.integrationDesc')}
                </p>
              </div>
              
              <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Cpu size={24} className="text-white" />
                </div>
                <h3 className="text-2xl font-serif italic text-white">{t('core.sdkTitle')}</h3>
                <p className="text-white/60 leading-relaxed">
                  {t('core.sdkDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-32 px-6 bg-[#020202] relative border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-6">
              {t('architecture.title').split(' ').slice(0, 1).join(' ')} <span className="italic text-amber-500">{t('architecture.title').split(' ').slice(1).join(' ')}</span>
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto text-lg font-light">{t('architecture.desc')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
            <div className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-[2rem] p-12 relative overflow-hidden group hover:border-amber-500/30 transition-colors duration-500">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full group-hover:bg-amber-500/20 transition-colors duration-700"></div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-auto group-hover:scale-110 transition-transform duration-500">
                  <Shield size={32} className="text-amber-500" />
                </div>
                <div>
                  <h4 className="text-4xl font-serif italic mb-6">{t('features.crashShield.title')}</h4>
                  <p className="text-xl text-white/50 leading-relaxed max-w-lg font-light">{t('features.crashShield.desc')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/20 hover:bg-white/[0.04] transition-all duration-500 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-auto group-hover:scale-110 transition-transform duration-500">
                <Zap size={24} className="text-white/80" />
              </div>
              <div>
                <h4 className="text-2xl font-serif italic mb-3">{t('features.centralBank.title')}</h4>
                <p className="text-sm text-white/50 leading-relaxed font-light">{t('features.centralBank.desc')}</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group hover:border-white/20 hover:bg-white/[0.04] transition-all duration-500 flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-auto group-hover:scale-110 transition-transform duration-500">
                <TrendingUp size={24} className="text-white/80" />
              </div>
              <div>
                <h4 className="text-2xl font-serif italic mb-3">{t('features.appreciation.title')}</h4>
                <p className="text-sm text-white/50 leading-relaxed font-light">{t('features.appreciation.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Vault Section */}
      <section id="vault" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-20 items-center">
            <div className="flex-1 space-y-8">
              <h2 className="font-serif text-5xl md:text-6xl tracking-tight">
                {t('vault.title').split(' ').slice(0, -2).join(' ')} <br />
                <span className="italic text-amber-500">{t('vault.title').split(' ').slice(-2).join(' ')}</span>
              </h2>
              <p className="text-white/60 leading-relaxed">
                {t('vault.desc')}
              </p>
              
              <div className="pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-4">
                  <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                    Ethereum (WETH)
                  </span>
                  <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                    Coinbase Bitcoin (cbBTC)
                  </span>
                  <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest opacity-60">
                    USD Coin (USDC)
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

      {/* Dashboard Protocollo Section */}
      <section id="dashboard" className="py-20 px-6 bg-[#050505] border-t border-white/5 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <h2 className="font-serif text-5xl md:text-6xl tracking-tight leading-tight mb-4">
              Dashboard <span className="italic text-amber-500">Protocollo</span>
            </h2>
            <p className="text-white/60 leading-relaxed text-lg max-w-2xl">
              Quando il Valore Intrinseco (NAV) è superiore al Prezzo di Mercato, il token è tecnicamente sottovalutato. Acquistare GBLIN ora garantisce asset a sconto.
            </p>
          </div>

          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            {/* Top row: Contract Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Shield size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-1">CONTRATTO ISTITUZIONALE UFFICIALE</h3>
                  <p className="text-zinc-500 font-mono text-sm mb-1">{CONTRACT_ADDRESS}</p>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">VERIFICATO SU BASE MAINNET • THE GOLDEN VAULT</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-transparent border border-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-white/5 transition-all"
                >
                  COPIA INDIRIZZO
                </button>
                <a 
                  href={`https://basescan.org/token/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  className="px-4 py-2 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all"
                >
                  VERIFICA SU BASESCAN
                </a>
              </div>
            </div>

            {/* Middle row: Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-8">
              {/* Stat 1 */}
              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-2">PREZZO GBLIN POOL</p>
                <p className="text-3xl font-serif text-white mb-2">$2,616.25</p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">AERODROME SLIPSTREAM (1%)</p>
              </div>
              
              {/* Stat 2 */}
              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-2">NAV CONTRATTO GBLIN</p>
                <p className="text-3xl font-serif text-emerald-400 mb-2">$5,506.01</p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">GARANZIA ASSET REALI</p>
              </div>

              {/* Stat 3 */}
              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-2">VOLUME 24H</p>
                <p className="text-3xl font-serif text-white mb-2">$14.85</p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">AERODROME SLIPSTREAM (1%)</p>
              </div>

              {/* Stat 4 */}
              <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-2">OFFERTA TOTALE</p>
                <p className="text-3xl font-serif text-white mb-2">{supply}</p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">GBLIN IN CIRCOLAZIONE</p>
              </div>
            </div>

            {/* Bottom row: Arbitrage Banner */}
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-amber-500" />
                  <h4 className="text-amber-500 font-bold uppercase tracking-widest text-sm">OPPORTUNITÀ DI ARBITRAGGIO</h4>
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  Quando il Valore Intrinseco (NAV) è superiore al Prezzo di Mercato, il token è tecnicamente sottovalutato. Acquistare GBLIN ora garantisce asset a sconto.
                </p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">STATO ATTUALE</p>
                <p className="text-2xl font-bold text-emerald-400">
                  SOTTOVALUTATO <span className="text-sm font-normal opacity-80">(52.48% Sconto)</span>
                </p>
              </div>
            </div>

            {/* Telemetry Section */}
            <div className="bg-[#050505] border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Network size={20} className="text-white" />
                  <h4 className="text-white font-bold uppercase tracking-widest text-sm md:text-base">TELEMETRIA DI RETE LIVE</h4>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <a 
                    href="https://aerodrome.finance/slipstream" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-amber-500/20 transition-all text-center"
                  >
                    FAI TRADING SU SLIPSTREAM (1%)
                  </a>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono uppercase tracking-widest justify-end">
                    <span>ULTIMO AGGIORNAMENTO: {currentTime || '--:--:--'}</span>
                    <button className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/10">
                      <RefreshCw size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                      <th className="p-4 md:p-6 font-normal">TIPO</th>
                      <th className="p-4 md:p-6 font-normal">TEMPO</th>
                      <th className="p-4 md:p-6 font-normal">HASH TX</th>
                      <th className="p-4 md:p-6 font-normal">DA</th>
                      <th className="p-4 md:p-6 font-normal">A</th>
                      <th className="p-4 md:p-6 font-normal text-right">DASHBOARD.VALUEETH</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-mono">
                    {MOCK_TRANSACTIONS.map((tx, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className={`p-4 md:p-6 font-bold uppercase tracking-widest ${tx.isRebalance ? 'text-amber-500' : 'text-blue-400'}`}>
                          {tx.type}
                        </td>
                        <td className="p-4 md:p-6 text-zinc-400">{tx.time}</td>
                        <td className="p-4 md:p-6">
                          <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 transition-colors">
                            {tx.hash}
                          </a>
                        </td>
                        <td className="p-4 md:p-6 text-zinc-400">{tx.from}</td>
                        <td className="p-4 md:p-6 text-zinc-400">{tx.to}</td>
                        <td className="p-4 md:p-6 text-right text-white font-bold">{tx.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rebalancing Section */}
      <section className="py-20 px-6 bg-amber-500/5 border-t border-amber-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <span className="text-amber-500 text-xs font-mono uppercase tracking-[0.3em]">Terminale Arbitraggi (MEV)</span>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
                Stability Fund <br />
                <span className="italic text-amber-500">Bounty</span>
              </h2>
              <p className="text-white/60 leading-relaxed">
                Chiama la funzione incentivizedRebalance() dello Smart Contract. Se il paniere devia dai pesi algoritmici, ripristina l&apos;ancoraggio e il protocollo trasferirà automaticamente il Bounty in ETH al tuo wallet.
              </p>
              <div className="flex items-center gap-4 pt-4">
                {!isConnected ? (
                  <button 
                    onClick={() => open()}
                    className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all flex items-center gap-3 text-lg shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                  >
                    <Wallet size={20} />
                    {t('nav.connect')}
                  </button>
                ) : (
                  <button 
                    onClick={handleArbitrage}
                    disabled={isArbitraging}
                    className="px-8 py-4 bg-amber-500 text-black font-bold rounded-2xl hover:bg-amber-400 transition-all flex items-center gap-3 text-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] disabled:opacity-50"
                  >
                    {isArbitraging ? (
                      <><RefreshCw size={20} className="animate-spin" /> Esecuzione...</>
                    ) : (
                      <><Coins size={20} /> Esegui Ribilanciamento (Earn ETH)</>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-[#0a0a0a] border border-[#333] p-8 rounded-2xl relative overflow-hidden font-mono text-sm text-zinc-400">
                <div className="text-emerald-500 mb-4">{t('mev.codeComment')}</div>
                <div className="space-y-2">
                  <p><span className="text-blue-400">function</span> <span className="text-yellow-200">incentivizedRebalance</span>() <span className="text-blue-400">external</span> {'{'}</p>
                  <p className="pl-4">require(needsRebalance(), <span className="text-green-400">&quot;{t('mev.codeBalanced')}&quot;</span>);</p>
                  <p className="pl-4">_executeSwaps();</p>
                  <p className="pl-4">_payBounty(msg.sender);</p>
                  <p>{'}'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="py-12 px-6 bg-[#020202] border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <img 
                src="https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png"
                alt="GBLIN Logo"
                className="object-cover w-full h-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-500 to-amber-200 bg-clip-text text-transparent">GBLIN Protocol</h3>
              <p className="text-xs text-zinc-500">The Golden Vault</p>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-zinc-400">
            <a href="https://gblin.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Sito Ufficiale</a>
            <a href="mailto:gblin.protocol@proton.me" className="hover:text-amber-500 transition-colors">Email</a>
            <a href="https://x.com/GBLIN_Protocol" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">X (Twitter)</a>
            <a href="https://warpcast.com/gblin" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Warpcast</a>
            <a href="https://github.com/gblinproject/gblin-dapp" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">GitHub</a>
          </div>
          
          <div className="flex flex-col items-end gap-2 text-xs text-zinc-600">
            <a href="https://aerodrome.finance/slipstream/0xdaecc15bf028bc4d135260d044b87001dafb3c22" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Pool Produzione (Aerodrome)</a>
            <a href="https://aerodrome.finance/slipstream/0x2372c88219a821b54c765aa52e47614248659e28" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">Pool V1 (Aerodrome)</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
