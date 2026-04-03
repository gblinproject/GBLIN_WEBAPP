import { ethers } from 'ethers';
import type { Language } from '@/translations/index';

export interface DashboardData {
  priceUsd: number;
  volume24h: number;
  ethPriceUsd: number;
}

export interface TransactionItem {
  type: string;
  time: string;
  hash: string;
  full_hash: string;
  from: string;
  to: string;
  value: string;
  is_rebalance: boolean;
}

export interface BasketItem {
  name: 'cbBTC' | 'WETH' | 'USDC';
  address: string;
  price: number;
  balance: number;
  tvl: number;
  peakPrice: number;
  baseWeight: number;
  dynamicWeight: number;
  realWeight: number;
}

export interface OnChainData {
  totalSupply: string;
  nav: string;
  tvl: number;
  supplyNum: number;
  lastYield: number;
  stabilityFund: string;
  dynamicReserve: string;
  basketData: BasketItem[];
  apyData?: {
    totalVolume: number;
    transactionCount: number;
    estimatedApy: string;
    timeframe: string;
  } | null;
}

export type RebalanceDirection = 'weth-to-asset' | 'asset-to-weth';

export const RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/vmGhuXCFK00G8nr3RxRFt';
export const CONTRACT_ADDRESS = '0x38DcDB3A381677239BBc652aed9811F2f8496345';
export const AERODROME_POOL = '0xdaecc15bf028bc4d135260d044b87001dafb3c22';
export const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZCI6IjNjZmE1NWI1LWUxZDYtNGRhOS1iNjE5LTRmZGI5MjMwMTBhMCIsIm9yZ0lkIjoiNTA3NzcxIiwidXNlcklkIjoiNTIyNDYyIiwidHlwZUlkIjoiYTc1MzFkNjctOWMwZS00Yjg3LWE2ZDgtMTQ3ZDU3MzQ1YjYyIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NzQ5ODE0ODgsImV4cCI6NDkzMDc0MTQ4OH0.ET2R55zvlleoauhaUcJYqaQkUafLTzzCwFFEb07YTC8';
export const BASE_CHAIN_ID = 8453;
export const WHITEPAPER_URL = 'https://raw.githubusercontent.com/gblinproject/Whitepaper/main/GBLIN_WHITE_PAPER_V3.pdf';
export const LOGO_URL = 'https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png';

export const LANGUAGES: Array<{ code: Language; name: string; flag: string }> = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

export const TOKENS = ['ETH', 'USDC', 'cbBTC', 'DEGEN', 'AERO', 'BRETT', 'SHIB'];

export const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  DEGEN: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
  AERO: '0x940181a94a35a4563e89545161c888d3d9804b08',
  BRETT: '0x532f27101965dd1a44836f731139783f98018e69',
  SHIB: '0x45cfe390b83a0552f1469797070107297e632837'
};

export const GBLIN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function stabilityFund() view returns (uint256)',
  'function basket(uint256) view returns (address token, address oracle, uint24 poolFee, bool isStable, uint256 baseWeight, uint256 dynamicWeight, uint256 peakPrice, uint256 lastPeakUpdate)',
  'function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap) external',
  'function buyGBLIN(uint256 minGblinOut) external payable',
  'function buyGBLINWithToken(bytes calldata path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut) external',
  'function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external',
  'function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)',
  'function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)',
  'function refreshWeights() public',
  'function lastYieldDistribution() view returns (uint256)',
  'function getDynamicReserve() view returns (uint256)',
  'error SequencerDown()',
  'error StaleOracle(address oracle)',
  'error DepositTooSmall()',
  'error SlippageExceeded()',
  'error Unauthorized()',
  'error CooldownActive()',
  'error RebalanceNotNeeded()',
  'error OracleDead()',
  'error SwapVolumeTooLow()',
  'error InvalidFinalToken()'
];

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export const ORACLE_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

