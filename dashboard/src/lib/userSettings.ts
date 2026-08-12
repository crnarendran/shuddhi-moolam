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

export interface UserSettings {
  /** Cost-Impact consumption weights (commodityKey -> kg per unit). */
  costImpact?: { weights?: Record<string, number> };
  /** Global + per-report commodity exclusions (SM-31). */
  personalization?: Personalization;
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
