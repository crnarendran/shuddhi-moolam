// One-off admin utility: copy all top-level docs from one Firestore
// collection to another within the same project (e.g. prod
// `historical_prices` -> `historical_prices_dev` so the dev reports have
// real data to test against). Non-destructive to the source.
//
// Usage: node scripts/copyHistorical.mjs <sourceCollection> <destCollection>
// Auth:  GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key
//        with Firestore read/write on the project.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('Usage: node copyHistorical.mjs <source> <dest>');
  process.exit(1);
}
if (src === dst) {
  console.error('Source and destination must differ.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const snap = await db.collection(src).get();
console.log(`Read ${snap.size} docs from '${src}'.`);

let batch = db.batch();
let pending = 0;
let total = 0;
for (const doc of snap.docs) {
  batch.set(db.collection(dst).doc(doc.id), doc.data());
  pending++;
  total++;
  if (pending >= 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending > 0) await batch.commit();

console.log(`Copied ${total} docs to '${dst}'.`);
