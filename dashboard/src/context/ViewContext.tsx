import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COMPANIES_COLLECTION } from '../lib/config';
import { useCompanies } from '../hooks/useCompanies';
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
  materialId: string | null;
}

interface ViewCtx {
  /** Global selection (SM-59): the active company (own or shared) and an
   *  optional product/material within it. null companyId = My workspace. */
  companyId: string | null;
  materialId: string | null;
  setSelection: (companyId: string | null, materialId: string | null) => void;
  /** Resolved objects for the current selection. */
  company: Company | null;
  product: Material | null;
  /** Materials of the selected company (for the picker + Guidance seed). */
  materials: Material[];
  /** True when the selected company is one shared with the user (read-only). */
  isShared: boolean;
  /** BOM-derived Cost-Impact weights when a product is selected, else null. */
  productWeights: Record<string, number> | null;
  /** Commodity scope for reports: the product's recipe → the company's union
   *  of material commodities → null (My workspace = all). */
  scopeKeys: string[] | null;
  /** Back-compat: the shared company as a SharedView (read-only gates); null
   *  for own companies / My workspace. */
  shared: SharedView | null;
  /** Back-compat setter used by the shared-invite flow; selects that company
   *  (product reset). */
  setShared: (s: SharedView | null) => void;
}

const Ctx = createContext<ViewCtx>({
  companyId: null, materialId: null, setSelection: () => {},
  company: null, product: null, materials: [], isShared: false,
  productWeights: null, scopeKeys: null, shared: null, setShared: () => {},
});

const SEL_KEY = 'sm.viewSelection';
const LEGACY_SHARED_KEY = 'sm.sharedView';

/** Loads the persisted selection, migrating the legacy shared-view key. */
function loadSelection(): Selection {
  try {
    const raw = localStorage.getItem(SEL_KEY);
    if (raw) return JSON.parse(raw) as Selection;
    const legacy = localStorage.getItem(LEGACY_SHARED_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as SharedView;
      return { companyId: s.companyId ?? null, materialId: null };
    }
  } catch { /* ignore */ }
  return { companyId: null, materialId: null };
}

/**
 * Provides the global Company·Product view context (SM-59). One selection —
 * an optional company (own or shared) and an optional product within it —
 * drives every report: `scopeKeys` filters commodities and `productWeights`
 * feeds Cost Impact. `shared` stays a derived, back-compatible value so the
 * read-only shared-company flow (invites, gates) is unchanged.
 * @param props Children to render within the provider.
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const { companies, shared: sharedCompanies } = useCompanies();
  const [sel, setSel] = useState<Selection>(loadSelection);
  const [materials, setMaterials] = useState<Material[]>([]);

  const persist = useCallback((next: Selection) => {
    setSel(next);
    try {
      localStorage.setItem(SEL_KEY, JSON.stringify(next));
    } catch { /* ignore storage failures (private mode etc.) */ }
  }, []);

  const setSelection = useCallback(
    (companyId: string | null, materialId: string | null) =>
      persist({ companyId, materialId }),
    [persist]
  );

  const allCompanies = useMemo(() => {
    const map = new Map<string, Company>();
    [...companies, ...sharedCompanies].forEach(
      (c) => c.id && map.set(c.id, c)
    );
    return map;
  }, [companies, sharedCompanies]);

  // Drop a company selection that is no longer visible (e.g. unshared) back to
  // My workspace, once companies have actually loaded.
  useEffect(() => {
    if (sel.companyId && !allCompanies.has(sel.companyId)
      && (companies.length > 0 || sharedCompanies.length > 0)) {
      persist({ companyId: null, materialId: null });
    }
  }, [sel.companyId, allCompanies, companies.length, sharedCompanies.length,
    persist]);

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

  const company = sel.companyId
    ? allCompanies.get(sel.companyId) ?? null : null;
  const isShared = !!sel.companyId
    && sharedCompanies.some((c) => c.id === sel.companyId);
  const product = sel.materialId
    ? materials.find((m) => m.id === sel.materialId) ?? null : null;

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
    (s: SharedView | null) =>
      persist({ companyId: s?.companyId ?? null, materialId: null }),
    [persist]
  );

  const value: ViewCtx = {
    companyId: sel.companyId, materialId: sel.materialId, setSelection,
    company, product, materials, isShared, productWeights, scopeKeys,
    shared, setShared,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the current global view context (company/product + scope). */
export function useView(): ViewCtx {
  return useContext(Ctx);
}
