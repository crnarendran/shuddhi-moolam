// One-off admin utility: copy companies AND their `materials` subcollection
// from one env-suffixed collection to another within the same project — e.g.
// seed staging/dev from prod so there is real data to test against:
//
//   node scripts/copyCompanies.mjs companies companies_staging
//   node scripts/copyCompanies.mjs companies companies_dev
//
// Idempotent: destination docs keep their SOURCE ids, so re-running upserts in
// place (no duplicates) and leaves any other test data in the destination
// untouched. Non-destructive to the source. Auth is shared across envs (one
// Firebase project), so ownerUid/viewerUids remain valid in the destination.
//
// Add --dry-run to count without writing.
// Auth: GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key with
//       Firestore read/write on sai-shuddhi-moolam.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [src, dst] = args.filter((a) => !a.startsWith('--'));

if (!src || !dst) {
  console.error(
    'Usage: node copyCompanies.mjs <source> <dest> [--dry-run]'
  );
  process.exit(1);
}
if (src === dst) {
  console.error('Source and destination must differ.');
  process.exit(1);
}
// Safety: never write to the bare prod `companies` collection. A destination
// must be an explicit non-prod env partition.
if (!/_(staging|dev)$/.test(dst)) {
  console.error(
    `Refusing to write to '${dst}': destination must end in ` +
    "'_staging' or '_dev' (prod 'companies' is read-only here)."
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const companies = await db.collection(src).get();
console.log(
  `Source '${src}': ${companies.size} companies` +
  (dryRun ? ' (dry run — no writes)' : '')
);

let batch = db.batch();
let pending = 0;
let companyCount = 0;
let materialCount = 0;

/** Commits the current batch and starts a fresh one when it fills up. */
async function flushIfFull() {
  if (pending >= 400) {
    if (!dryRun) await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}

for (const company of companies.docs) {
  batch.set(db.collection(dst).doc(company.id), company.data());
  pending++;
  companyCount++;
  await flushIfFull();

  const mats = await db
    .collection(src).doc(company.id)
    .collection('materials').get();
  for (const mat of mats.docs) {
    batch.set(
      db.collection(dst).doc(company.id)
        .collection('materials').doc(mat.id),
      mat.data()
    );
    pending++;
    materialCount++;
    await flushIfFull();
  }
  console.log(
    `  ${company.data().name ?? company.id}: ${mats.size} materials`
  );
}

if (pending > 0 && !dryRun) await batch.commit();

console.log(
  `${dryRun ? 'Would copy' : 'Copied'} ${companyCount} companies + ` +
  `${materialCount} materials to '${dst}'.`
);
