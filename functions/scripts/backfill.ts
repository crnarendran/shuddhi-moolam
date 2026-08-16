import { getFirestore } from 'firebase-admin/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import { initializeApp, getApps } from 'firebase-admin/app';

const projectId = 'sai-shuddhi-moolam';
if (getApps().length === 0) {
  initializeApp({ projectId });
}

const bq = new BigQuery({ projectId });
const db = getFirestore();
const datasetId = 'extracted_data';

async function backfillCollection(collectionName: string, tableName: string) {
  console.log(`Backfilling ${collectionName} -> BigQuery ${tableName}...`);
  const snap = await db.collection(collectionName).get();
  
  if (snap.empty) {
    console.log(`Collection ${collectionName} is empty. Skipping.`);
    return;
  }

  const rows = snap.docs.map(doc => ({
    document_id: doc.id,
    data: JSON.stringify(doc.data())
  }));

  // Insert in batches of 500
  
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    
    const query = `
      MERGE \`${bq.projectId}.${datasetId}.${tableName}\` T
      USING UNNEST(@rows) AS S
      ON T.document_id = S.document_id
      WHEN MATCHED THEN
        UPDATE SET data = PARSE_JSON(S.data)
      WHEN NOT MATCHED THEN
        INSERT (document_id, data) VALUES (S.document_id, PARSE_JSON(S.data))
    `;
    
    try {
      await bq.query({
        query,
        params: { rows: batch },
      });
      console.log(`Inserted batch ${i} to ${i + batch.length} for ${tableName}`);
    } catch (err) {
      console.error(`Error inserting batch for ${tableName}:`, err);
    }
  }
}

async function run() {
  const env = process.argv[2] || 'dev';
  process.env.APP_ENV = env;

  // Read config to get correctly suffixed collection names
  const { FIRESTORE_COLLECTION, HISTORICAL_COLLECTION, COMPANIES_COLLECTION } = require('../src/config');
  
  const collections = [
    FIRESTORE_COLLECTION, // pipeline_runs
    HISTORICAL_COLLECTION, // historical_prices
    COMPANIES_COLLECTION  // companies
  ];

  for (const col of collections) {
    await backfillCollection(col, col);
  }
}

run().catch(console.error);
