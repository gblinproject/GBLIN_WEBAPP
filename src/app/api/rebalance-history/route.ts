import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/vmGhuXCFK00G8nr3RxRFt';
const CONTRACT_ADDRESS = '0x38DcDB3A381677239BBc652aed9811F2f8496345';
const WETH = '0x4200000000000000000000000000000000000006';
const cbBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const TOKEN_NAMES: Record<string, string> = {
  [WETH.toLowerCase()]: 'WETH',
  [cbBTC.toLowerCase()]: 'cbBTC',
  [USDC.toLowerCase()]: 'USDC',
};

const REBALANCED_TOPIC = ethers.id('Rebalanced(address,address,address,uint256,uint256)');

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    // Look back ~30 days (~2 blocks/sec on Base = ~5_184_000 blocks/month)
    const fromBlock = Math.max(0, currentBlock - 5_184_000);

    const logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [REBALANCED_TOPIC],
      fromBlock,
      toBlock: 'latest',
    });

    const iface = new ethers.Interface([
      'event Rebalanced(address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)',
    ]);

    const events = await Promise.all(
      logs.slice(-5).reverse().map(async (log) => {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return null;

        const block = await provider.getBlock(log.blockNumber);
        const tokenIn = parsed.args.tokenIn as string;
        const tokenOut = parsed.args.tokenOut as string;

        return {
          executor: parsed.args.executor as string,
          tokenIn: TOKEN_NAMES[tokenIn.toLowerCase()] || tokenIn.slice(0, 10),
          tokenOut: TOKEN_NAMES[tokenOut.toLowerCase()] || tokenOut.slice(0, 10),
          amountIn: parsed.args.amountIn.toString(),
          amountOut: parsed.args.amountOut.toString(),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: block?.timestamp || 0,
          date: block ? new Date(block.timestamp * 1000).toISOString() : '',
        };
      })
    );

    return NextResponse.json({
      events: events.filter(Boolean),
      fromBlock,
      toBlock: currentBlock,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch history' }, { status: 500 });
  }
}
