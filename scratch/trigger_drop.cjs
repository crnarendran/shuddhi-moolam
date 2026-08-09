const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'sai-shuddhi-moolam' });

const db = getFirestore();

async function run() {
  const fileId = '1q65jXYZsXetC65LetrrA2ahcXO9P5A-v';
  const docRef = db.collection('pipeline_runs_dev').doc(fileId);
  
  // delete it first to ensure a clean state
  await docRef.delete();
  
  // write detected to trigger the function
  await docRef.set({
    fileId,
    status: 'detected',
    detectedAt: Date.now()
  });
  
  console.log(`Triggered pipeline for fileId: ${fileId}`);
}

run().catch(console.error);
