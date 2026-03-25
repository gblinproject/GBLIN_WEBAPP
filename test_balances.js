const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  
  const weth = new ethers.Contract('0x4200000000000000000000000000000000000006', erc20Abi, provider);
  const cbbtc = new ethers.Contract('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', erc20Abi, provider);
  const usdc = new ethers.Contract('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', erc20Abi, provider);
  
  const wethBal = await weth.balanceOf(address);
  const cbbtcBal = await cbbtc.balanceOf(address);
  const usdcBal = await usdc.balanceOf(address);
  
  console.log("WETH:", ethers.formatUnits(wethBal, 18));
  console.log("cbBTC:", ethers.formatUnits(cbbtcBal, 8));
  console.log("USDC:", ethers.formatUnits(usdcBal, 6));
}
main();
