const https = require('https');

const data = JSON.stringify({
  fileId: '1Re5bHzeWXS92fiLh_hl89bT_DSKNDsPV'
});

const req = https.request('https://us-central1-sai-shuddhi-moolam.cloudfunctions.net/driveWebhook_dev', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
