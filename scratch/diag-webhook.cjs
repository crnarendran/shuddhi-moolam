/**
 * Quick diagnostic: test if drive.changes.list works with 
 * the staging page token.
 */
const { initializeApp } = require('../functions/node_modules/firebase-admin/app');
const { getFirestore } = require('../functions/node_modules/firebase-admin/firestore');
const { google } = require('../functions/node_modules/googleapis');

initializeApp({ projectId: 'sai-shuddhi-moolam' });
const db = getFirestore();

async function main() {
  // Read staging watch state
  const snap = await db.doc('_system/drive_watch_staging').get();
  const state = snap.data();
  console.log('Staging watch state:', JSON.stringify(state, null, 2));

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  console.log('\nTesting drive.changes.list with pageToken:', state.pageToken);
  try {
    const response = await drive.changes.list({
      pageToken: state.pageToken,
      spaces: 'drive',
    });
    console.log('SUCCESS! Changes count:', response.data.changes?.length || 0);
    console.log('newStartPageToken:', response.data.newStartPageToken);
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Stack:', err.stack);
  }
}

main().catch(console.error);
