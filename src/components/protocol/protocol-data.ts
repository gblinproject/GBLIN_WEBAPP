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

export interface TradeTokenOption {
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
}

export interface TokenRouteQuote {
  path: `0x${string}`;
  amountOut: bigint;
  fees: number[];
  tokens: string[];
}

export type RebalanceDirection = 'weth-to-asset' | 'asset-to-weth';

export const RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/vmGhuXCFK00G8nr3RxRFt';
export const CONTRACT_ADDRESS = '0x38DcDB3A381677239BBc652aed9811F2f8496345';
export const AERODROME_POOL = '0xdaecc15bf028bc4d135260d044b87001dafb3c22';
export const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNjZmE1NWI1LWUxZDYtNGRhOS1iNjE5LTRmZGI5MjMwMTBhMCIsIm9yZ0lkIjoiNTA3NzcxIiwidXNlcklkIjoiNTIyNDYyIiwidHlwZUlkIjoiYTc1MzFkNjctOWMwZS00Yjg3LWE2ZDgtMTQ3ZDU3MzQ1YjYyIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NzQ5ODE0ODgsImV4cCI6NDkzMDc0MTQ4OH0.ET2R55zvlleoauhaUcJYqaQkUafLTzzCwFFEb07YTC8';
export const BASE_CHAIN_ID = 8453;
export const WHITEPAPER_URL = 'https://raw.githubusercontent.com/gblinproject/Whitepaper/main/GBLIN_WHITE_PAPER_V3.pdf';
export const LOGO_URL = 'https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png';
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';

export const LANGUAGES: Array<{ code: Language; name: string; flag: string }> = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

export const TRADE_TOKEN_OPTIONS: TradeTokenOption[] = [
  { symbol: 'ETH', address: WETH_ADDRESS, decimals: 18, isNative: true },
  { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6, isNative: false },
  { symbol: 'cbBTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, isNative: false },
  { symbol: 'DEGEN', address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed', decimals: 18, isNative: false },
  { symbol: 'AERO', address: '0x940181a94a35a4563e89545161c888d3d9804b08', decimals: 18, isNative: false },
  { symbol: 'BRETT', address: '0x532f27101965dd1a44836f731139783f98018e69', decimals: 18, isNative: false },
  { symbol: 'SHIB', address: '0x45cfe390b83a0552f1469797070107297e632837', decimals: 18, isNative: false }
];

export const TOKENS = [...TRADE_TOKEN_OPTIONS.map((token) => token.symbol), 'CUSTOM'];

export const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: WETH_ADDRESS,
  USDC: USDC_ADDRESS,
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
  'function sellGBLIN(uint256 gblinAmount) external',
  'function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external',
  'function sellGBLINForToken(uint256 gblinAmount, address targetToken, uint24 wethToTargetFee, uint256 minTokenOut) external',
  'function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)',
  'function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)',
  'function quoteMintInKind(uint256 gblinTarget) view returns (uint256[] memory requiredAssets)',
  'function mintInKind(uint256 gblinTarget) external',
  'function redeemInKind(uint256 gblinAmount) external',
  'function refreshWeights() public',
  'function lastYieldDistribution() view returns (uint256)',
  'function getDynamicReserve() view returns (uint256)',
  'function updateMaxSlippage(uint256 newMaxSlippage) external',
  'error SequencerDown()',
  'error DepositTooSmall()',
  'error SlippageExceeded()',
  'error Unauthorized()',
  'error CooldownActive()',
  'error RebalanceNotNeeded()',
  'error OracleDead()',
  'error SwapVolumeTooLow()',
  'error InvalidAddress()',
  'error NoAssetProposed()',
  'error TimelockActive()',
  'error InvalidIndex()',
  'error InvalidAmount()',
  'error TransferFailed()',
  'error NoWethObtained()',
  'error InvalidPath()',
  'error TimeNotPassed()',
  'error NoExcessYield()',
  'error MaxSlippageExceeded()',
  'error InvalidBounds()',
  'error CannotSwapSameToken()'
];

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

export const ORACLE_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)'
];

const UNISWAP_V3_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

const COMMON_UNISWAP_V3_FEES = [100, 500, 3000, 10000] as const;
const UNISWAP_V3_FEE_DENOMINATOR = 1_000_000n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const tokenMetadataCache = new Map<string, TradeTokenOption | null>();
const tokenRouteCache = new Map<string, { tokens: string[]; fees: number[] } | null>();

