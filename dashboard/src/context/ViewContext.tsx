import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { type Composition } from '../lib/materials';

export interface SharedView {
  companyId: string;
  companyName: string;
  ownerEmail: string;
}

interface ViewCtx {
  /** The active shared company, or null for the user's own workspace. */
  shared: SharedView | null;
  setShared: (s: SharedView | null) => void;
  /** Commodity keys linked to the shared company (union of its materials), or
   *  null in own-workspace mode. Reports scope to this when set (SM-41). */
  scopeKeys: string[] | null;
}

const Ctx = createContext<ViewCtx>({
  shared: null, setShared: () => {}, scopeKeys: null,
});

/**
 * Provides the current view context — own workspace vs a company shared with
 * the user (read-only) — and the shared company's commodity scope, derived
 * live from its materials.
 * @param props Children to render within the provider.
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const [shared, setShared] = useState<SharedView | null>(null);
  const [scopeKeys, setScopeKeys] = useState<string[] | null>(null);

  useEffect(() => {
    if (!shared) { setScopeKeys(null); return; }
    const col = collection(db, 'companies', shared.companyId, 'materials');
    return onSnapshot(
      col,
      (snap) => {
        const keys = new Set<string>();
        snap.docs.forEach((d) => {
          const comp = (d.data().composition || []) as Composition[];
          comp.forEach((c) => keys.add(c.commodityKey));
        });
        setScopeKeys([...keys]);
      },
      () => setScopeKeys([])
    );
  }, [shared]);

  return (
    <Ctx.Provider value={{ shared, setShared, scopeKeys }}>
      {children}
    </Ctx.Provider>
  );
}

/** Access the current view context (shared company + commodity scope). */
export function useView(): ViewCtx {
  return useContext(Ctx);
}
