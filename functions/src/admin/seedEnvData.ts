import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import {
  getFirestore, type WriteBatch, type Firestore,
} from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

interface CompanyData {
  ownerUid?: string;
  ownerEmail?: string;
  viewerUids?: string[];
  viewerEmails?: string[];
  [key: string]: unknown;
}

/**
 * Resolves a uid to its email (cached), for denormalizing ownerEmail so the
 * seeded read-only shares display "by <owner>". Empty string on lookup fail.
 * @param {string} uid The user id to resolve.
 * @param {Map<string, string>} cache Uid → email memo.
 * @returns {Promise<string>} The email, or '' if unavailable.
 */
async function resolveEmail(
  uid: string, cache: Map<string, string>
): Promise<string> {
  const hit = cache.get(uid);
  if (hit !== undefined) return hit;
  let email = '';
  try {
    email = (await getAuth().getUser(uid)).email || '';
  } catch {
    email = '';
  }
  cache.set(uid, email);
  return email;
}

/**
 * Copies every company and its `materials` subcollection from one collection
 * to another, preserving document ids so it is an idempotent upsert. Any
 * company NOT owned by the caller also gets the caller added as a read-only
 * viewer (so it shows in their "view as" switcher in the test env). Safe to
 * re-run; non-destructive to the source.
 * @param {Firestore} db The Firestore instance.
 * @param {string} src The source collection name.
 * @param {string} dst The destination collection name.
 * @param {string} viewerUid The caller uid to grant read-only access.
 * @param {string} viewerEmail The caller email (parallel to viewerUid).
 * @param {Map<string, string>} emailCache Owner uid → email memo.
 * @returns {Promise<SeedResult>} Counts of companies + materials copied.
 */
async function copyCollection(
  db: Firestore, src: string, dst: string,
  viewerUid: string, viewerEmail: string,
  emailCache: Map<string, string>
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
    const data = company.data() as CompanyData;
    const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : '';
    // Grant the caller read-only access to companies they do not own, so the
    // switcher surfaces them. Owned companies already show in "My workspace".
    if (ownerUid && ownerUid !== viewerUid) {
      const uids = new Set<string>(
        Array.isArray(data.viewerUids) ? data.viewerUids : []
      );
      uids.add(viewerUid);
      data.viewerUids = [...uids];
      const emails = new Set<string>(
        Array.isArray(data.viewerEmails) ? data.viewerEmails : []
      );
      emails.add(viewerEmail);
      data.viewerEmails = [...emails];
      if (!data.ownerEmail) {
        data.ownerEmail = await resolveEmail(ownerUid, emailCache);
      }
    }
    batch.set(db.collection(dst).doc(company.id), data);
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
 * materials, upserting by id, and grants the calling admin read-only viewer
 * access to companies they do not own (so every seeded company is reachable
 * via the switcher). Safe to re-run. Prod `companies` is read-only here: only
 * `*_staging` / `*_dev` targets may be written.
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
  const emailCache = new Map<string, string>();
  const results: SeedResult[] = [];
  for (const target of TARGETS) {
    if (!/_(staging|dev)$/.test(target)) {
      throw new HttpsError('internal', `Refusing to write to '${target}'.`);
    }
    results.push(
      await copyCollection(db, SOURCE, target, auth.uid, caller, emailCache)
    );
  }
  return { success: true, results };
});
