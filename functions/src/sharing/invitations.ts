import {
  onCall, HttpsError, type CallableRequest,
} from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { APP_BASE_URL } from '../config';
import { sendInviteEmail } from './email';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CompanyDoc {
  ownerUid: string;
  name: string;
  viewerUids?: string[];
  viewerEmails?: string[];
}

interface InvitationDoc {
  companyId: string;
  companyName: string;
  ownerUid: string;
  ownerEmail: string;
  inviteeEmail: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  acceptedUid?: string;
}

/**
 * Extracts the authenticated caller, or throws. Email is lower-cased.
 * @param {CallableRequest} req The callable request.
 * @returns {{uid: string, email: string}} The caller identity.
 */
function callerOf(req: CallableRequest): { uid: string; email: string } {
  const auth = req.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  return { uid: auth.uid, email: (auth.token.email || '').toLowerCase() };
}

/**
 * A fresh, unguessable invite token.
 * @returns {string} A hex token.
 */
function newToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Owner creates (or refreshes) a pending read-only invitation for a company
 * and emails the invitee an accept link. Reuses an existing pending invite
 * for the same company+email rather than duplicating.
 * @param {CallableRequest} request companyId + inviteeEmail.
 * @returns {Promise<object>} { success, inviteId, emailSent, acceptUrl }.
 */
export const createInvitation = onCall(
  // Secret binding pending: the deploy SA needs Secret Manager access on
  // RESEND_API_KEY. Until then, email is degraded (UI shows the accept link).
  async (request) => {
    const { uid, email } = callerOf(request);
    const data = request.data as { companyId?: string; inviteeEmail?: string };
    const companyId = (data.companyId || '').trim();
    const inviteeEmail = (data.inviteeEmail || '').trim().toLowerCase();
    if (!companyId || !inviteeEmail || !inviteeEmail.includes('@')) {
      throw new HttpsError('invalid-argument', 'companyId + email required.');
    }
    if (inviteeEmail === email) {
      throw new HttpsError('invalid-argument', 'You cannot invite yourself.');
    }

    const db = getFirestore();
    const compSnap = await db.collection('companies').doc(companyId).get();
    if (!compSnap.exists) {
      throw new HttpsError('not-found', 'Company not found.');
    }
    const company = compSnap.data() as CompanyDoc;
    if (company.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Not your company.');
    }

    const now = Date.now();
    const token = newToken();
    const dup = await db.collection('invitations')
      .where('companyId', '==', companyId)
      .where('inviteeEmail', '==', inviteeEmail)
      .get();
    const pending = dup.docs.find(
      (d) => (d.data() as InvitationDoc).status === 'pending'
    );

    let inviteId: string;
    if (pending) {
      inviteId = pending.id;
      await pending.ref.update({
        token, createdAt: now, expiresAt: now + TTL_MS,
      });
    } else {
      const doc: InvitationDoc = {
        companyId, companyName: company.name, ownerUid: uid, ownerEmail: email,
        inviteeEmail, token, status: 'pending',
        createdAt: now, expiresAt: now + TTL_MS,
      };
      const ref = await db.collection('invitations').add(doc);
      inviteId = ref.id;
    }

    const acceptUrl = `${APP_BASE_URL}/?invite=${token}`;
    const emailSent = await sendInviteEmail({
      to: inviteeEmail, companyName: company.name, ownerEmail: email, acceptUrl,
    });
    return { success: true, inviteId, emailSent, acceptUrl };
  }
);

/**
 * Invitee accepts an invitation by token: validates email match + expiry,
 * then grants read-only access by adding their uid to the company's
 * viewerUids. Idempotent for the same accepting user.
 * @param {CallableRequest} request { token }.
 * @returns {Promise<object>} { success, companyId, companyName }.
 */
