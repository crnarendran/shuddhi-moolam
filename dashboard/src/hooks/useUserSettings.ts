import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type UserSettings,
} from '../lib/userSettings';

interface UseUserSettings {
  settings: UserSettings;
  update: (patch: Partial<UserSettings>) => Promise<void>;
  loading: boolean;
  signedIn: boolean;
}

/**
 * Subscribes to the signed-in user's `user_settings/{uid}` doc and exposes
 * an optimistic `update(patch)`. When signed out it returns defaults and
 * `update` is a no-op (nothing to persist). Self-contained: it tracks auth
 * itself, so any component can call it without prop-drilling the user.
 * @returns {UseUserSettings} settings, update, loading, signedIn.
 */
export function useUserSettings(): UseUserSettings {
  const [uid, setUid] = useState<string | null>(
    auth.currentUser?.uid ?? null
  );
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(
    () => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)),
    []
  );

  useEffect(() => {
    if (!uid) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'user_settings', uid);
    return onSnapshot(
      ref,
      (snap) => {
        setSettings(
          snap.exists() ? (snap.data() as UserSettings) : DEFAULT_SETTINGS
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [uid]);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!uid) return;
      const next = mergeSettings(settingsRef.current, {
        ...patch,
        updatedAt: Date.now(),
      });
      setSettings(next);
      await setDoc(doc(db, 'user_settings', uid), next, { merge: true });
    },
    [uid]
  );

  return { settings, update, loading, signedIn: !!uid };
}
