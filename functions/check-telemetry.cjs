const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

async function main() {
  if (!fs.existsSync('sa.json')) {
    console.error('sa.json not found');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync('sa.json', 'utf8'));

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore();
  const fileId = '1Jnjjzc6PUcSuXPPHp5zer3hS5VkvQz8I';
  
  const doc = await db.collection('pipeline_runs').doc(fileId).get();
  
  if (!doc.exists) {
    console.log(`Document pipeline_runs/${fileId} does NOT exist.`);
    
    // Let's also check pending_pdfs just in case
    const pending = await db.collection('_system/pending_pdfs').doc(fileId).get();
    if (pending.exists) {
        console.log('File is in legacy pending_pdfs instead!');
    }
  } else {
    console.log(`Document pipeline_runs/${fileId} EXISTS! Data:`);
    console.log(JSON.stringify(doc.data(), null, 2));
  }
}

main().catch(console.error);
