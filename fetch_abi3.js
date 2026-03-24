const https = require('https');

const options = {
  hostname: 'basescan.org',
  path: '/address/0xc475851f9101A2AC48a84EcF869766A94D301FaA#readContract',
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
    const match = data.match(/<pre class='wordwrap js-copytextarea2' id='js-copytextarea2' style='margin-top: 5px;'>([\s\S]*?)<\/pre>/);
    if (match) {
      const abi = JSON.parse(match[1]);
      const readFuncs = abi.filter(i => i.type === 'function' && (i.stateMutability === 'view' || i.stateMutability === 'pure'));
      console.log(readFuncs.map(f => f.name).join(', '));
    } else {
      console.log('ABI not found in HTML');
    }
  });
});
