import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, functions, fnName } from '../firebase';
import { type Invitation } from '../lib/sharing';

interface CreateResult {
  success: boolean;
  inviteId: string;
  emailSent: boolean;
  acceptUrl: string;
}
interface AcceptResult {
  success: boolean;
  companyId: string;
  companyName: string;
}

/**
 * The signed-in owner's invitations (across all their companies) plus the
 * create / resend / revoke callable actions (SM-41).
 */
export function useInvitations() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [invites, setInvites] = useState<Invitation[]>([]);

  useEffect(
    () => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)),
    []
  );
  useEffect(() => {
    if (!uid) { setInvites([]); return; }
    const q = query(
      collection(db, 'invitations'), where('ownerUid', '==', uid)
    );
    return onSnapshot(
      q,
      (snap) => setInvites(snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Invitation, 'id'>) })
      )),
      () => setInvites([])
    );
  }, [uid]);

  const create = (companyId: string, inviteeEmail: string) =>
    httpsCallable<{ companyId: string; inviteeEmail: string }, CreateResult>(
      functions, fnName('createInvitation')
    )({ companyId, inviteeEmail }).then((r) => r.data);

  const resend = (inviteId: string) =>
    httpsCallable<{ inviteId: string }, CreateResult>(
      functions, fnName('resendInvitation')
    )({ inviteId }).then((r) => r.data);

  const revoke = (inviteId: string) =>
    httpsCallable<{ inviteId: string }, { success: boolean }>(
      functions, fnName('revokeInvitation')
    )({ inviteId }).then((r) => r.data);

  return { invites, create, resend, revoke };
}

/**
 * Accepts an invitation by token via the trusted callable (SM-41). Resolves
 * with the shared company on success; rejects (HttpsError) otherwise.
 * @param token The invite token from the accept link.
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const fn = httpsCallable<{ token: string }, AcceptResult>(
    functions, fnName('acceptInvitation')
  );
  const r = await fn({ token });
  return r.data;
}
