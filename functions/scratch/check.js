const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'sai-shuddhi-moolam' });
const db = admin.firestore();

async function check() {
  const all = await db.collection('pipeline_runs_staging').get();
  
  const statusCounts = {};
  all.forEach(doc => {
    const status = doc.data().status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  console.log('Status Summary:', statusCounts);
  
  if (statusCounts['failed']) {
    const failed = await db.collection('pipeline_runs_staging')
      .where('status', '==', 'failed')
      .get();
    for (const doc of failed.docs) {
      console.log('Resetting:', doc.id);
      await doc.ref.update({ status: 'detected', error: admin.firestore.FieldValue.delete() });
    }
  }
}

check().catch(console.error);
