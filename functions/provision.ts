import { BigQuery } from '@google-cloud/bigquery';

const projectId = 'sai-shuddhi-moolam';
const datasetId = 'extracted_data';
const bq = new BigQuery({ projectId });

const tables = [
  'pipeline_runs', 'pipeline_runs_dev', 'pipeline_runs_staging',
  'companies', 'companies_dev', 'companies_staging',
  'historical_prices', 'historical_prices_dev', 'historical_prices_staging'
];

async function provision() {
  const dataset = bq.dataset(datasetId);

  // Schema: document ID and the native JSON payload
  const schema = [
    { name: 'document_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'data', type: 'JSON', mode: 'REQUIRED' }
  ];

  for (const tableId of tables) {
    const table = dataset.table(tableId);
    const [exists] = await table.exists();
    if (!exists) {
      console.log(`Creating table ${tableId}...`);
      await dataset.createTable(tableId, { schema });
      console.log(`Table ${tableId} created.`);
    } else {
      console.log(`Table ${tableId} already exists. Updating schema...`);
      // Update schema if needed
      const [metadata] = await table.getMetadata();
      metadata.schema = { fields: schema };
      await table.setMetadata(metadata);
      console.log(`Table ${tableId} schema updated.`);
    }
  }
}

provision().catch(console.error);
