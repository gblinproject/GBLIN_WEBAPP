const https = require('https');

const options = {
  hostname: 'api.basescan.org',
  path: '/api?module=contract&action=getabi&address=0xc475851f9101A2AC48a84EcF869766A94D301FaA',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Raw response data:', data);
    try {
      const json = JSON.parse(data);
      if (json.status === '1') {
        const abi = JSON.parse(json.result);
        const readFuncs = abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure'));
        console.log(readFuncs.map(f => f.name).join(', '));
      } else {
        console.log('Error:', json.message);
      }
    } catch (e) {
      console.error('JSON parsing error. Response received was not JSON:', data);
    }
  });
});
