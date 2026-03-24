const https = require('https');

const options = {
  hostname: 'basescan.org',
  path: '/address/0xc475851f9101A2AC48a84EcF869766A94D301FaA#readContract',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const matches = data.match(/function [a-zA-Z0-9_]+/g);
    if (matches) {
      console.log(matches.join('\n'));
    } else {
      console.log('No functions found');
    }
  });
});
