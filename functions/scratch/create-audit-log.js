const { google } = require('googleapis');
const admin = require('firebase-admin');

// Ensure firebase-admin is initialized to get Application Default Credentials if needed
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'sai-shuddhi-moolam' });
}

async function createAuditLogTab() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const stagingSheetId = '15xWbByMNZ8nyK9CObZfbQ-_YxGrUJEe8uwnIN4CpYcY'; // from config.ts
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: stagingSheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Audit_Log',
              }
            }
          }
        ]
      }
    });
    
    console.log('Successfully created Audit_Log tab in Staging spreadsheet!');
  } catch (err) {
    console.error('Error creating tab:', err.message);
  }
}

createAuditLogTab();
