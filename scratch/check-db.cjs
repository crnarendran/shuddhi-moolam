const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with application default credentials
initializeApp({
  projectId: 'sai-shuddhi-moolam'
});

const db = getFirestore();

async function main() {
  const snapshot = await db.collection('pipeline_runs_dev')
    .orderBy('detectedAt', 'desc')
    .limit(10)
    .get();

  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

main().catch(console.error);