export const REBALANCE_ASSET_OPTIONS = [
  { name: 'cbBTC', basketIndex: 0, decimals: 8 },
  { name: 'USDC', basketIndex: 2, decimals: 6 }
] as const;

type TransactionDisplayType = 'ADMIN' | 'BUY' | 'MAINT' | 'OTHER' | 'REBALANCE' | 'SELL' | 'TRANSFER' | 'YIELD';
type TransactionValueSource = 'gblin-amount' | 'gblin-transfer' | 'native-eth' | 'none' | 'rebalance-amount' | 'reserve-bounds' | 'slippage-bps';

const GBLIN_TRANSACTION_SIGNATURES: Array<{ signature: string; type: TransactionDisplayType; valueSource: TransactionValueSource }> = [
  { signature: 'proposeAsset(address,address,uint24,bool,uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'executeAssetAddition()', type: 'ADMIN', valueSource: 'none' },
  { signature: 'emergencyDelist(uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'mintInKind(uint256)', type: 'BUY', valueSource: 'gblin-amount' },
  { signature: 'redeemInKind(uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'buyGBLIN(uint256)', type: 'BUY', valueSource: 'native-eth' },
  { signature: 'buyGBLINWithToken(bytes,uint256,uint256,uint256)', type: 'BUY', valueSource: 'gblin-transfer' },
  { signature: 'sellGBLIN(uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'sellGBLINForEth(uint256,uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'sellGBLINForToken(uint256,address,uint24,uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'refreshWeights()', type: 'MAINT', valueSource: 'none' },
  { signature: 'incentivizedRebalance(uint256,bool,uint256)', type: 'REBALANCE', valueSource: 'rebalance-amount' },
  { signature: 'updateMaxSlippage(uint256)', type: 'ADMIN', valueSource: 'slippage-bps' },
  { signature: 'distributeYield()', type: 'YIELD', valueSource: 'none' },
  { signature: 'updateFounderWallet(address)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'updateOracle(uint256,address)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'updateWethOracle(address)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'updateReserveBounds(uint256,uint256)', type: 'ADMIN', valueSource: 'reserve-bounds' },
  { signature: 'safeSwap(address,address,uint24,uint256,uint256)', type: 'MAINT', valueSource: 'none' },
  { signature: 'renounceOwnership()', type: 'ADMIN', valueSource: 'none' },
  { signature: 'transferOwnership(address)', type: 'ADMIN', valueSource: 'none' }
];

const GBLIN_TRANSACTION_INTERFACE = new ethers.Interface(GBLIN_TRANSACTION_SIGNATURES.map((item) => `function ${item.signature}`));
const GBLIN_TRANSACTION_SELECTOR_MAP = new Map<string, { name: string; type: TransactionDisplayType; valueSource: TransactionValueSource }>(
  GBLIN_TRANSACTION_SIGNATURES.map((item) => [
    ethers.id(item.signature).slice(0, 10),
    {
      name: item.signature.slice(0, item.signature.indexOf('(')),
      type: item.type,
      valueSource: item.valueSource
    }
  ])
);

const formatAddressCell = (address?: string | null) => (address ? shortenAddress(address) : '--');

const formatUnitValue = (value: bigint | number | string, decimals: number, symbol?: string, maxFractionDigits = 4) => {
  try {
    const normalized = typeof value === 'bigint' ? value : BigInt(String(value || '0'));
    const formatted = formatTokenAmount(Number.parseFloat(ethers.formatUnits(normalized, decimals)), maxFractionDigits);
    return symbol ? `${formatted} ${symbol}` : formatted;
  } catch {
    return symbol ? `0 ${symbol}` : '0';
  }
};

const getTransactionMethod = (input?: string | null) => {
  const selector = input?.slice(0, 10).toLowerCase();
  return selector ? GBLIN_TRANSACTION_SELECTOR_MAP.get(selector) ?? null : null;
};

const parseContractCall = (input?: string | null, value?: string | null) => {
  if (!input || input === '0x') return null;

  try {
    return GBLIN_TRANSACTION_INTERFACE.parseTransaction({ data: input, value: value || '0' });
  } catch {
    return null;
  }
};

const inferTransactionTypeFromTransfers = (transfers: any[]): TransactionDisplayType => {
  const contractLower = CONTRACT_ADDRESS.toLowerCase();
  const aerodromeLower = AERODROME_POOL.toLowerCase();

  if (transfers.some((transfer) => {
    const from = transfer.from_address?.toLowerCase();
    const to = transfer.to_address?.toLowerCase();
    return from === ZERO_ADDRESS || to === contractLower || from === aerodromeLower;
  })) {
    return 'BUY';
  }

  if (transfers.some((transfer) => {
    const from = transfer.from_address?.toLowerCase();
    const to = transfer.to_address?.toLowerCase();
    return to === ZERO_ADDRESS || from === contractLower || to === aerodromeLower;
  })) {
    return 'SELL';
  }

  return 'OTHER';
};

const getPrimaryGblinTransfer = (transfers: any[], type: TransactionDisplayType) => {
  const contractLower = CONTRACT_ADDRESS.toLowerCase();
  const aerodromeLower = AERODROME_POOL.toLowerCase();

  if (type === 'BUY') {
    return transfers.find((transfer) => {
      const from = transfer.from_address?.toLowerCase();
      const to = transfer.to_address?.toLowerCase();
      return from === ZERO_ADDRESS || from === aerodromeLower || to === contractLower;
    }) || transfers[0] || null;
  }

  if (type === 'SELL') {
    return transfers.find((transfer) => {
      const from = transfer.from_address?.toLowerCase();
      const to = transfer.to_address?.toLowerCase();
      return to === ZERO_ADDRESS || to === aerodromeLower || from === contractLower;
    }) || transfers[0] || null;
  }

  return transfers[0] || null;
};

const formatRebalanceAmount = (parsedTx: ethers.TransactionDescription | null) => {
  if (!parsedTx) return '--';

  const assetIndex = Number(parsedTx.args[0]);
  const isWethToAsset = Boolean(parsedTx.args[1]);
  const amountToSwap = parsedTx.args[2];

  if (typeof amountToSwap !== 'bigint') return '--';
  if (isWethToAsset) return formatUnitValue(amountToSwap, 18, 'WETH');

  const asset = REBALANCE_ASSET_OPTIONS.find((item) => item.basketIndex === assetIndex);
  return asset ? formatUnitValue(amountToSwap, asset.decimals, asset.name) : formatUnitValue(amountToSwap, 18);
};

const formatTransactionValue = (
  type: TransactionDisplayType,
  method: { name: string; type: TransactionDisplayType; valueSource: TransactionValueSource } | null,
  parsedTx: ethers.TransactionDescription | null,
  contractTx: any,
  erc20Transfers: any[]
) => {
  if (type === 'BUY' || type === 'SELL') {
    const transfer = getPrimaryGblinTransfer(erc20Transfers, type);
    if (transfer?.value) return formatUnitValue(transfer.value, 18, 'GBLIN');
  }

  switch (method?.valueSource) {
    case 'native-eth':
      return contractTx?.value && contractTx.value !== '0' ? formatUnitValue(contractTx.value, 18, 'ETH') : '--';
    case 'gblin-amount':
      return parsedTx ? formatUnitValue(parsedTx.args[0], 18, 'GBLIN') : '--';
    case 'rebalance-amount':
      return formatRebalanceAmount(parsedTx);
    case 'slippage-bps':
      return parsedTx ? `${formatTokenAmount(Number(parsedTx.args[0]) / 100, 2)}%` : '--';
    case 'reserve-bounds':
      return parsedTx ? `${formatUnitValue(parsedTx.args[0], 18, undefined, 4)} - ${formatUnitValue(parsedTx.args[1], 18, undefined, 4)} ETH` : '--';
    default:
      return contractTx?.value && contractTx.value !== '0' ? formatUnitValue(contractTx.value, 18, 'ETH') : '--';
  }
};

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

function buildV3Path(tokens: string[], fees: number[]): `0x${string}` {
  let pathHex = tokens[0].replace(/^0x/, '');

  for (let i = 0; i < fees.length; i += 1) {
    pathHex += ethers.toBeHex(fees[i], 3).replace(/^0x/, '');
    pathHex += tokens[i + 1].replace(/^0x/, '');
  }

  return `0x${pathHex}` as `0x${string}`;
}

async function getPoolAddress(provider: ethers.JsonRpcProvider, tokenA: string, tokenB: string, fee: number) {
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, provider);
  return factory.getPool(tokenA, tokenB, fee).catch(() => ZERO_ADDRESS);
}

async function quoteSpotPoolSwap(provider: ethers.JsonRpcProvider, tokenIn: string, tokenOut: string, fee: number, amountIn: bigint) {
  if (amountIn <= 0n) return 0n;

  const poolAddress = await getPoolAddress(provider, tokenIn, tokenOut, fee);
  if (!poolAddress || poolAddress === ZERO_ADDRESS) return 0n;

  const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
  const [token0, token1, slot0] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.slot0()
  ]).catch(() => [ZERO_ADDRESS, ZERO_ADDRESS, [0n]] as const);

  const tokenInLower = tokenIn.toLowerCase();
  const tokenOutLower = tokenOut.toLowerCase();
  const token0Lower = String(token0).toLowerCase();
  const token1Lower = String(token1).toLowerCase();
  const sqrtPriceX96 = BigInt(slot0?.[0]?.toString?.() ?? '0');

  if (!sqrtPriceX96 || token0Lower === ZERO_ADDRESS || token1Lower === ZERO_ADDRESS) return 0n;

  const amountInAfterFee = (amountIn * (UNISWAP_V3_FEE_DENOMINATOR - BigInt(fee))) / UNISWAP_V3_FEE_DENOMINATOR;
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  const q192 = 1n << 192n;

  if (tokenInLower === token0Lower && tokenOutLower === token1Lower) {
    return (amountInAfterFee * priceX192) / q192;
  }

  if (tokenInLower === token1Lower && tokenOutLower === token0Lower) {
    return priceX192 > 0n ? (amountInAfterFee * q192) / priceX192 : 0n;
  }

  return 0n;
}

async function findTokenRoute(provider: ethers.JsonRpcProvider, tokenAddress: string) {
  const tokenLower = tokenAddress.toLowerCase();
  if (tokenLower === WETH_ADDRESS.toLowerCase()) return null;

  const cachedRoute = tokenRouteCache.get(tokenLower);
  if (cachedRoute !== undefined) return cachedRoute;

  for (const fee of COMMON_UNISWAP_V3_FEES) {
    const poolAddress = await getPoolAddress(provider, tokenAddress, WETH_ADDRESS, fee);
    if (poolAddress && poolAddress !== ZERO_ADDRESS) {
      const route = { tokens: [tokenAddress, WETH_ADDRESS], fees: [fee] };
      tokenRouteCache.set(tokenLower, route);
      return route;
    }
  }

  if (tokenLower !== USDC_ADDRESS.toLowerCase()) {
    for (const tokenToUsdcFee of COMMON_UNISWAP_V3_FEES) {
      const tokenToUsdcPool = await getPoolAddress(provider, tokenAddress, USDC_ADDRESS, tokenToUsdcFee);
      if (!tokenToUsdcPool || tokenToUsdcPool === ZERO_ADDRESS) continue;

      for (const usdcToWethFee of COMMON_UNISWAP_V3_FEES) {
        const usdcToWethPool = await getPoolAddress(provider, USDC_ADDRESS, WETH_ADDRESS, usdcToWethFee);
        if (usdcToWethPool && usdcToWethPool !== ZERO_ADDRESS) {
          const route = {
            tokens: [tokenAddress, USDC_ADDRESS, WETH_ADDRESS],
            fees: [tokenToUsdcFee, usdcToWethFee]
          };
          tokenRouteCache.set(tokenLower, route);
          return route;
        }
      }
    }
  }

  tokenRouteCache.set(tokenLower, null);
  return null;
}

export async function resolveTradeToken(provider: ethers.JsonRpcProvider, tokenValue: string) {
  const presetToken = TRADE_TOKEN_OPTIONS.find((token) => token.symbol === tokenValue);
  if (presetToken) return presetToken;

  if (!ethers.isAddress(tokenValue)) return null;

  const tokenAddress = ethers.getAddress(tokenValue);
  const cachedToken = tokenMetadataCache.get(tokenAddress.toLowerCase());
  if (cachedToken !== undefined) return cachedToken;

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    const resolvedToken = {
      symbol: String(symbol),
      address: tokenAddress,
      decimals: Number(decimals),
      isNative: false
    } satisfies TradeTokenOption;

    tokenMetadataCache.set(tokenAddress.toLowerCase(), resolvedToken);
    return resolvedToken;
  } catch {
    tokenMetadataCache.set(tokenAddress.toLowerCase(), null);
    return null;
  }
}

export async function quoteTokenToWeth(provider: ethers.JsonRpcProvider, tokenAddress: string, amountIn: bigint): Promise<TokenRouteQuote | null> {
  const route = await findTokenRoute(provider, tokenAddress);
  if (!route) return null;

  let runningAmount = amountIn;

  for (let i = 0; i < route.fees.length; i += 1) {
    runningAmount = await quoteSpotPoolSwap(provider, route.tokens[i], route.tokens[i + 1], route.fees[i], runningAmount);
    if (runningAmount <= 0n) return null;
  }

  return {
    path: buildV3Path(route.tokens, route.fees),
    amountOut: runningAmount,
    fees: route.fees,
    tokens: route.tokens
  };
}

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

    const txMap = new Map<string, { hash: string; timestamp: number; contractTx: any | null; erc20Transfers: any[] }>();

    if (txRes.ok) {
      const data = await txRes.json();
      if (data && Array.isArray(data.result)) {
        data.result.forEach((tx: any) => {
          const normalizedTx = {
            ...tx,
            source: 'CONTRACT',
            timestamp: new Date(tx.block_timestamp).getTime(),
            hash: tx.hash
          };

          const existing = txMap.get(normalizedTx.hash);
          txMap.set(normalizedTx.hash, {
            hash: normalizedTx.hash,
            timestamp: Math.max(existing?.timestamp ?? 0, normalizedTx.timestamp),
            contractTx: normalizedTx,
            erc20Transfers: existing?.erc20Transfers ?? []
          });
        });
      }
    }

    if (erc20Res.ok) {
      const data = await erc20Res.json();
      if (data && Array.isArray(data.result)) {
        data.result.forEach((tx: any) => {
          const normalizedTx = {
            ...tx,
            source: 'ERC20',
            timestamp: new Date(tx.block_timestamp).getTime(),
            hash: tx.transaction_hash,
            from_address: tx.from_address,
            to_address: tx.to_address,
            value: tx.value
          };

          const existing = txMap.get(normalizedTx.hash);
          txMap.set(normalizedTx.hash, {
            hash: normalizedTx.hash,
            timestamp: Math.max(existing?.timestamp ?? 0, normalizedTx.timestamp),
            contractTx: existing?.contractTx ?? null,
            erc20Transfers: [...(existing?.erc20Transfers ?? []), normalizedTx]
          });
        });
      }
    }

    return Array.from(txMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15)
      .map((tx) => {
        const method = getTransactionMethod(tx.contractTx?.input);
        const parsedTx = parseContractCall(tx.contractTx?.input, tx.contractTx?.value);
        const transferType = tx.erc20Transfers.length > 0 ? inferTransactionTypeFromTransfers(tx.erc20Transfers) : 'OTHER';
        const type: TransactionDisplayType = method?.type
          ?? (tx.contractTx?.to_address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && tx.contractTx?.input === '0x' && tx.contractTx?.value !== '0'
            ? 'TRANSFER'
            : transferType);
        const primaryTransfer = getPrimaryGblinTransfer(tx.erc20Transfers, type);

        return {
          type,
          time: new Date(tx.timestamp).toLocaleString(),
          hash: shortenAddress(tx.hash),
          full_hash: tx.hash,
          from: formatAddressCell(tx.contractTx?.from_address || primaryTransfer?.from_address),
          to: formatAddressCell(tx.contractTx?.to_address || primaryTransfer?.to_address),
          value: formatTransactionValue(type, method, parsedTx, tx.contractTx, tx.erc20Transfers),
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
    const stabilityFund = Number.parseFloat(ethers.formatEther(stabilityFundRaw));

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

    const wethAsset = basketItems.find((item) => item.name === 'WETH') ?? null;
    const wethPrice = wethAsset ? Number(wethAsset.price) : 0;
    const effectiveTvl = basketItems.reduce((sum, item) => {
      if (item.name === 'WETH') {
        return sum + Math.max(item.balance - stabilityFund, 0) * item.price;
      }
      return sum + item.tvl;
    }, 0);

    if (effectiveTvl > 0) {
      basketItems.forEach((item) => {
        const effectiveItemTvl = item.name === 'WETH' ? Math.max(item.balance - stabilityFund, 0) * item.price : item.tvl;
        item.realWeight = (effectiveItemTvl / effectiveTvl) * 100;
      });
    }

    const nav = activeSupply > 0 ? effectiveTvl / activeSupply : 1;
    const stabilityFundUsd = stabilityFund * wethPrice;
    const reserveRatio = effectiveTvl > 0 ? stabilityFundUsd / effectiveTvl : 0;
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
