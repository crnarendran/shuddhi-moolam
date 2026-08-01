const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'sai-shuddhi-moolam'
});

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

async function trigger() {
  const fileId = '1Re5bHzeWXS92fiLh_hl89bT_DSKNDsPV';
  const docRef = db.collection('pipeline_runs').doc(fileId);
  await docRef.set({
    status: 'detected',
    detectedAt: FieldValue.serverTimestamp()
  });
  console.log('Triggered pipeline for file', fileId);
}

trigger().catch(console.error);
