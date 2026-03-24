const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  const abi = [
    "function rewardPool() view returns (uint256)",
    "function rebalanceReward() view returns (uint256)",
    "function getRewardPool() view returns (uint256)",
    "function getReward() view returns (uint256)",
    "function rewardFund() view returns (uint256)",
    "function currentReward() view returns (uint256)",
    "function getRebalanceReward() view returns (uint256)"
  ];
  const contract = new ethers.Contract(address, abi, provider);
  const funcs = ["rewardPool", "rebalanceReward", "getRewardPool", "getReward", "rewardFund", "currentReward", "getRebalanceReward"];
  for (const f of funcs) {
    try {
      const res = await contract[f]();
      console.log(f, "success:", res.toString());
    } catch(e) { }
  }
}
main();
