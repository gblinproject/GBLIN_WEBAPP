const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  const abi = [
    "function totalSupply() view returns (uint256)",
    "function stabilityFund() view returns (uint256)",
    "function getNAV() view returns (uint256)",
    "function getVaultBalances() view returns (uint256, uint256, uint256)",
    "function getDynamicWeights() view returns (uint256, uint256, uint256)",
    "function WETH() view returns (address)",
    "function cbBTC() view returns (address)",
    "function USDC() view returns (address)",
    "function rewardFund() view returns (uint256)"
  ];
  const contract = new ethers.Contract(address, abi, provider);
  try {
    const nav = await contract.getNAV();
    console.log("NAV:", nav.toString());
  } catch(e) { console.log("getNAV failed"); }
  try {
    const balances = await contract.getVaultBalances();
    console.log("Balances:", balances.map(b => b.toString()));
  } catch(e) { console.log("getVaultBalances failed"); }
  try {
    const weights = await contract.getDynamicWeights();
    console.log("Weights:", weights.map(w => w.toString()));
  } catch(e) { console.log("getDynamicWeights failed"); }
  try {
    const rf = await contract.rewardFund();
    console.log("RewardFund:", rf.toString());
  } catch(e) { console.log("rewardFund failed"); }
}
main();
