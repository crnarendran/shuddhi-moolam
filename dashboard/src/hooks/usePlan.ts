import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';

export type Plan = 'free' | 'premium';

// Founders are grandfathered premium; everyone else is gated by an
// entitlements/{uid} doc (SM-42). Mirrors firestore.rules isPremium().
const FOUNDER_EMAILS = ['crnarendran@gmail.com', 'mvsaikishore@gmail.com'];

/**
 * The signed-in user's plan (SM-42). Premium unlocks creating your own
 * companies/materials; free users only view companies shared with them.
 * Reads entitlements/{uid}; founders resolve to premium without a doc.
 */
export function usePlan(): { plan: Plan; premium: boolean; loading: boolean } {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [email, setEmail] = useState<string | null>(
    auth.currentUser?.email ?? null
  );
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUid(u?.uid ?? null);
    setEmail(u?.email ?? null);
  }), []);

  useEffect(() => {
    if (!uid) { setPlan('free'); setLoading(false); return; }
    if (email && FOUNDER_EMAILS.includes(email.toLowerCase())) {
      setPlan('premium'); setLoading(false); return;
    }
    return onSnapshot(
      doc(db, 'entitlements', uid),
      (snap) => {
        setPlan(snap.exists() && snap.data().plan === 'premium'
          ? 'premium' : 'free');
        setLoading(false);
      },
      () => { setPlan('free'); setLoading(false); }
    );
  }, [uid, email]);

  return { plan, premium: plan === 'premium', loading };
}
