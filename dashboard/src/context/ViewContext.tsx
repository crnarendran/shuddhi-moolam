import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
  useState, type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COMPANIES_COLLECTION } from '../lib/config';
import { useCompanies } from '../hooks/useCompanies';
import { useUserSettings } from '../hooks/useUserSettings';
import {
  costImpactWeights, type Company, type Material,
} from '../lib/materials';

export interface SharedView {
  companyId: string;
  companyName: string;
  ownerEmail: string;
}

interface Selection {
  companyId: string | null;
  /** Single-product selection per company (single-select reports). */
  single: Record<string, string>;
  /** Multi-product selection per company (Guidance). Kept separate from
   *  `single` so switching between single/multi reports never resets the
   *  other (SM-60). */
  multi: Record<string, string[]>;
}

interface ViewCtx {
  companyId: string | null;
  /** Active company's single-product selection (single-select reports). */
  materialId: string | null;
  /** Active company's multi-product selection (Guidance). */
  materialIds: string[];
  setCompany: (companyId: string | null) => void;
  setSingle: (materialId: string | null) => void;
  setMulti: (materialIds: string[]) => void;
  company: Company | null;
  /** The single-selected material — single-product reports + Cost Impact. */
  product: Material | null;
  /** The multi-selected materials — Guidance compares these. */
  products: Material[];
  materials: Material[];
  isShared: boolean;
  productWeights: Record<string, number> | null;
  /** Commodity scope for single-product reports: the single product's recipe
   *  → the company's union → null (My workspace = all). */
  scopeKeys: string[] | null;
  shared: SharedView | null;
  setShared: (s: SharedView | null) => void;
}

const Ctx = createContext<ViewCtx>({
  companyId: null, materialId: null, materialIds: [], setCompany: () => {},
  setSingle: () => {}, setMulti: () => {}, company: null, product: null,
  products: [], materials: [], isShared: false, productWeights: null,
  scopeKeys: null, shared: null, setShared: () => {},
});

const SEL_KEY = 'sm.viewSelection';
const LEGACY_SHARED_KEY = 'sm.sharedView';

/** Derives the single-product map from an older per-company list map. */
function singleFromLists(
  lists: Record<string, string[]>
): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(lists).forEach(([c, ids]) => {
    if (ids && ids[0]) out[c] = ids[0];
  });
  return out;
}

/** Loads the persisted selection, tolerating older shapes. */
function loadSelection(): Selection {
  try {
    const raw = localStorage.getItem(SEL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as {
        companyId?: string | null;
        single?: Record<string, string>;
        multi?: Record<string, string[]>;
        byCompany?: Record<string, string[]>;
        materialIds?: string[];
        materialId?: string;
      };
      const companyId = p.companyId ?? null;
      if (p.single || p.multi) {
        return { companyId, single: p.single ?? {}, multi: p.multi ?? {} };
      }
      if (p.byCompany) {
        return {
          companyId, single: singleFromLists(p.byCompany), multi: p.byCompany,
        };
      }
      const ids = Array.isArray(p.materialIds)
        ? p.materialIds : p.materialId ? [p.materialId] : [];
      if (companyId && ids.length) {
        return {
          companyId, single: { [companyId]: ids[0] },
          multi: { [companyId]: ids },
        };
      }
      return { companyId, single: {}, multi: {} };
    }
    const legacy = localStorage.getItem(LEGACY_SHARED_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as SharedView;
      return { companyId: s.companyId ?? null, single: {}, multi: {} };
    }
  } catch { /* ignore */ }
  return { companyId: null, single: {}, multi: {} };
}

