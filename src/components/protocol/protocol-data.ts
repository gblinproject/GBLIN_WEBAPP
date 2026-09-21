import { ethers } from 'ethers';
import type { Language } from '@/translations/index';

export interface DashboardData {
  priceUsd: number;
  volume24h: number;
  ethPriceUsd: number;
  change24h?: number;
  txCount?: number;
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
  baseWeight: number;
  dynamicWeight: number;
  realWeight: number;
  /** True while the crash shield is cutting this row's weight. */
  shielded: boolean;
  /** Which side the vault needs at the auction: true means it buys this asset and pays WETH. */
  vaultBuysAsset: boolean;
  /** Gap between this row and its target, in ETH of value; 0 when the row is within its band. */
  gapEth: number;
}

export interface OnChainData {
  totalSupply: string;
  nav: string;
  tvl: number;
  supplyNum: number;
  /** Unix time of the last management-fee accrual; 0 when it has never accrued. */
  lastYield: number;
  /** Annual management fee in bps, the only recurring fee the vault charges. */
  managementFeeBps: number;
  /** False while a feed the NAV depends on is stale or a basket token does not answer. */
  navReliable: boolean;
  /** Auction premium in bps of the oracle value; negative is a discount the bidder gives the vault. */
  auctionPremiumBps: number;
  /** True while the largest deviation from the target weights keeps an auction open. */
  auctionOpen: boolean;
  basketData: BasketItem[];
  totalYieldDistributed: number | null;
  apyData?: {
    totalVolume: number;
    transactionCount: number;
    estimatedApy: string;
    timeframe: string;
  } | null;
}

/**
 * Health of the three Chainlink feeds the contract prices the basket with.
 *
 * This mirrors `_getOraclePrice`, which returns 0 — rather than reverting — when a feed is stale,
 * answers non-positively, or is unreachable. On the ETH exit path that zero propagates into the
 * per-leg `amountOutMinimum`, so the internal swap goes out with no floor. The in-kind exit
 * `sellGBLIN` reads no oracle and is unaffected, so it is offered instead.
 *
 * `checked: false` means the chain could not be read. In that case nothing is blocked: refusing a
 * redemption because an RPC call failed would be worse than the state being guarded against.
 *
 * Only a positively observed state blocks the ETH exit — stale, or a non-positive answer. A failed
 * read says nothing about the feed itself, since a rate-limited RPC endpoint is indistinguishable
 * from a dead aggregator seen from off chain, so it downgrades the whole result to unchecked
 * instead of counting as a fault. The guard therefore under-blocks rather than over-blocks: it is a
 * convenience for users of this interface, not a safety property of the protocol.
 */
export type OracleFeedStatus = {
  asset: string;
  ageSeconds: number | null;
  unusable: boolean;
  reason: 'stale' | 'non-positive' | 'unreadable' | null;
};

export interface OracleHealth {
  checked: boolean;
  timeoutSeconds: number;
  feeds: OracleFeedStatus[];
  ethRedeemSafe: boolean;
}

export const UNCHECKED_ORACLE_HEALTH: OracleHealth = {
  checked: false,
  timeoutSeconds: 0,
  feeds: [],
  ethRedeemSafe: true,
};

