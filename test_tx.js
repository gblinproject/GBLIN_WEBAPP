const https = require('https');
https.get('https://base.blockscout.com/api?module=account&action=txlist&address=0xc475851f9101A2AC48a84EcF869766A94D301FaA&sort=desc&page=1&offset=50', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const rebalances = json.result.filter(tx => tx.functionName && tx.functionName.toLowerCase().includes('rebalance'));
    console.log("Rebalances found:", rebalances.length);
    if (rebalances.length > 0) {
      console.log(rebalances[0].functionName, new Date(parseInt(rebalances[0].timeStamp)*1000).toUTCString());
    }
  });
});
