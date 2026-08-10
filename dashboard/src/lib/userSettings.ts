// Per-user settings stored in Firestore `user_settings/{uid}` (SM-30).
// Replaces browser localStorage so settings sync across devices and stay
// private to the signed-in account. The shape grows across the
// personalization/guidance epic (SM-31+); this module holds the types,
// defaults, and the pure helpers (unit-tested) used by the hook.

export interface UserSettings {
  /** Cost-Impact consumption weights (commodityKey -> kg per unit). */
  costImpact?: { weights?: Record<string, number> };
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
  return {
    ...current,
    ...patch,
    costImpact: patch.costImpact
      ? { ...current.costImpact, ...patch.costImpact }
      : current.costImpact,
  };
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