export const fetchOracleHealth = async (): Promise<OracleHealth> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const vault = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
    const lens = new ethers.Contract(LENS_ADDRESS, LENS_ABI, provider);

    const [config, rowCountRaw, block, navReliable] = await Promise.all([
      lens.configFees(CONTRACT_ADDRESS),
      lens.basketLength(CONTRACT_ADDRESS),
      provider.getBlock('latest'),
      vault.isNavReliable().catch(() => null),
    ]);

    // The pricing window, not the stricter trading one: this is the age past which the vault stops
    // pricing a row at all.
    const timeoutSeconds = Number(config[3]);
    // Price against block time, not the browser clock: a skewed local clock must not decide this.
    const now = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) return UNCHECKED_ORACLE_HEALTH;

    const indices = Array.from({ length: Number(rowCountRaw) }, (_, i) => i);
    const feeds = await Promise.all(
      indices.map(async (i): Promise<OracleFeedStatus> => {
        let asset = `row ${i}`;
        try {
          const row = await lens.asset(CONTRACT_ADDRESS, i);
          const token = new ethers.Contract(row[0], ERC20_ABI, provider);
          asset = (await token.symbol().catch(() => asset)) || asset;
          const oracle = new ethers.Contract(row[1], ORACLE_ABI, provider);
          const round = await oracle.latestRoundData();
          const answer = BigInt(round[1]);
          const ageSeconds = now - Number(round[3]);
          // A stable row's feed updates daily and has a window of its own, so it is not stale at the
          // same age as the others; the vault's own verdict below is what actually gates anything.
          const limit = row[2] ? 26 * 60 * 60 : timeoutSeconds;

          if (ageSeconds > limit) return { asset, ageSeconds, unusable: true, reason: 'stale' };
          if (answer <= 0n) return { asset, ageSeconds, unusable: true, reason: 'non-positive' };
          return { asset, ageSeconds, unusable: false, reason: null };
        } catch {
          return { asset, ageSeconds: null, unusable: false, reason: 'unreadable' };
        }
      })
    );

    // A feed that cannot be read makes the whole claim unsupportable, so no claim is made.
    if (feeds.some((feed) => feed.reason === 'unreadable')) return UNCHECKED_ORACLE_HEALTH;

    return {
      checked: true,
      timeoutSeconds,
      feeds,
      // The vault answers this question itself, and its answer is the one that decides whether a mint
      // or a quote goes through. The per-feed view is shown beside it, never instead of it.
      ethRedeemSafe: navReliable === null ? feeds.every((feed) => !feed.unusable) : Boolean(navReliable),
    };
  } catch {
    return UNCHECKED_ORACLE_HEALTH;
  }
};

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

// Alchemy RPC URL is consumed from the browser, so the key must be exposed via
// NEXT_PUBLIC_. Configure NEXT_PUBLIC_ALCHEMY_API_KEY in Vercel / .env.local.
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
export const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org'; // public RPC fallback (rate-limited)
// The vault in service: shares are minted at NAV and redeemed pro rata in kind. Reads that the vault
// does not expose directly go through the Lens; the vault never swaps, so buying with an arbitrary
// token and exiting to ETH go through the Zap. Previous contracts are listed in PREVIOUS_CONTRACTS
// and are only read by the migration panel.
export const CONTRACT_ADDRESS = '0xc2181d975c05c8c724b334bcED0764c0b86B1D53';
export const LENS_ADDRESS = '0xfCFea8027019E8551A1f09AD91532471F5D26f61';
export const ZAP_ADDRESS = '0x0E9D6Ceb6D313b021622C121Cda9C62e86e60200';
export const SENTINEL_ADDRESS = '0x9F13C5c46a864183e1c57Ec02837fe5B980D3F67';
export const PREVIOUS_CONTRACTS = [
  '0x36C81d7E1966310F305eA637e761Cf77F90852f0',
  '0x38DcDB3A381677239BBc652aed9811F2f8496345',
] as const;
// Same address, kept as a named alias for the places that display the contract publicly.
export const DISPLAY_CONTRACT_ADDRESS = CONTRACT_ADDRESS;
// Secondary-market pools, used to classify a transaction as protocol infrastructure.
// The vault in service has no secondary market: the price is the NAV, and minting and redeeming are
// the way in and out. Anything that reads a pool must handle `null` and say so rather than guess.
export const AERODROME_POOL: string | null = null;
export const UNISWAP_POOL: string | null = null;
export const AERODROME_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
export const FOUNDER_WALLET = '0x17a4564dc380d4435a26648fe00da673645b60ce';
// On-chain history is read through the server routes under `/api/chain`, so that no data-provider
// key is shipped to the browser.
export const BASE_CHAIN_ID = 8453;
export const WHITEPAPER_URL = 'https://github.com/gblinproject/GBLIN-Protocol/blob/main/README.md';
export const LOGO_URL = '/LOGO_GBLIN.png';
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

