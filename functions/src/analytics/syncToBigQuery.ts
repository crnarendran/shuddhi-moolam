/* eslint-disable max-len, jsdoc/require-param, jsdoc/require-returns, @typescript-eslint/no-unused-vars, jsdoc/require-jsdoc, jsdoc/require-param-description, jsdoc/require-param-type */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import { getApps, initializeApp } from 'firebase-admin/app';

// Ensure Firebase is initialized
if (getApps().length === 0) {
  initializeApp();
}

const bq = new BigQuery();
const datasetId = 'extracted_data';

/**
 * Creates an onDocumentWritten trigger that syncs a Firestore collection
 * to a BigQuery table in real-time.
 */
export function createSyncTrigger(collectionName: string, tableName: string) {
  return onDocumentWritten(`${collectionName}/{docId}`, async (event) => {
    const docId = event.params.docId;

    if (!event.data) {
      // Should not happen on onDocumentWritten, but for type safety:
      return;
    }

    const after = event.data.after.exists ? event.data.after.data() : null;

    if (!after) {
      // Document was deleted. We must delete it from BigQuery.
      const query = `DELETE FROM \`${bq.projectId}.${datasetId}.${tableName}\` WHERE document_id = @id`;
      await bq.query({ query, params: { id: docId } });
      console.log(`[syncToBigQuery] Deleted ${docId} from ${tableName}`);
      return;
    }

    // Document was created or updated. Upsert into BigQuery using MERGE.
    // The 'data' column is of type JSON. We must format the object as a JSON string.
    const jsonData = JSON.stringify(after);

    const query = `
      MERGE \`${bq.projectId}.${datasetId}.${tableName}\` T
      USING (SELECT @id as id, PARSE_JSON(@data) as data) S
      ON T.document_id = S.id
      WHEN MATCHED THEN
        UPDATE SET data = S.data
      WHEN NOT MATCHED THEN
        INSERT (document_id, data) VALUES (S.id, S.data)
    `;

    try {
      await bq.query({
        query,
        params: { id: docId, data: jsonData },
      });
      console.log(`[syncToBigQuery] Upserted ${docId} to ${tableName}`);
    } catch (err) {
      console.error(`[syncToBigQuery] Error syncing ${docId} to ${tableName}:`, err);
      throw err; // Allow Cloud Functions to retry
    }
  });
}
