const https = require('https');

https.get('https://sai-shuddhi-moolam-dev.web.app/', (res) => {
  let html = '';
  res.on('data', d => html += d);
  res.on('end', () => {
    const match = html.match(/assets\/index-[a-zA-Z0-9]+\.js/);
    if (!match) {
      console.log('Could not find bundle script in HTML:', html);
      return;
    }
    const jsUrl = 'https://sai-shuddhi-moolam-dev.web.app/' + match[0];
    console.log('Fetching', jsUrl);
    https.get(jsUrl, (res2) => {
      let js = '';
      res2.on('data', d => js += d);
      res2.on('end', () => {
        if (js.includes('Data_')) {
          console.log('FOUND Data_ in the bundle!!!');
          const snippet = js.substring(js.indexOf('Data_') - 50, js.indexOf('Data_') + 50);
          console.log('Snippet:', snippet);
        } else {
          console.log('Did not find Data_ in the bundle.');
        }
      });
    });
  });
});