export const GBLIN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function totalEthValue(uint256 excludeWeth) view returns (uint256)',
  'function navPerShare(uint256 excludeWeth) view returns (uint256)',
  'function isNavReliable() view returns (bool)',
  'function auctionPremiumBps() view returns (int256)',
  'function currentDriftEth() view returns (uint256)',
  'function buyGBLIN(uint256 minOut) external payable',
  'function buyGBLINWithWeth(uint256 amount, uint256 minOut, address receiver) external',
  'function buyGBLINInKind(address token, uint256 amountIn, uint256 minOut) external',
  'function sellGBLIN(uint256 gblinAmount) external',
  'function claimPending(address token) external',
  'function bid(uint256 index, bool vaultBuysAsset, uint256 amountIn, uint256 minOut, bytes data) external returns (uint256 amountInUsed, uint256 amountOut)',
  'function refreshWeights() external',
  'function owner() view returns (address)',
  'error SequencerDown()',
  'error SlippageExceeded()',
  'error Unauthorized()',
  'error CooldownActive()',
  'error NoAuction()',
  'error PriceUnavailable()',
  'error InvalidAddress()',
  'error InvalidIndex()',
  'error InvalidAmount()',
  'error DepositTooSmall()',
  'error NothingToClaim()',
  'error TokenNotConformant()',
  'error ZeroOutput()',
  'error ParamOutOfBounds()',
  'error InsufficientGas()'
];

// Read-only helper alongside the vault: quotes, configuration, basket rows and auction state.
export const LENS_ABI = [
  'function basketLength(address vault) view returns (uint256)',
  'function quoteBuy(address vault, uint256 ethValue) view returns (uint256 out, uint256 protocolFee, uint256 stabilityFee)',
  'function quoteSell(address vault, uint256 gblinAmount) view returns (uint256)',
  'function asset(address vault, uint256 i) view returns (address token, address oracle, bool isStable, bool delisted, uint256 baseWeight, uint256 dynamicWeight, bool shielded, bool abandoned)',
  'function auction(address vault, uint256 i) view returns (bool open, int256 premiumBps, bool vaultBuysAsset, uint256 gapEth)',
  'function auctionOpenedAt(address vault) view returns (uint256)',
  'function configFees(address vault) view returns (uint256 protocolFee, uint256 stabilityFee, uint256 minDeposit, uint256 oracleAge, uint256 oracleAgeTrade, uint256 sellCooldown, uint256 basketCap)',
  'function configAuction(address vault) view returns (uint256 driftBand, uint256 driftClose, uint256 auctionStart, uint256 auctionCap, uint256 auctionRamp, uint256 volUpdateInterval, uint256 listingDelay, uint256 inKindFee, uint256 inKindTax)',
  'function managementFeeBps(address vault) view returns (uint256)',
  'function lastManagementFeeAccrual(address vault) view returns (uint256)',
  'function pendingWithdrawal(address vault, address holder, address token) view returns (uint256)',
  'function lastDepositTime(address vault, address holder) view returns (uint256)',
  'function feeRecipient(address vault) view returns (address)'
];

// The Zap is the only contract that swaps: it mints with any token and exits to ETH by redeeming in
// kind and selling the legs. The vault itself never touches a pool.
export const ZAP_ABI = [
  'function buyGBLINWithToken(address tokenIn, uint256 amountIn, uint256 minWethOut, uint256 minOut, bytes venueData, address receiver) external returns (uint256 out)',
  'function sellGBLINForEth(uint256 shares, uint256 minEthOut, bytes[] venueData, address receiver) external returns (uint256 ethOut)'
];

