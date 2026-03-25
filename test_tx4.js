const https = require('https');
https.get('https://base.blockscout.com/api?module=account&action=txlist&address=0xc475851f9101A2AC48a84EcF869766A94D301FaA&sort=desc&page=1&offset=500', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const txs = json.result.filter(tx => {
      const d = new Date(parseInt(tx.timeStamp)*1000);
      return d.getUTCMonth() === 2 && d.getUTCDate() === 19;
    });
    console.log(txs);
  });
});
