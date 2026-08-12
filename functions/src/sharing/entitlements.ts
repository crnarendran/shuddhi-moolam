import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAILS = ['crnarendran@gmail.com', 'mvsaikishore@gmail.com'];

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
