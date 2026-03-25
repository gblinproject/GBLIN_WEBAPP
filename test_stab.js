const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  
  const abi = [
    "function stabilityFund() view returns (uint256)"
  ];
  
  const contract = new ethers.Contract(address, abi, provider);
  const stabFund = await contract.stabilityFund();
  console.log("stabilityFund:", ethers.formatEther(stabFund));
}
main();
