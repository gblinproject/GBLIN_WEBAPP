const https = require('https');
https.get('https://api.dexscreener.com/latest/dex/search?q=cbBTC', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const basePairs = json.pairs.filter(p => p.chainId === 'base');
    if (basePairs.length > 0) {
      console.log(basePairs[0].baseToken);
      console.log(basePairs[0].quoteToken);
    }
  });
});
