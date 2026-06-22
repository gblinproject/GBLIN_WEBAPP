import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? '';
const RPC_URL = ALCHEMY_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : 'https://mainnet.base.org';
const CONTRACT_ADDRESS = '0x36C81d7E1966310F305eA637e761Cf77F90852f0'; // V6
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

const ABI = [
  'function basket(uint256) view returns (address token, address oracle, uint24 poolFee, bool isStable, uint256 baseWeight, uint256 dynamicWeight, uint256 peakPrice, uint256 lastPeakUpdate)',
  'function stabilityFund() view returns (uint256)',
  'function incentivizedRebalance(uint256 assetIndex, bool isWethToAsset, uint256 amountToSwap) external',
  'function refreshWeights() public',
];

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const ORACLE_ABI = [
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
];

// Assets that can be rebalanced (not WETH itself)
const REBALANCE_TARGETS = [
  { name: 'cbBTC', index: 0, decimals: 8 },
  { name: 'USDC', index: 2, decimals: 6 },
];

interface RebalanceResult {
  asset: string;
  direction: string;
  amount: string;
  txHash?: string;
  error?: string;
  skipped?: boolean;
}

function convertToEth(
  amount: bigint,
  assetPrice: bigint,
  ethPrice: bigint,
  assetDecimals: number
): bigint {
  const val = (amount * assetPrice) / ethPrice;
  if (assetDecimals < 18) return val * 10n ** BigInt(18 - assetDecimals);
  if (assetDecimals > 18) return val / 10n ** BigInt(assetDecimals - 18);
  return val;
}

