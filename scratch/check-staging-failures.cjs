const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'sai-shuddhi-moolam' });
const db = getFirestore();

async function main() {
  const col = 'pipeline_runs_staging';
  const snap = await db
    .collection(col)
    .where('status', '==', 'failed')
    .limit(20)
    .get();

  if (snap.empty) {
    console.log('No failed documents found in', col);
    return;
  }

  console.log(`Found ${snap.size} failed document(s):\n`);
  snap.forEach((doc) => {
    const d = doc.data();
    console.log('--- ID:', doc.id);
    console.log('  stage :', d.error?.stage);
    console.log('  message:', d.error?.message);
    console.log('  updatedAt:', d.updatedAt);
    console.log('  filename:', d.filename);
    console.log();
  });
}

main().catch(console.error);
