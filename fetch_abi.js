const https = require('https');

https.get('https://api.basescan.org/api?module=contract&action=getabi&address=0xc475851f9101A2AC48a84EcF869766A94D301FaA', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.status === '1') {
      const abi = JSON.parse(json.result);
      const readFuncs = abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure'));
      console.log(readFuncs.map(f => f.name));
    } else {
      console.log('Error:', json.message);
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