function convertEthToAsset(
  ethAmount: bigint,
  assetPrice: bigint,
  ethPrice: bigint,
  assetDecimals: number
): bigint {
  const val = (ethAmount * ethPrice) / assetPrice;
  if (assetDecimals < 18) return val / 10n ** BigInt(18 - assetDecimals);
  if (assetDecimals > 18) return val * 10n ** BigInt(assetDecimals - 18);
  return val;
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Kill switch
  if (process.env.REBALANCE_BOT_ENABLED === 'false') {
    return NextResponse.json({ status: 'disabled', message: 'Bot is disabled via env' });
  }

  const botKey = process.env.REBALANCE_BOT_KEY;
  if (!botKey) {
    return NextResponse.json({ error: 'REBALANCE_BOT_KEY not configured' }, { status: 500 });
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(botKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);

  const results: RebalanceResult[] = [];

  try {
    // Read contract state
    const [wethBalance, stabilityFund] = await Promise.all([
      wethContract.balanceOf(CONTRACT_ADDRESS) as Promise<bigint>,
      contract.stabilityFund() as Promise<bigint>,
    ]);

    const availableWeth = wethBalance > stabilityFund ? wethBalance - stabilityFund : 0n;
    const hasReward = stabilityFund >= ethers.parseEther('0.0001');

    // Minimum swap: max(WETH_balance / 100, 0.01 ETH)
    let minSwapRequired = wethBalance / 100n;
    const MIN_SWAP_FLOOR = ethers.parseEther('0.01');
    if (minSwapRequired < MIN_SWAP_FLOOR) minSwapRequired = MIN_SWAP_FLOOR;

    // Read WETH oracle price
    const basket1 = await contract.basket(1); // WETH basket entry
    const wethOracle = new ethers.Contract(basket1.oracle, ORACLE_ABI, provider);
    const wethRound = await wethOracle.latestRoundData();
    const ethPrice = wethRound[1] as bigint;
    if (ethPrice <= 0n) {
      return NextResponse.json({ status: 'skipped', reason: 'WETH oracle dead' });
    }

    // Calculate total ETH value of the vault
    let totalEthValue = availableWeth;

    // Pre-fetch all basket data
    const basketData = await Promise.all(
      REBALANCE_TARGETS.map(async (target) => {
        const basket = await contract.basket(target.index);
        const tokenContract = new ethers.Contract(basket.token, ERC20_ABI, provider);
        const tokenBalance = (await tokenContract.balanceOf(CONTRACT_ADDRESS)) as bigint;
        const assetOracle = new ethers.Contract(basket.oracle, ORACLE_ABI, provider);
        const assetRound = await assetOracle.latestRoundData();
        const assetPrice = assetRound[1] as bigint;

        const currentEthValue =
          assetPrice > 0n
            ? convertToEth(tokenBalance, assetPrice, ethPrice, target.decimals)
            : 0n;

        totalEthValue += currentEthValue;

        return {
          ...target,
          basket,
          tokenBalance,
          assetPrice,
          currentEthValue,
        };
      })
    );

    // Process each asset
    for (const asset of basketData) {
      if (asset.assetPrice <= 0n) {
        results.push({ asset: asset.name, direction: '-', amount: '0', skipped: true, error: 'Oracle dead' });
        continue;
      }

      const targetEthValue = (totalEthValue * asset.basket.dynamicWeight) / 10000n;
      const isUnderweight = asset.currentEthValue < targetEthValue;
      const isOverweight = asset.currentEthValue > targetEthValue;

      if (!isUnderweight && !isOverweight) {
        results.push({ asset: asset.name, direction: '-', amount: '0', skipped: true, error: 'Already balanced' });
        continue;
      }

      let amountToSwap: bigint;
      let isWethToAsset: boolean;

      if (isUnderweight) {
        // Buy asset with WETH
        isWethToAsset = true;
        const gap = targetEthValue - asset.currentEthValue;
        amountToSwap = gap > availableWeth ? availableWeth : gap;

        if (amountToSwap < minSwapRequired) {
          results.push({ asset: asset.name, direction: 'WETH->Asset', amount: ethers.formatEther(amountToSwap), skipped: true, error: `Below min swap (${ethers.formatEther(minSwapRequired)} ETH)` });
          continue;
        }
      } else {
        // Sell asset for WETH
        isWethToAsset = false;
        const gap = asset.currentEthValue - targetEthValue;
        const maxAssetToSwap = convertEthToAsset(gap, asset.assetPrice, ethPrice, asset.decimals);
        amountToSwap = maxAssetToSwap > asset.tokenBalance ? asset.tokenBalance : maxAssetToSwap;

        const ethEquivalent = convertToEth(amountToSwap, asset.assetPrice, ethPrice, asset.decimals);
        if (ethEquivalent < minSwapRequired) {
          results.push({ asset: asset.name, direction: 'Asset->WETH', amount: amountToSwap.toString(), skipped: true, error: `Below min swap (${ethers.formatEther(minSwapRequired)} ETH)` });
          continue;
        }
      }

      if (amountToSwap === 0n) {
        results.push({ asset: asset.name, direction: isWethToAsset ? 'WETH->Asset' : 'Asset->WETH', amount: '0', skipped: true, error: 'Zero amount' });
        continue;
      }

      // Dry run via staticCall
      try {
        await contract.incentivizedRebalance.staticCall(asset.index, isWethToAsset, amountToSwap);
      } catch (err: any) {
        const reason = err?.reason || err?.message || 'Unknown revert';
        results.push({ asset: asset.name, direction: isWethToAsset ? 'WETH->Asset' : 'Asset->WETH', amount: amountToSwap.toString(), skipped: true, error: `Dry run failed: ${reason}` });
        continue;
      }

      // Execute real transaction
      try {
        const tx = await contract.incentivizedRebalance(asset.index, isWethToAsset, amountToSwap, {
          gasLimit: 500_000,
        });
        const receipt = await tx.wait();
        results.push({
          asset: asset.name,
          direction: isWethToAsset ? 'WETH->Asset' : 'Asset->WETH',
          amount: isWethToAsset ? ethers.formatEther(amountToSwap) + ' WETH' : amountToSwap.toString(),
          txHash: receipt.hash,
        });
      } catch (err: any) {
        results.push({
          asset: asset.name,
          direction: isWethToAsset ? 'WETH->Asset' : 'Asset->WETH',
          amount: amountToSwap.toString(),
          error: err?.reason || err?.message || 'Transaction failed',
        });
      }
    }

    return NextResponse.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
      botAddress: wallet.address,
      hasReward,
      stabilityFund: ethers.formatEther(stabilityFund),
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
