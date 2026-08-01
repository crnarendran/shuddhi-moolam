const { google } = require('googleapis');

async function checkSheet() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheetsClient = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY';
  
  const doc = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    includeGridData: true
  });
  
  doc.data.sheets.forEach(sheet => {
    console.log(`Sheet: ${sheet.properties.title}`);
    const rows = sheet.data[0].rowData;
    if (rows) {
      rows.forEach(row => {
        if (row.values) {
          console.log(row.values.map(v => v.formattedValue).join(' | '));
        }
      });
    }
  });
}
checkSheet().catch(console.error);
