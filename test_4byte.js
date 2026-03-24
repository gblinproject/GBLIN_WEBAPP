const https = require('https');
https.get('https://www.4byte.directory/api/v1/signatures/?hex_signature=0x302693a0', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log("0x302693a0:", data));
});
https.get('https://www.4byte.directory/api/v1/signatures/?hex_signature=0xcde3791d', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log("0xcde3791d:", data));
});
