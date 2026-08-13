import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Admins can grant plans / list users. Founders are grandfathered premium
// but are not necessarily admins (SM-42).
const ADMIN_EMAILS = ['crnarendran@gmail.com'];
const FOUNDER_EMAILS = ['crnarendran@gmail.com', 'mvsaikishore@gmail.com'];

/**
 * Admin-only callable to set a user's plan entitlement (SM-42). Resolves the
 * target by email (the user must have signed in at least once) and writes
 * entitlements/{uid}. This is the interim "license grant"; a billing webhook
 * can later write the same doc for a subscription model.
 * @param {CallableRequest} request { email, plan: 'free' | 'premium' }.
 * @returns {Promise<object>} { success, uid, plan }.
 */
export const setUserPlan = onCall(async (request: CallableRequest) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const caller = (auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(caller)) {
    throw new HttpsError('permission-denied', 'Admins only.');
  }
  const data = request.data as { email?: string; plan?: string };
  const email = (data.email || '').trim().toLowerCase();
  const plan = data.plan;
  if (!email || (plan !== 'free' && plan !== 'premium')) {
    throw new HttpsError('invalid-argument', 'email + plan (free|premium).');
  }
  if (plan === 'free' && FOUNDER_EMAILS.includes(email)) {
    throw new HttpsError('invalid-argument', 'Cannot downgrade a founder to free.');
  }
  let uid: string;
  try {
    uid = (await getAuth().getUserByEmail(email)).uid;
  } catch {
    throw new HttpsError(
      'not-found', 'No user with that email (they must sign in once first).'
    );
  }
  await getFirestore().collection('entitlements').doc(uid).set(
    { plan, email, updatedAt: Date.now() }, { merge: true }
  );
  return { success: true, uid, plan };
});

/**
 * Admin-only callable listing every auth user with their effective plan
 * (founders → premium; else entitlements/{uid}) for the Admin panel (SM-42).
 * @param {CallableRequest} request Unused payload.
 * @returns {Promise<object>} { users: [{ uid, email, plan, lastSignIn }] }.
 */
export const listUserPlans = onCall(async (request: CallableRequest) => {
  const auth = request.auth;
  const caller = (auth?.token.email || '').toLowerCase();
  if (!auth || !ADMIN_EMAILS.includes(caller)) {
    throw new HttpsError('permission-denied', 'Admins only.');
  }
  const db = getFirestore();
  const entSnap = await db.collection('entitlements').get();
  const plans = new Map<string, string>();
  entSnap.docs.forEach((d) => plans.set(d.id, d.data().plan));

  const users: {
    uid: string; email: string; plan: string; lastSignIn: string | null;
  }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await getAuth().listUsers(1000, pageToken);
    res.users.forEach((u) => {
      const email = (u.email || '').toLowerCase();
      const premium = FOUNDER_EMAILS.includes(email)
        || plans.get(u.uid) === 'premium';
      users.push({
        uid: u.uid, email: u.email || '(no email)',
        plan: premium ? 'premium' : 'free',
        lastSignIn: u.metadata.lastSignInTime || null,
      });
    });
    pageToken = res.pageToken;
  } while (pageToken);
  users.sort((a, b) => a.email.localeCompare(b.email));
  return { users };
});
