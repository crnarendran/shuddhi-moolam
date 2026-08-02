const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { google } = require('googleapis');

initializeApp({ projectId: 'sai-shuddhi-moolam' });
const db = getFirestore();

async function main() {
  const snap = await db.doc('_system/drive_watch_staging').get();
  const state = snap.data();
  console.log('pageToken:', state.pageToken);

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  console.log('Testing drive.changes.list...');
  try {
    const response = await drive.changes.list({
      pageToken: state.pageToken,
      spaces: 'drive',
    });
    const changes = response.data.changes || [];
    console.log('SUCCESS! Changes count:', changes.length);
    console.log('newStartPageToken:', response.data.newStartPageToken);
    changes.forEach((c) => {
      console.log('  -', c.fileId, c.file?.name, c.file?.mimeType);
    });
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Full error:', err);
  }
}

main().catch(console.error);