export const acceptInvitation = onCall(async (request) => {
  const { uid, email } = callerOf(request);
  const token = ((request.data as { token?: string }).token || '').trim();
  if (!token) throw new HttpsError('invalid-argument', 'token required.');

  const db = getFirestore();
  const q = await db.collection('invitations')
    .where('token', '==', token).limit(1).get();
  if (q.empty) throw new HttpsError('not-found', 'Invitation not found.');
  const inviteRef = q.docs[0].ref;
  const inv = q.docs[0].data() as InvitationDoc;

  if (inv.inviteeEmail !== email) {
    throw new HttpsError(
      'permission-denied', 'This invitation is for a different email.'
    );
  }
  if (inv.status === 'revoked') {
    throw new HttpsError('failed-precondition', 'This invitation was revoked.');
  }
  const alreadyMine = inv.status === 'accepted' && inv.acceptedUid === uid;
  if (inv.status === 'pending' && Date.now() > inv.expiresAt) {
    throw new HttpsError('failed-precondition', 'This invitation has expired.');
  }

  await db.collection('companies').doc(inv.companyId).update({
    viewerUids: FieldValue.arrayUnion(uid),
    viewerEmails: FieldValue.arrayUnion(email),
    ownerEmail: inv.ownerEmail,
  });
  if (!alreadyMine) {
    await inviteRef.update({
      status: 'accepted', acceptedUid: uid, acceptedAt: Date.now(),
    });
  }
  return {
    success: true, companyId: inv.companyId, companyName: inv.companyName,
  };
});

/**
 * Owner resends an invite: regenerates the token, resets the 7-day expiry to
 * pending, and re-emails. Rejects an already-accepted invite.
 * @param {CallableRequest} request { inviteId }.
 * @returns {Promise<object>} { success, emailSent, acceptUrl }.
 */
export const resendInvitation = onCall(
  // Secret binding pending (see createInvitation).
  async (request) => {
    const { uid } = callerOf(request);
    const inviteId = ((request.data as { inviteId?: string }).inviteId || '')
      .trim();
    if (!inviteId) {
      throw new HttpsError('invalid-argument', 'inviteId required.');
    }

    const db = getFirestore();
    const ref = db.collection('invitations').doc(inviteId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Invitation not found.');
    }
    const inv = snap.data() as InvitationDoc;
    if (inv.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Not your invitation.');
    }
    if (inv.status === 'accepted') {
      throw new HttpsError('failed-precondition', 'Already accepted.');
    }

    const now = Date.now();
    const token = newToken();
    await ref.update({
      token, status: 'pending', createdAt: now, expiresAt: now + TTL_MS,
      acceptedAt: FieldValue.delete(), acceptedUid: FieldValue.delete(),
    });
    const acceptUrl = `${APP_BASE_URL}/?invite=${token}`;
    const emailSent = await sendInviteEmail({
      to: inv.inviteeEmail, companyName: inv.companyName,
      ownerEmail: inv.ownerEmail, acceptUrl,
    });
    return { success: true, emailSent, acceptUrl };
  }
);

/**
 * Owner revokes an invite: marks it revoked and, if it was accepted, removes
 * the viewer's read access from the company.
 * @param {CallableRequest} request { inviteId }.
 * @returns {Promise<object>} { success }.
 */
export const revokeInvitation = onCall(async (request) => {
  const { uid } = callerOf(request);
  const inviteId = ((request.data as { inviteId?: string }).inviteId || '')
    .trim();
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId required.');

  const db = getFirestore();
  const ref = db.collection('invitations').doc(inviteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = snap.data() as InvitationDoc;
  if (inv.ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Not your invitation.');
  }

  if (inv.acceptedUid) {
    await db.collection('companies').doc(inv.companyId).update({
      viewerUids: FieldValue.arrayRemove(inv.acceptedUid),
      viewerEmails: FieldValue.arrayRemove(inv.inviteeEmail),
    });
  }
  await ref.update({ status: 'revoked' });
  return { success: true };
});
