const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
admin.initializeApp({ projectId: 'sai-shuddhi-moolam' });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('pipeline_runs').get();
  let totalEstCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let fileIds = new Set();
  let duplicateRuns = 0;
  let totalAttempts = 0;
  
  const runs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    runs.push(data);
    
    if (data.cost?.estimatedUsd) totalEstCost += data.cost.estimatedUsd;
    if (data.gemini?.tokensIn) totalTokensIn += data.gemini.tokensIn;
    if (data.gemini?.tokensOut) totalTokensOut += data.gemini.tokensOut;
    
    totalAttempts += (data.attempts || 0);
    
    if (fileIds.has(data.fileId)) {
        duplicateRuns++;
    } else {
        fileIds.add(data.fileId);
    }
  });

  console.log(`Total Pipeline Runs: ${snapshot.size}`);
  console.log(`Total Unique Files: ${fileIds.size}`);
  console.log(`Duplicate Runs (same fileId): ${duplicateRuns}`);
  console.log(`Total extraction attempts (retries): ${totalAttempts}`);
  console.log(`Total Est Cost (USD): $${totalEstCost.toFixed(4)}`);
  console.log(`Total Tokens In: ${totalTokensIn}`);
  console.log(`Total Tokens Out: ${totalTokensOut}`);
  
  // Find top 5 most expensive runs
  const sorted = runs.filter(r => r.cost?.estimatedUsd).sort((a,b) => b.cost.estimatedUsd - a.cost.estimatedUsd).slice(0, 5);
  console.log('\nTop 5 Expensive Runs:');
  sorted.forEach(r => console.log(`${r.fileName || r.fileId}: $${r.cost.estimatedUsd.toFixed(4)} (${r.gemini?.tokensIn} in / ${r.gemini?.tokensOut} out)`));
}
run().catch(console.error);
