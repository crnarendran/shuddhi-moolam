// Per-user settings stored in Firestore `user_settings/{uid}` (SM-30).
// Replaces browser localStorage so settings sync across devices and stay
// private to the signed-in account. The shape grows across the
// personalization/guidance epic (SM-31+); this module holds the types,
// defaults, and the pure helpers (unit-tested) used by the hook.

/** Reports whose commodity set can be personalized (SM-31). */
export type ReportId = 'price-review' | 'seasonal' | 'cost-impact' | 'spreads';

/**
 * Two-level opt-out cascade: `globalExcluded` hides a commodity from every
 * report; a report's `excluded` hides more, only within that report. A
 * commodity is visible in report R iff NOT globally excluded AND NOT
 * excluded in R — a report can never re-show a globally-hidden commodity.
 */
export interface Personalization {
  globalExcluded: string[];
  reports: Partial<Record<ReportId, { excluded: string[] }>>;
}

/**
 * Persisted per-report UI selections (SM-39) so each report reopens where
 * the user left it, across devices. Each slice is optional and written whole
 * by its report.
 */
export interface ViewState {
  priceReview?: { threshold?: number };
  seasonal?: { keys?: string[]; metric?: string };
  spreads?: { reference?: string; compare?: string[] };
  guidance?: { companyId?: string; materialIds?: string[] };
  // Cost-Impact company + single material selection (SM-58). When a material
  // is chosen, weights derive from its BOM; empty materialId = Custom weights.
  costImpactSel?: { companyId?: string; materialId?: string };
}

export interface UserSettings {
  /** Cost-Impact consumption weights (commodityKey -> kg per unit). */
  costImpact?: { weights?: Record<string, number> };
  /** Global Company·Product selector: products picked per company (SM-60),
   *  synced cross-device. `single` = single-select reports, `multi` =
   *  Guidance; kept separate so switching report types doesn't reset either.
   *  `byCompany` is the earlier combined shape, read for migration only.
   *  localStorage is the per-device fallback. */
  productSelection?: {
    single?: Record<string, string>;
    multi?: Record<string, string[]>;
    byCompany?: Record<string, string[]>;
  };
  /** Global + per-report commodity exclusions (SM-31). */
  personalization?: Personalization;
  /**
   * Persisted per-report UI selections (SM-39), namespaced by view context
   * (SM-52): `viewState[contextId][report]`, where `contextId` is 'own' for
   * the user's workspace or a companyId for a shared company. Each context
   * keeps its own selections, so switching companies retains them.
   */
  viewState?: Record<string, ViewState>;
  /** Last write time (ms epoch), set on every update. */
  updatedAt?: number;
}

export const DEFAULT_SETTINGS: UserSettings = {};

/**
 * Merges a patch into the current settings, one level deep for known
 * nested objects (so a partial `costImpact` patch doesn't drop sibling
 * keys). Mirrors Firestore's `{ merge: true }` for the optimistic copy.
 * @param {UserSettings} current - The current settings.
 * @param {Partial<UserSettings>} patch - The patch to apply.
 * @returns {UserSettings} The merged settings.
 */
export function mergeSettings(
  current: UserSettings,
  patch: Partial<UserSettings>
): UserSettings {
  const merged: UserSettings = { ...current, ...patch };
  if (patch.costImpact) {
    merged.costImpact = { ...current.costImpact, ...patch.costImpact };
  }
  if (patch.viewState) {
    // Deep-merge three levels (context -> report -> slice) so a patch to one
    // report's slice in one context keeps every other context, that context's
    // other reports, and that report's untouched fields.
    const next: Record<string, ViewState> = { ...current.viewState };
    Object.keys(patch.viewState).forEach((ctx) => {
      const curCtx = current.viewState?.[ctx] ?? {};
      const patchCtx = patch.viewState![ctx];
      const nextCtx: ViewState = { ...curCtx };
      (Object.keys(patchCtx) as (keyof ViewState)[]).forEach((k) => {
        nextCtx[k] = { ...curCtx[k], ...patchCtx[k] };
      });
      next[ctx] = nextCtx;
    });
    merged.viewState = next;
  }
  // Firestore rejects writes containing `undefined` field values, so drop
  // any key that ended up undefined (e.g. costImpact on a first-time write).
  (Object.keys(merged) as (keyof UserSettings)[]).forEach((k) => {
    if (merged[k] === undefined) delete merged[k];
  });
  return merged;
}

/**
 * True when there are local (browser) weights worth migrating and the
 * account has none stored yet. Used for the one-off localStorage ->
 * Firestore migration; a fresh user with only defaults does not migrate.
 * @param {UserSettings} settings - The account's current settings.
 * @param {Record<string, number> | null} localWeights - Parsed localStorage
 *   weights, or null when none were ever saved.
 * @returns {boolean} Whether to migrate.
 */
export function shouldMigrateWeights(
  settings: UserSettings,
  localWeights: Record<string, number> | null
): boolean {
  const stored = settings.costImpact?.weights;
  const hasStored = !!stored && Object.keys(stored).length > 0;
  const hasLocal = !!localWeights && Object.keys(localWeights).length > 0;
  return !hasStored && hasLocal;
}

/**
 * Applies the exclusion cascade: returns the keys visible in `reportId`,
 * i.e. those not globally excluded and not excluded in that report. Pure
 * (takes the full key list) so it is unit-tested without the registry.
 * @param {string[]} allKeys - All candidate commodity keys, in order.
 * @param {ReportId} reportId - The report being filtered.
 * @param {Personalization | undefined} p - The user's personalization.
 * @returns {string[]} The visible keys for that report, order preserved.
 */
export function effectiveKeys(
  allKeys: string[],
  reportId: ReportId,
  p: Personalization | undefined
): string[] {
  const global = new Set(p?.globalExcluded ?? []);
  const reportEx = new Set(p?.reports?.[reportId]?.excluded ?? []);
  return allKeys.filter((k) => !global.has(k) && !reportEx.has(k));
}

/** Keys globally allowed (not in `globalExcluded`) — the report-level pool. */
export function globallyAllowedKeys(
  allKeys: string[],
  p: Personalization | undefined
): string[] {
  const global = new Set(p?.globalExcluded ?? []);
  return allKeys.filter((k) => !global.has(k));
}
