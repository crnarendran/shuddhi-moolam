// Read-only company sharing model (SM-41). An owner invites a viewer by email;
// the invite is tracked, expires after 7 days, and can be resent/revoked.
// Invitations are written only by backend callables; the client reads them
// (owner) and calls the callables to mutate.

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface Invitation {
  id?: string;
  companyId: string;
  companyName: string;
  ownerUid: string;
  ownerEmail: string;
  inviteeEmail: string; // lower-cased
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  acceptedUid?: string;
  lastSeenAt?: number;
}

/** Effective display status, deriving "expired" from a pending past-expiry. */
export type InviteDisplayStatus =
  | 'waiting' | 'accepted' | 'expired' | 'revoked';

/**
 * Derives the display status shown to the owner from the stored invite.
 * A pending invite past its expiry reads as "expired" without a stored flag.
 * @param inv The invitation.
 * @param now Current epoch ms (injectable for tests).
 */
export function inviteDisplayStatus(
  inv: Pick<Invitation, 'status' | 'expiresAt'>,
  now: number = Date.now()
): InviteDisplayStatus {
  if (inv.status === 'accepted') return 'accepted';
  if (inv.status === 'revoked') return 'revoked';
  return now > inv.expiresAt ? 'expired' : 'waiting';
}

/** True when a pending invite can still be accepted. */
export function isInviteAcceptable(
  inv: Pick<Invitation, 'status' | 'expiresAt'>,
  now: number = Date.now()
): boolean {
  return inv.status === 'pending' && now <= inv.expiresAt;
}
