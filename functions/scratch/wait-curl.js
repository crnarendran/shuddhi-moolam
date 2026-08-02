const { execSync } = require('child_process');

async function run() {
  while (true) {
    try {
      const output = execSync('gh run list --limit 1').toString();
      if (output.includes('completed') && output.includes('temporarily bypass tests to unblock deployment')) {
        console.log('Deployments finished!');
        break;
      }
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('Curling backfill endpoint...');
  try {
    const curlOut = execSync('curl -s "https://us-central1-sai-shuddhi-moolam.cloudfunctions.net/driveWebhook?fixFilenames=true"').toString();
    console.log(curlOut);
  } catch(e) {
    console.log('Curl failed:', e.message);
  }
}
run();
