import { initializeApp } from 'firebase-admin/app';
process.env.APP_ENV = 'prod';
import { downloadPdf } from '../src/drive/download';
import { extractPricesFromPdf } from '../src/gemini/extract';
import { ensureYearTab } from '../src/sheets/routing';
import { upsertRow } from '../src/sheets/upsert';
import { logAuditTrail } from '../src/sheets/audit';
import { recordStage } from '../src/pipeline/telemetry';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'sai-shuddhi-moolam' });

async function run() {
  const fileId = '1ZmnEEMAKSCI20XWDO62gN4hcDX5dUbkw';
  console.log('Downloading...');
  await recordStage(fileId, 'downloading');
  const { buffer, filename } = await downloadPdf(fileId);
  
  await getFirestore().collection('pipeline_runs').doc(fileId).update({ fileName: filename });

  console.log('Extracting...', filename);
  await recordStage(fileId, 'extracting');
  const { data: record, usage } = await extractPricesFromPdf(buffer);
  record.filename = filename;
  
  console.log('Routing...');
  await recordStage(fileId, 'routing');
  const tabTitle = await ensureYearTab(record.date);
  
  console.log('Upserting...');
  await recordStage(fileId, 'upserting');
  const action = await upsertRow(tabTitle, record);
  
  console.log('Auditing...');
  await logAuditTrail(action, record);
  
  await recordStage(fileId, 'appended', {
    gemini: {
      tokensIn: usage.promptTokenCount || 0,
      tokensOut: usage.candidatesTokenCount || 0,
    },
    year: parseInt(record.date.split('/')[2] || '0', 10),
    targetTab: tabTitle,
    completedAt: Date.now()
  });

  console.log('DONE!');
}
run().catch(async (e) => {
  console.error(e);
  await recordStage('1ZmnEEMAKSCI20XWDO62gN4hcDX5dUbkw', 'failed', { error: { stage: 'process', message: e.message }});
});