/**
 * Provides the global Company·Product view context (SM-60). One company
 * selection drives every report; the product selection is kept per company
 * AND split between the single-product reports (`single`) and Guidance's
 * multi-select (`multi`) so switching report types never resets the other.
 * Both maps persist to localStorage (per device) and the account (cross
 * device). `shared` stays a derived, back-compatible value.
 * @param props Children to render within the provider.
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const { companies, shared: sharedCompanies } = useCompanies();
  const { settings, update, loading: settingsLoading } = useUserSettings();
  const [sel, setSel] = useState<Selection>(loadSelection);
  const [materials, setMaterials] = useState<Material[]>([]);
  const hydratedRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist to localStorage (per-device) on every change.
  useEffect(() => {
    try {
      localStorage.setItem(SEL_KEY, JSON.stringify(sel));
    } catch { /* ignore storage failures (private mode etc.) */ }
  }, [sel]);

  // Hydrate the per-company maps from the account (cross-device) once settings
  // load; account entries win, any local-only entries are kept.
  useEffect(() => {
    if (settingsLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    const ps = settings.productSelection;
    if (!ps) return;
    const storedSingle = ps.single
      ?? (ps.byCompany ? singleFromLists(ps.byCompany) : undefined);
    const storedMulti = ps.multi ?? ps.byCompany;
    if (storedSingle || storedMulti) {
      setSel((prev) => ({
        ...prev,
        single: { ...prev.single, ...(storedSingle ?? {}) },
        multi: { ...prev.multi, ...(storedMulti ?? {}) },
      }));
    }
  }, [settingsLoading, settings]);

  // Sync the per-company maps to the account (debounced) after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void update({
        productSelection: { single: sel.single, multi: sel.multi },
      });
    }, 600);
  }, [sel.single, sel.multi, update]);

  const setCompany = useCallback((companyId: string | null) => {
    setSel((prev) => ({ ...prev, companyId }));
  }, []);

  const setSingle = useCallback((materialId: string | null) => {
    setSel((prev) => {
      if (!prev.companyId) return prev;
      const single = { ...prev.single };
      if (materialId) single[prev.companyId] = materialId;
      else delete single[prev.companyId];
      return { ...prev, single };
    });
  }, []);

  const setMulti = useCallback((materialIds: string[]) => {
    setSel((prev) => prev.companyId
      ? {
        ...prev,
        multi: { ...prev.multi, [prev.companyId]: materialIds },
      }
      : prev);
  }, []);

  const allCompanies = useMemo(() => {
    const map = new Map<string, Company>();
    [...companies, ...sharedCompanies].forEach(
      (c) => c.id && map.set(c.id, c)
    );
    return map;
  }, [companies, sharedCompanies]);

  // Drop a company selection that is no longer visible (e.g. unshared) back to
  // My workspace, once companies have loaded. Its remembered products stay.
  useEffect(() => {
    if (sel.companyId && !allCompanies.has(sel.companyId)
      && (companies.length > 0 || sharedCompanies.length > 0)) {
      setSel((prev) => ({ ...prev, companyId: null }));
    }
  }, [sel.companyId, allCompanies, companies.length, sharedCompanies.length]);

  // Subscribe to the selected company's materials (own or shared).
  useEffect(() => {
    if (!sel.companyId) { setMaterials([]); return; }
    const col = collection(
      db, COMPANIES_COLLECTION, sel.companyId, 'materials'
    );
    return onSnapshot(
      col,
      (snap) => setMaterials(snap.docs.map((d) => ({
        id: d.id, ...(d.data() as Omit<Material, 'id'>),
      }))),
      () => setMaterials([])
    );
  }, [sel.companyId]);

  const materialId = sel.companyId
    ? sel.single[sel.companyId] ?? null : null;
  const materialIds = sel.companyId
    ? sel.multi[sel.companyId] ?? [] : [];

  const company = sel.companyId
    ? allCompanies.get(sel.companyId) ?? null : null;
  const isShared = !!sel.companyId
    && sharedCompanies.some((c) => c.id === sel.companyId);

  const product = useMemo(
    () => materialId
      ? materials.find((m) => m.id === materialId) ?? null : null,
    [materialId, materials]
  );
  const products = useMemo(
    () => materialIds
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is Material => !!m),
    [materialIds, materials]
  );

  const productWeights = useMemo(
    () => product ? costImpactWeights(product.composition) : null,
    [product]
  );

  const scopeKeys = useMemo<string[] | null>(() => {
    if (product) {
      return [...new Set(product.composition.map((c) => c.commodityKey))];
    }
    if (sel.companyId) {
      const keys = new Set<string>();
      materials.forEach((m) =>
        (m.composition || []).forEach((c) => keys.add(c.commodityKey)));
      return [...keys];
    }
    return null;
  }, [product, sel.companyId, materials]);

  const shared = useMemo<SharedView | null>(() => {
    if (!isShared || !company?.id) return null;
    return {
      companyId: company.id, companyName: company.name,
      ownerEmail: company.ownerEmail ?? '',
    };
  }, [isShared, company]);

  const setShared = useCallback(
    (s: SharedView | null) => setCompany(s?.companyId ?? null),
    [setCompany]
  );

  const value: ViewCtx = {
    companyId: sel.companyId, materialId, materialIds, setCompany, setSingle,
    setMulti, company, product, products, materials, isShared, productWeights,
    scopeKeys, shared, setShared,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the current global view context (company/product + scope). */
export function useView(): ViewCtx {
  return useContext(Ctx);
}