export const SENTINEL_ABI = [
  'function isPaused() view returns (bool)'
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
const PROTOCOL_CORE_ADDRESSES = new Set([
  CONTRACT_ADDRESS.toLowerCase(),
  FOUNDER_WALLET.toLowerCase()
]);
const PROTOCOL_INFRA_ADDRESSES = new Set(
  [AERODROME_POOL, UNISWAP_POOL, AERODROME_ROUTER, ZAP_ADDRESS, ZERO_ADDRESS]
    .filter((a): a is string => a !== null)
    .map((a) => a.toLowerCase())
);
const KNOWN_PROTOCOL_ADDRESSES = new Set([...PROTOCOL_CORE_ADDRESSES, ...PROTOCOL_INFRA_ADDRESSES]);
const tokenMetadataCache = new Map<string, TradeTokenOption | null>();
const tokenRouteCache = new Map<string, { tokens: string[]; fees: number[] } | null>();

export const REBALANCE_ASSET_OPTIONS = [
  { name: 'cbBTC', basketIndex: 0, decimals: 8 },
  { name: 'USDC', basketIndex: 2, decimals: 6 }
] as const;

type TransactionDisplayType = 'ADMIN' | 'APPROVE' | 'BUY' | 'MAINT' | 'OTHER' | 'REBALANCE' | 'SELL' | 'TRANSFER' | 'YIELD';
const ERC20_APPROVE_SELECTOR = '0x095ea7b3';
type TransactionValueSource = 'gblin-amount' | 'gblin-transfer' | 'native-eth' | 'none' | 'rebalance-amount' | 'reserve-bounds' | 'slippage-bps';

const GBLIN_TRANSACTION_SIGNATURES: Array<{ signature: string; type: TransactionDisplayType; valueSource: TransactionValueSource }> = [
  { signature: 'proposeAsset(address,address,uint24,bool,uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'executeAssetAddition()', type: 'ADMIN', valueSource: 'none' },
  { signature: 'emergencyDelist(uint256)', type: 'ADMIN', valueSource: 'none' },
  // The vault in service and its Zap. Signatures of the previous contracts follow, so a wallet's older
  // history keeps its labels instead of falling back to "transfer".
  { signature: 'buyGBLIN(uint256)', type: 'BUY', valueSource: 'native-eth' },
  { signature: 'buyGBLINWithWeth(uint256,uint256,address)', type: 'BUY', valueSource: 'gblin-transfer' },
  { signature: 'buyGBLINInKind(address,uint256,uint256)', type: 'BUY', valueSource: 'gblin-transfer' },
  { signature: 'buyGBLINWithToken(address,uint256,uint256,uint256,bytes,address)', type: 'BUY', valueSource: 'gblin-transfer' },
  { signature: 'sellGBLIN(uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'sellGBLINForEth(uint256,uint256,bytes[],address)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'claimPending(address)', type: 'SELL', valueSource: 'none' },
  { signature: 'bid(uint256,bool,uint256,uint256,bytes)', type: 'REBALANCE', valueSource: 'rebalance-amount' },
  { signature: 'refreshWeights()', type: 'MAINT', valueSource: 'none' },
  { signature: 'transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)', type: 'MAINT', valueSource: 'none' },
  { signature: 'receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)', type: 'MAINT', valueSource: 'none' },
  { signature: 'setParam(uint256,uint256[7])', type: 'ADMIN', valueSource: 'none' },
  { signature: 'setAddress(uint256,address)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'proposeAsset(address,address,bool,uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'executeAssetAddition(uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'assetAction(uint256,uint256)', type: 'ADMIN', valueSource: 'none' },
  { signature: 'setBaseWeights(uint256[])', type: 'ADMIN', valueSource: 'none' },
  { signature: 'acceptOwnership()', type: 'ADMIN', valueSource: 'none' },
  // Previous contracts.
  { signature: 'mintInKind(uint256)', type: 'BUY', valueSource: 'gblin-amount' },
  { signature: 'redeemInKind(uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'buyGBLINWithToken(bytes,uint256,uint256,uint256)', type: 'BUY', valueSource: 'gblin-transfer' },
  { signature: 'sellGBLINForEth(uint256,uint256)', type: 'SELL', valueSource: 'gblin-amount' },
  { signature: 'sellGBLINForToken(uint256,address,uint24,uint256)', type: 'SELL', valueSource: 'gblin-amount' },
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

const formatUnitValue = (value: bigint | number | string, decimals: number, symbol?: string, maxFractionDigits = 6) => {
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

const inferTransactionTypeFromTransfers = (transfers: any[], txSender?: string): TransactionDisplayType => {
  if (transfers.length === 0) return 'OTHER';

  const senderLower = txSender?.toLowerCase();

  // Strategy A: reliable tx sender from contractTx (and it's a real user, not a protocol addr)
  if (senderLower && !KNOWN_PROTOCOL_ADDRESSES.has(senderLower)) {
    const userReceivesGblin = transfers.some((t) => t.to_address?.toLowerCase() === senderLower);
    const userSendsGblin = transfers.some((t) => t.from_address?.toLowerCase() === senderLower);

    if (userReceivesGblin && !userSendsGblin) return 'BUY';
    if (userSendsGblin && !userReceivesGblin) return 'SELL';
    if (userReceivesGblin && userSendsGblin) return 'OTHER';
  }

  // Strategy B: mint/burn heuristics
  for (const transfer of transfers) {
    const from = transfer.from_address?.toLowerCase();
    const to = transfer.to_address?.toLowerCase();
    if (from === ZERO_ADDRESS) return 'BUY';
    if (to === ZERO_ADDRESS) return 'SELL';
  }

  // Strategy C: identify user as the non-protocol address in the transfers
  for (const transfer of transfers) {
    const from = transfer.from_address?.toLowerCase();
    const to = transfer.to_address?.toLowerCase();
    const fromIsProtocol = !from || KNOWN_PROTOCOL_ADDRESSES.has(from);
    const toIsProtocol = !to || KNOWN_PROTOCOL_ADDRESSES.has(to);

    if (fromIsProtocol && !toIsProtocol) return 'BUY';
    if (!fromIsProtocol && toIsProtocol) return 'SELL';
  }

  // Strategy D: all-protocol transfers — check direction relative to core vs infrastructure
  for (const transfer of transfers) {
    const from = transfer.from_address?.toLowerCase();
    const to = transfer.to_address?.toLowerCase();
    if (from && PROTOCOL_INFRA_ADDRESSES.has(from) && to && PROTOCOL_CORE_ADDRESSES.has(to)) return 'SELL';
    if (from && PROTOCOL_CORE_ADDRESSES.has(from) && to && PROTOCOL_INFRA_ADDRESSES.has(to)) return 'BUY';
  }

  return 'OTHER';
};

const getPrimaryGblinTransfer = (transfers: any[], type: TransactionDisplayType, txSender?: string) => {
  const senderLower = txSender?.toLowerCase();
  const hasSender = senderLower && !KNOWN_PROTOCOL_ADDRESSES.has(senderLower);

  if (type === 'BUY') {
    if (hasSender) {
      const match = transfers.find((t) => t.to_address?.toLowerCase() === senderLower);
      if (match) return match;
    }
    return transfers.find((t) => {
      const from = t.from_address?.toLowerCase();
      return from === ZERO_ADDRESS || (from && KNOWN_PROTOCOL_ADDRESSES.has(from));
    }) || transfers[0] || null;
  }

  if (type === 'SELL') {
    if (hasSender) {
      const match = transfers.find((t) => t.from_address?.toLowerCase() === senderLower);
      if (match) return match;
    }
    return transfers.find((t) => {
      const to = t.to_address?.toLowerCase();
      return to === ZERO_ADDRESS || (to && KNOWN_PROTOCOL_ADDRESSES.has(to));
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
    if (transfer?.value) return formatUnitValue(transfer.value, 18, 'GBLIN', 8);
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

/**
 * Number formatting follows the interface language.
 *
 * Group and decimal separators are swapped between locales, so a figure printed
 * with one convention and read with another is a different figure: "1,546,640"
 * reads as one thousand five hundred forty-six point sixty-four wherever the
 * comma is the decimal separator. A figure that can be read as another figure is
 * worse than no figure at all.
 *
 * The locale is module state rather than a prop because these helpers are called
 * from many call sites, including the chain reader. The shells set it inside an
 * effect, so the server render and the first client render agree and only the
 * render that follows a language switch is localised.
 */
const NUMBER_LOCALES: Record<string, string> = {
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP'
};

let activeLocale = 'en-US';

export function setNumberLocale(language: string) {
  activeLocale = NUMBER_LOCALES[language] ?? 'en-US';
}

export function getNumberLocale() {
  return activeLocale;
}

export const formatCurrency = (value: number, decimals = 2) =>
  new Intl.NumberFormat(activeLocale, {
    style: 'currency',
    currency: 'USD',
    // narrowSymbol keeps the dollar sign in every language instead of falling back
    // to the "USD" code, which several locales use by default.
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);

/** Percentage in the interface language: 45,00% in Italian, 45.00% in English. */
export const formatPercent = (value: number, decimals = 2) =>
  `${new Intl.NumberFormat(activeLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)}%`;

export const formatTokenAmount = (value: number, maxFractionDigits: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const formatted = value.toLocaleString(activeLocale, {
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

    let priceUsd = 0;
    let ethPriceUsd = 3500;

    try {
      const llamaRes = await fetch('https://coins.llama.fi/prices/current/ethereum:0x0000000000000000000000000000000000000000?searchWidth=4h');
      if (llamaRes.ok) {
        const llamaData = await llamaRes.json();
        const price = llamaData.coins['ethereum:0x0000000000000000000000000000000000000000']?.price;
        if (price) ethPriceUsd = price;
      }

      // The price of a share is what the vault would pay for it now, read through the Lens.
      const quoteSell = await quoteSellShares(provider, ethers.parseEther('1'));
      const ethOut = parseFloat(ethers.formatEther(quoteSell));
      priceUsd = ethOut * ethPriceUsd;
    } catch {}

    // 24h volume comes from the public market aggregator queried below; it stays at zero when the
    // aggregator has nothing for this token.
    let volume24h = 0;

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
    // Single request to the server route, which keeps the RPC key server-side and lets the CDN
    // cache the result.
    const activityRes = await fetch('/api/chain/contract-activity?limit=10');
    const activity = activityRes.ok
      ? await activityRes.json()
      : { transactions: [], erc20Transfers: [] };

    const txMap = new Map<string, { hash: string; timestamp: number; contractTx: any | null; erc20Transfers: any[] }>();

    {
      const data = { result: activity.transactions ?? [] };
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

    {
      const data = { result: activity.erc20Transfers ?? [] };
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
      .slice(0, 10)
      .map((tx) => {
        const method = getTransactionMethod(tx.contractTx?.input);
        const parsedTx = parseContractCall(tx.contractTx?.input, tx.contractTx?.value);
        const txSender = tx.contractTx?.from_address || null;
        const inputSelector = tx.contractTx?.input?.slice(0, 10)?.toLowerCase();
        const isApprove = inputSelector === ERC20_APPROVE_SELECTOR;
        const transferType = tx.erc20Transfers.length > 0
          ? inferTransactionTypeFromTransfers(tx.erc20Transfers, txSender)
          : 'OTHER';
        const type: TransactionDisplayType = isApprove
          ? 'APPROVE'
          : method?.type
            ?? (tx.contractTx?.to_address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && tx.contractTx?.input === '0x' && tx.contractTx?.value !== '0'
              ? 'TRANSFER'
              : transferType);
        const primaryTransfer = getPrimaryGblinTransfer(tx.erc20Transfers, type, txSender);

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
    const vault = new ethers.Contract(CONTRACT_ADDRESS, GBLIN_ABI, provider);
    const lens = new ethers.Contract(LENS_ADDRESS, LENS_ABI, provider);

    const [totalSupply, navReliable, premiumRaw, mgmtFeeRaw, lastAccrualRaw, rowCountRaw] = await Promise.all([
      vault.totalSupply().catch(() => 0n),
      vault.isNavReliable().catch(() => false),
      vault.auctionPremiumBps().catch(() => 0n),
      lens.managementFeeBps(CONTRACT_ADDRESS).catch(() => 0n),
      lens.lastManagementFeeAccrual(CONTRACT_ADDRESS).catch(() => 0n),
      lens.basketLength(CONTRACT_ADDRESS).catch(() => 0n),
    ]);

    const supplyFormatted = parseFloat(ethers.formatEther(totalSupply));
    const rowCount = Number(rowCountRaw);
    const indices = Array.from({ length: rowCount }, (_, i) => i);

    const rows = await Promise.all(
      indices.map(async (i) => {
        try {
          const [row, auction] = await Promise.all([
            lens.asset(CONTRACT_ADDRESS, i),
            lens.auction(CONTRACT_ADDRESS, i).catch(() => null),
          ]);
          const tokenAddress: string = row[0];
          const oracleAddress: string = row[1];
          const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
          const [balance, decimals, symbol, latestRound] = await Promise.all([
            token.balanceOf(CONTRACT_ADDRESS),
            token.decimals(),
            token.symbol().catch(() => ''),
            oracle.latestRoundData(),
          ]);
          const price = Number(latestRound[1]) / 1e8;
          const balanceFormatted = Number(balance) / Math.pow(10, Number(decimals));
          return {
            name: (symbol || 'ASSET') as BasketItem['name'],
            address: tokenAddress,
            price,
            balance: balanceFormatted,
            tvl: balanceFormatted * price,
            baseWeight: Number(row[4]),
            dynamicWeight: Number(row[5]),
            realWeight: 0,
            shielded: Boolean(row[6]),
            vaultBuysAsset: auction ? Boolean(auction[2]) : false,
            gapEth: auction ? Number(ethers.formatEther(auction[3])) : 0,
            auctionOpen: auction ? Boolean(auction[0]) : false,
          };
        } catch {
          return null;
        }
      })
    );

    const basketItems: BasketItem[] = rows.filter((x): x is BasketItem & { auctionOpen: boolean } => x !== null);
    const auctionOpen = rows.some((r) => r !== null && r.auctionOpen);
    const tvl = basketItems.reduce((sum, item) => sum + item.tvl, 0);

    // Every share is backed by the basket: no buffer is held back, so the weights are the plain shares
    // of the total. The NAV comes from the vault itself, priced in ETH, and is converted with the WETH
    // row's own feed so that the figure on screen and the figure the contract uses cannot drift apart.
    if (tvl > 0) basketItems.forEach((item) => { item.realWeight = (item.tvl / tvl) * 100; });

    const navPerShareWei: bigint = await vault.navPerShare(0).catch(() => 0n);
    const wethRow = basketItems.find((item) => item.name === 'WETH') ?? null;
    const ethPrice = wethRow ? wethRow.price : 0;
    const nav = Number(ethers.formatEther(navPerShareWei)) * ethPrice;

    const totalYieldDistributed = await fetchTotalYieldDistributed();

    return {
      totalSupply: supplyFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      nav: formatCurrency(nav),
      tvl,
      supplyNum: supplyFormatted,
      lastYield: Number(lastAccrualRaw),
      managementFeeBps: Number(mgmtFeeRaw),
      navReliable: Boolean(navReliable),
      auctionPremiumBps: Number(premiumRaw),
      auctionOpen,
      basketData: basketItems,
      totalYieldDistributed,
      apyData: null
    };
  } catch {
    return {
      totalSupply: '0',
      nav: '$0.00',
      tvl: 0,
      supplyNum: 0,
      lastYield: 0,
      managementFeeBps: 0,
      navReliable: false,
      auctionPremiumBps: 0,
      auctionOpen: false,
      basketData: [],
      totalYieldDistributed: null,
      apyData: null
    };
  }
};

/** Shares for `ethValue` wei of ETH, and the two mint fees, as the vault would price them now. */
export const quoteBuyShares = async (
  provider: ethers.Provider,
  ethValue: bigint
): Promise<{ out: bigint; protocolFee: bigint; stabilityFee: bigint }> => {
  const lens = new ethers.Contract(LENS_ADDRESS, LENS_ABI, provider);
  const [out, protocolFee, stabilityFee] = await lens.quoteBuy(CONTRACT_ADDRESS, ethValue);
  return { out, protocolFee, stabilityFee };
};

/** Value in wei of ETH of `shares`, as the vault would pay it now. Reverts while the NAV is unreliable. */
export const quoteSellShares = async (provider: ethers.Provider, shares: bigint): Promise<bigint> => {
  const lens = new ethers.Contract(LENS_ADDRESS, LENS_ABI, provider);
  return (await lens.quoteSell(CONTRACT_ADDRESS, shares)) as bigint;
};

/**
 * Total amount that has accrued to holders through the NAV, summed from the fee events the vault
 * emits on chain.
 *
 * The sum is computed by the `/api/nav-fees` route rather than here: an indexer answers it in a
 * single call and the result is cached, whereas reading the logs from the browser is not viable —
 * public RPC endpoints cap `eth_getLogs` to a narrow block range, so the scan silently returns
 * nothing.
 *
 * `null` means the figure could not be read right now, which is a different statement from "nothing
 * has ever accrued". Callers must render the two cases differently.
 */
export const fetchTotalYieldDistributed = async (): Promise<number | null> => {
  try {
    const res = await fetch('/api/nav-fees');
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.weth === 'number' ? data.weth : null;
  } catch {
    return null;
  }
};
