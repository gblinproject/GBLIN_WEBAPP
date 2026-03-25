const { ethers } = require('ethers');
async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const address = '0xc475851f9101A2AC48a84EcF869766A94D301FaA';
  const code = await provider.getCode(address);
  console.log("Code length:", code.length);
}
main();
