import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * Auction watch.
 *
 * The vault does not rebalance itself and pays nobody to do it: when a row drifts past the opening
 * band it opens a Dutch auction, and whoever trades toward the target weights is the counterparty.
 * Bidding means bringing the input tokens, so this endpoint reports the state and signs nothing —
 * anyone reading it can decide whether the premium covers their own cost.
 */

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org';
const VAULT_ADDRESS = '0xc2181d975c05c8c724b334bcED0764c0b86B1D53';
const LENS_ADDRESS = '0xfCFea8027019E8551A1f09AD91532471F5D26f61';

const VAULT_ABI = [
  'function auctionPremiumBps() view returns (int256)',
  'function currentDriftEth() view returns (uint256)',
  'function isNavReliable() view returns (bool)',
  'function totalEthValue(uint256 excludeWeth) view returns (uint256)',
];
const LENS_ABI = [
  'function basketLength(address vault) view returns (uint256)',
  'function asset(address vault, uint256 i) view returns (address token, address oracle, bool isStable, bool delisted, uint256 baseWeight, uint256 dynamicWeight, bool shielded, bool abandoned)',
  'function auction(address vault, uint256 i) view returns (bool open, int256 premiumBps, bool vaultBuysAsset, uint256 gapEth)',
  'function auctionOpenedAt(address vault) view returns (uint256)',
  'function configAuction(address vault) view returns (uint256 driftBand, uint256 driftClose, uint256 auctionStart, uint256 auctionCap, uint256 auctionRamp, uint256 volUpdateInterval, uint256 listingDelay, uint256 inKindFee, uint256 inKindTax)',
];
const ERC20_ABI = ['function symbol() view returns (string)'];

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Same guard as before: the endpoint is cheap but it is ours, not a public firehose.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const lens = new ethers.Contract(LENS_ADDRESS, LENS_ABI, provider);

    const [premiumRaw, driftRaw, navReliable, totalValue, rowCountRaw, openedAtRaw, config] =
      await Promise.all([
        vault.auctionPremiumBps(),
        vault.currentDriftEth(),
        vault.isNavReliable(),
        vault.totalEthValue(0),
        lens.basketLength(VAULT_ADDRESS),
        lens.auctionOpenedAt(VAULT_ADDRESS),
        lens.configAuction(VAULT_ADDRESS),
      ]);

    const rowCount = Number(rowCountRaw);
    const rows = await Promise.all(
      Array.from({ length: rowCount }, async (_, i) => {
        const [row, state] = await Promise.all([
          lens.asset(VAULT_ADDRESS, i),
          lens.auction(VAULT_ADDRESS, i),
        ]);
        const token = new ethers.Contract(row[0], ERC20_ABI, provider);
        const symbol: string = await token.symbol().catch(() => `row ${i}`);
        return {
          index: i,
          asset: symbol,
          token: row[0],
          base_weight_bps: Number(row[4]),
          dynamic_weight_bps: Number(row[5]),
          shielded: Boolean(row[6]),
          // Which side the vault needs: true means it is buying the asset and paying WETH.
          vault_buys_asset: Boolean(state[2]),
          gap_eth: ethers.formatEther(state[3]),
        };
      })
    );

    const open = Number(openedAtRaw) !== 0;
    const totalEth = Number(ethers.formatEther(totalValue));
    const driftEth = Number(ethers.formatEther(driftRaw));

    return NextResponse.json({
      vault: VAULT_ADDRESS,
      nav_reliable: Boolean(navReliable),
      auction: {
        open,
        opened_at: Number(openedAtRaw),
        // Negative is a discount the bidder gives the vault; it rises to the cap over the ramp,
        // holds there for another ramp, and starts again.
        premium_bps: Number(premiumRaw),
        cap_bps: Number(config[3]),
        start_discount_bps: Number(config[2]),
        ramp_seconds: Number(config[4]),
        opens_above_bps: Number(config[0]),
        closes_at_or_below_bps: Number(config[1]),
      },
      drift: {
        worst_gap_eth: driftEth,
        worst_gap_pct_of_nav: totalEth > 0 ? (driftEth / totalEth) * 100 : 0,
        total_value_eth: totalEth,
      },
      rows,
      how_to_bid:
        'bid(index, vaultBuysAsset, amountIn, minOut, data) on the vault, at the oracle price adjusted ' +
        'by the current premium. The input is reduced to what closes the gap, so a bid never pushes a ' +
        'row past its target. Nothing is paid out of the vault for calling it: the premium is the reward.',
      note:
        'This endpoint only reports. The vault has no rebalance function and no bounty fund: filling ' +
        'the auction means bringing the tokens and trading with it.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read the auction state: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
