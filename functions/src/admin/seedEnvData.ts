import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import {
  getFirestore, type WriteBatch, type Firestore,
} from 'firebase-admin/firestore';

// Only the admin may reseed test data. Founders are not necessarily admins.
const ADMIN_EMAILS = ['crnarendran@gmail.com'];

// Prod `companies` is the source of truth; only non-prod partitions are
// written. Same project / same Firestore, so any deployed instance can do
// this — no cross-project credentials needed.
const SOURCE = 'companies';
const TARGETS = ['companies_staging', 'companies_dev'];

interface SeedResult {
  target: string;
  companies: number;
  materials: number;
}

/**
 * Copies every company and its `materials` subcollection from one collection
 * to another, preserving document ids so it is an idempotent upsert. Safe to
 * re-run to refresh; non-destructive to the source and to unrelated docs in
 * the target.
 * @param {Firestore} db The Firestore instance.
 * @param {string} src The source collection name.
 * @param {string} dst The destination collection name.
 * @returns {Promise<SeedResult>} Counts of companies + materials copied.
 */
async function copyCollection(
  db: Firestore, src: string, dst: string
): Promise<SeedResult> {
  const companies = await db.collection(src).get();
  let batch: WriteBatch = db.batch();
  let pending = 0;
  let companyCount = 0;
  let materialCount = 0;
  const flush = async (): Promise<void> => {
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  };
  for (const company of companies.docs) {
    batch.set(db.collection(dst).doc(company.id), company.data());
    pending++;
    companyCount++;
    await flush();
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
      await flush();
    }
  }
  if (pending > 0) await batch.commit();
  return { target: dst, companies: companyCount, materials: materialCount };
}

/**
 * Admin-only callable that seeds the staging and dev company partitions from
 * prod so there is real data to test against (SM-48). Copies companies +
 * materials, upserting by id, so it is safe to re-run whenever you want to
 * refresh. Prod `companies` is read-only here: only `*_staging` / `*_dev`
 * targets may be written.
 * @param {CallableRequest} request Unused payload.
 * @returns {Promise<object>} { success, results } with per-target counts.
 */
export const seedEnvData = onCall(async (request: CallableRequest) => {
  const auth = request.auth;
  const caller = (auth?.token.email || '').toLowerCase();
  if (!auth || !ADMIN_EMAILS.includes(caller)) {
    throw new HttpsError('permission-denied', 'Admins only.');
  }
  const db = getFirestore();
  const results: SeedResult[] = [];
  for (const target of TARGETS) {
    if (!/_(staging|dev)$/.test(target)) {
      throw new HttpsError('internal', `Refusing to write to '${target}'.`);
    }
    results.push(await copyCollection(db, SOURCE, target));
  }
  return { success: true, results };
});
