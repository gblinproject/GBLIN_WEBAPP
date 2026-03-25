const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  const abi = [
    "function getVaultStats() view returns (uint256 tvl, uint256 fund, uint256[] weights)",
    "function getRecentRebalances() view returns (tuple(uint256 timestamp, address executor, uint256 reward)[])"
  ];
  const contract = new ethers.Contract(address, abi, provider);
  try {
    const stats = await contract.getVaultStats();
    console.log("Stats:", stats);
  } catch(e) { console.log("getVaultStats failed", e.message); }
  try {
    const rebalances = await contract.getRecentRebalances();
    console.log("Rebalances:", rebalances);
  } catch(e) { console.log("getRecentRebalances failed", e.message); }
}
main();
