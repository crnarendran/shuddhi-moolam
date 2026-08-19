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
  /** Product selection remembered PER company, so switching companies keeps
   *  each one's picked products (SM-60). */
  byCompany: Record<string, string[]>;
}

interface ViewCtx {
  /** Global selection (SM-60): the active company (own or shared) and the
   *  product(s) picked for it. null companyId = My workspace. */
  companyId: string | null;
  /** Products selected for the active company (empty for My workspace). */
  materialIds: string[];
  /** Switch the active company; restores that company's remembered products. */
  setCompany: (companyId: string | null) => void;
  /** Set the products for the active company. */
  setProducts: (materialIds: string[]) => void;
  company: Company | null;
  /** First selected material — the product single-product reports use. */
  product: Material | null;
  /** All selected materials — Guidance compares these. */
  products: Material[];
  /** Materials of the selected company (for the picker + Guidance). */
  materials: Material[];
  isShared: boolean;
  /** BOM-derived Cost-Impact weights for the primary product, else null. */
  productWeights: Record<string, number> | null;
  /** Commodity scope: selected products' recipes → the company's union →
   *  null (My workspace = all). */
  scopeKeys: string[] | null;
  /** Back-compat: the shared company as a SharedView; null otherwise. */
  shared: SharedView | null;
  setShared: (s: SharedView | null) => void;
}

const Ctx = createContext<ViewCtx>({
  companyId: null, materialIds: [], setCompany: () => {},
  setProducts: () => {}, company: null, product: null, products: [],
  materials: [], isShared: false, productWeights: null, scopeKeys: null,
  shared: null, setShared: () => {},
});

const SEL_KEY = 'sm.viewSelection';
const LEGACY_SHARED_KEY = 'sm.sharedView';

/** Loads the persisted selection, tolerating the legacy shared-view key and
 *  the earlier {companyId, materialId(s)} shape. */
function loadSelection(): Selection {
  try {
    const raw = localStorage.getItem(SEL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as {
        companyId?: string | null;
        byCompany?: Record<string, string[]>;
        materialIds?: string[];
        materialId?: string;
      };
      if (p.byCompany && typeof p.byCompany === 'object') {
        return { companyId: p.companyId ?? null, byCompany: p.byCompany };
      }
      const ids = Array.isArray(p.materialIds)
        ? p.materialIds : p.materialId ? [p.materialId] : [];
      const byCompany: Record<string, string[]> = {};
      if (p.companyId && ids.length) byCompany[p.companyId] = ids;
      return { companyId: p.companyId ?? null, byCompany };
    }
    const legacy = localStorage.getItem(LEGACY_SHARED_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as SharedView;
      return { companyId: s.companyId ?? null, byCompany: {} };
    }
  } catch { /* ignore */ }
  return { companyId: null, byCompany: {} };
}

/**
 * Provides the global Company·Product view context (SM-60). One selection —
 * an optional company (own or shared) and the product(s) within it — drives
 * every report: `scopeKeys` filters commodities and `productWeights` feeds
 * Cost Impact. The product selection is remembered per company, and the
 * header control is single-select on most reports, multi-select on Guidance.
 * `shared` stays a derived, back-compatible value so the read-only shared
 * flow is unchanged.
 * @param props Children to render within the provider.
 */
export function ViewProvider({ children }: { children: ReactNode }) {
  const { companies, shared: sharedCompanies } = useCompanies();
  const [sel, setSel] = useState<Selection>(loadSelection);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Persist the whole selection whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(SEL_KEY, JSON.stringify(sel));
    } catch { /* ignore storage failures (private mode etc.) */ }
  }, [sel]);

  const setCompany = useCallback((companyId: string | null) => {
    setSel((prev) => ({ ...prev, companyId }));
  }, []);

  const setProducts = useCallback((materialIds: string[]) => {
    setSel((prev) => prev.companyId
      ? {
        companyId: prev.companyId,
        byCompany: { ...prev.byCompany, [prev.companyId]: materialIds },
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
  // My workspace, once companies have actually loaded. Its remembered products
  // are kept in byCompany in case it reappears.
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

  const materialIds = sel.companyId
    ? sel.byCompany[sel.companyId] ?? [] : [];

  const company = sel.companyId
    ? allCompanies.get(sel.companyId) ?? null : null;
  const isShared = !!sel.companyId
    && sharedCompanies.some((c) => c.id === sel.companyId);

  const products = useMemo(
    () => materialIds
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is Material => !!m),
    [materialIds, materials]
  );
  const product = products[0] ?? null;

  const productWeights = useMemo(
    () => product ? costImpactWeights(product.composition) : null,
    [product]
  );

  const scopeKeys = useMemo<string[] | null>(() => {
    if (products.length > 0) {
      const keys = new Set<string>();
      products.forEach((p) =>
        p.composition.forEach((c) => keys.add(c.commodityKey)));
      return [...keys];
    }
    if (sel.companyId) {
      const keys = new Set<string>();
      materials.forEach((m) =>
        (m.composition || []).forEach((c) => keys.add(c.commodityKey)));
      return [...keys];
    }
    return null;
  }, [products, sel.companyId, materials]);

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
    companyId: sel.companyId, materialIds, setCompany, setProducts,
    company, product, products, materials, isShared, productWeights,
    scopeKeys, shared, setShared,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the current global view context (company/product + scope). */
export function useView(): ViewCtx {
  return useContext(Ctx);
}
