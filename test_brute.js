const { ethers } = require('ethers');
const funcs = [
  "incentivizedRebalance()",
  "incentivizedRebalance(uint256)",
  "buyGBLIN()",
  "buyGBLIN(uint256)",
  "buyGBLIN(uint256,uint256)",
  "buyGBLIN(address,uint256)",
  "sellGBLIN(uint256)",
  "sellGBLIN(uint256,uint256)",
  "sellGBLINForEth(uint256)",
  "sellGBLINForEth(uint256,uint256)"
];
for (const f of funcs) {
  const id = ethers.id(f).slice(0, 10);
  if (id === '0x302693a0' || id === '0xcde3791d') {
    console.log("Found:", f, id);
  }
}