export const REBALANCE_ASSET_OPTIONS = [
  { name: 'cbBTC', basketIndex: 0, decimals: 8 },
  { name: 'USDC', basketIndex: 2, decimals: 6 }
] as const;

export const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export const formatCurrency = (value: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);

export const formatTokenAmount = (value: number, maxFractionDigits: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const formatted = value.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: maxFractionDigits
  });
  return formatted.includes('.') ? formatted.replace(/\.?0+$/, '') : formatted;
};

export const parseUsdText = (value?: string | null) => {
  if (!value) return 0;
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0;
};

export const fetchMarketData = async (): Promise<DashboardData> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

    let priceUsd = 0;
    let ethPriceUsd = 3500;

    try {
      const llamaRes = await fetch('https://coins.llama.fi/prices/current/ethereum:0x0000000000000000000000000000000000000000?searchWidth=4h');
      if (llamaRes.ok) {
        const llamaData = await llamaRes.json();
        const price = llamaData.coins['ethereum:0x0000000000000000000000000000000000000000']?.price;
        if (price) ethPriceUsd = price;
      }

      const quoteSell = await contract.quoteSellGBLIN(ethers.parseEther('1'));
      const ethOut = parseFloat(ethers.formatEther(quoteSell));
      priceUsd = ethOut * ethPriceUsd;
    } catch {}

    const statsUrl = `https://deep-index.moralis.io/api/v2.2/erc20/${CONTRACT_ADDRESS}/stats?chain=base`;
    const statsRes = await fetch(statsUrl, {
      headers: {
        accept: 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    let volume24h = 0;
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      volume24h = statsData?.volume_24h_usd || 0;
    }

    if (priceUsd === 0 || volume24h === 0) {
      try {
        const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACT_ADDRESS}`);
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          if (dsData.pairs && dsData.pairs.length > 0) {
            const pair = dsData.pairs.find((item: any) => item.chainId === 'base') || dsData.pairs[0];
            if (priceUsd === 0) priceUsd = parseFloat(pair.priceUsd) || 0;
            if (volume24h === 0) volume24h = pair.volume?.h24 || 0;
          }
        }
      } catch {}
    }

    return {
      priceUsd: priceUsd || 0,
      volume24h: volume24h || 0,
      ethPriceUsd
    };
  } catch {
    return { priceUsd: 0, volume24h: 0, ethPriceUsd: 3500 };
  }
};

export const fetchTransactions = async (): Promise<TransactionItem[]> => {
  try {
    const txUrl = `https://deep-index.moralis.io/api/v2.2/${CONTRACT_ADDRESS}?chain=base&order=DESC&limit=20`;
    const erc20Url = `https://deep-index.moralis.io/api/v2.2/erc20/${CONTRACT_ADDRESS}/transfers?chain=base&order=DESC&limit=20`;

    const [txRes, erc20Res] = await Promise.all([
      fetch(txUrl, { headers: { accept: 'application/json', 'X-API-Key': MORALIS_API_KEY } }),
      fetch(erc20Url, { headers: { accept: 'application/json', 'X-API-Key': MORALIS_API_KEY } })
    ]);

    let allTx: any[] = [];

    if (txRes.ok) {
      const data = await txRes.json();
      if (data && Array.isArray(data.result)) {
        allTx = [
          ...allTx,
          ...data.result.map((tx: any) => ({
            ...tx,
            source: 'CONTRACT',
            timestamp: new Date(tx.block_timestamp).getTime(),
            hash: tx.hash
          }))
        ];
      }
    }

    if (erc20Res.ok) {
      const data = await erc20Res.json();
      if (data && Array.isArray(data.result)) {
        allTx = [
          ...allTx,
          ...data.result.map((tx: any) => ({
            ...tx,
            source: 'ERC20',
            timestamp: new Date(tx.block_timestamp).getTime(),
            hash: tx.transaction_hash,
            from_address: tx.from_address,
            to_address: tx.to_address,
            value: tx.value
          }))
        ];
      }
    }

    const uniqueTx = Array.from(new Map(allTx.map((tx) => [tx.hash, tx])).values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);

    return uniqueTx.map((tx: any) => {
      let type = 'OTHER';
      const input = tx.input ? tx.input.toLowerCase() : '0x';
      const from = tx.from_address?.toLowerCase();
      const to = tx.to_address?.toLowerCase();
      const contractLower = CONTRACT_ADDRESS.toLowerCase();
      const aerodromeLower = AERODROME_POOL.toLowerCase();

      if (input.includes('0x4641257d') || input.includes('0x8bc0d9f4')) {
        type = 'REBALANCE';
      } else if (tx.source === 'ERC20') {
        if (from === aerodromeLower || to === contractLower || from === '0x0000000000000000000000000000000000000000') {
          type = 'BUY';
        } else if (to === aerodromeLower || from === contractLower) {
          type = 'SELL';
        }
      } else {
        if (input.includes('0xefef39a1') || input.includes('0x16938992') || (tx.value !== '0' && to === contractLower)) {
          type = 'BUY';
        } else if (input.includes('0x49999999') || from === contractLower) {
          type = 'SELL';
        }
      }

      return {
        type,
        time: new Date(tx.timestamp).toLocaleString(),
        hash: shortenAddress(tx.hash),
        full_hash: tx.hash,
        from: shortenAddress(tx.from_address || ''),
        to: shortenAddress(tx.to_address || ''),
        value: parseFloat(ethers.formatEther(tx.value || '0')).toFixed(4),
        is_rebalance: type === 'REBALANCE'
      };
    });
  } catch {
    return [];
  }
};

export const fetchOnChainData = async (): Promise<OnChainData> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);

    const totalSupply = await contract.totalSupply().catch(() => 0n);
    const contractBalance = await contract.balanceOf(CONTRACT_ADDRESS).catch(() => 0n);
    const supplyFormatted = parseFloat(ethers.formatEther(totalSupply));
    const contractBalanceFormatted = parseFloat(ethers.formatEther(contractBalance));
    const lastYield = await contract.lastYieldDistribution().catch(() => 0n);
    const stabilityFundRaw = await contract.stabilityFund().catch(() => 0n);
    const dynamicReserve = await contract.getDynamicReserve().catch(() => 0n);

    const activeSupply = supplyFormatted - contractBalanceFormatted;

    let tvl = 0;
    const basketItems: BasketItem[] = [];

    for (let i = 0; i < 3; i += 1) {
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
          price,
          balance: balanceFormatted,
          tvl: assetTvl,
          peakPrice: Number(basketItem[6]) / 1e8,
          baseWeight: Number(basketItem[4]),
          dynamicWeight: Number(basketItem[5]),
          realWeight: 0
        });
      } catch {}
    }

    if (tvl > 0) {
      basketItems.forEach((item) => {
        item.realWeight = (item.tvl / tvl) * 100;
      });
    }

    const nav = activeSupply > 0 ? tvl / activeSupply : 1;
    const stabilityFund = Number.parseFloat(ethers.formatEther(stabilityFundRaw));
    const reserveRatio = tvl > 0 ? stabilityFund / tvl : 0;
    const estimatedApy = (6 + Math.min(reserveRatio * 1200, 6)).toFixed(2);

    return {
      totalSupply: supplyFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 }),
      nav: formatCurrency(nav),
      tvl,
      supplyNum: activeSupply,
      lastYield: Number(lastYield),
      stabilityFund: ethers.formatEther(stabilityFundRaw),
      dynamicReserve: ethers.formatEther(dynamicReserve),
      basketData: basketItems,
      apyData: {
        totalVolume: tvl * 0.6,
        transactionCount: 15,
        estimatedApy,
        timeframe: '30 days'
      }
    };
  } catch {
    return {
      totalSupply: '0',
      nav: '$0.00',
      tvl: 0,
      supplyNum: 0,
      lastYield: 0,
      stabilityFund: '0',
      dynamicReserve: '0',
      basketData: [],
      apyData: null
    };
  }
};
