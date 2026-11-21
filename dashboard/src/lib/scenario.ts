// Pure scenario / what-if simulation engine for Guidance (SM-67). All math
// reuses SM-61 blendedCost (Σ(g × p) ÷ 1000) and substitutionSuggestions so
// simulated numbers agree with the rest of the dashboard.

import {
  blendedCost,
  totalGrams,
  GRAMS_PER_KG,
  type Composition,
} from './materials';
import {
  substitutionSuggestions,
  type SubstitutionGroup,
  type SwapSuggestion,
} from './guidance';
import {
  normalizePrice,
  type Commodity,
  type PriceRecord,
} from './reporting';

export interface ScenarioOverride {
  ratio?: number;
  priceDeltaPct?: number;
  priceOverride?: number;
}

export interface ScenarioItemResult {
  key: string;
  baseGrams: number;
  scenarioGrams: number;
  basePrice: number | null;
  scenarioPrice: number | null;
  baseContribution: number;
  scenarioContribution: number;
  deltaContribution: number;
}

export interface ScenarioResult {
  baseCost: number | null;
  scenarioCost: number | null;
  delta: number | null;
  deltaPct: number | null;
  baseGrams: number;
  scenarioGrams: number;
  items: ScenarioItemResult[];
  scenarioSwaps: SwapSuggestion[];
  hasChanges: boolean;
}

/**
 * Clamps a numeric value to be non-negative (>= 0).
 * @param {number} value - Input number.
 * @returns {number} Value clamped at zero.
 */
function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

/**
 * Computes the effective unit price for one commodity given an optional
 * override. Explicit priceOverride takes precedence over priceDeltaPct and
 * can supply a price for an unpriced commodity; prices clamp at 0.
 * @param {number | null} basePrice - Current normalized price, or null.
 * @param {ScenarioOverride | undefined} override - User scenario override.
 * @returns {number | null} Effective scenario price, or null if unpriced.
 */
function resolveScenarioPrice(
  basePrice: number | null,
  override?: ScenarioOverride
): number | null {
  if (
    override?.priceOverride !== undefined &&
    Number.isFinite(override.priceOverride)
  ) {
    return clampNonNegative(override.priceOverride);
  }
  if (basePrice === null) return null;
  if (
    override?.priceDeltaPct !== undefined &&
    Number.isFinite(override.priceDeltaPct)
  ) {
    return clampNonNegative(
      basePrice * (1 + override.priceDeltaPct / 100)
    );
  }
  return basePrice;
}

/**
 * Produces a new composition with overridden gram ratios applied and clamped
 * at 0. Non-finite base ratios default to 0.
 * @param {Composition[]} comp - Base material composition (grams per kg).
 * @param {Record<string, ScenarioOverride>} overrides - Keyed overrides.
 * @returns {Composition[]} New composition array for scenario calculation.
 */
export function applyScenarioComposition(
  comp: Composition[],
  overrides: Record<string, ScenarioOverride>
): Composition[] {
  return comp.map(({ commodityKey, ratio }) => {
    const baseRatio = Number.isFinite(ratio) ? clampNonNegative(ratio) : 0;
    const ov = overrides[commodityKey];
    const nextRatio =
      ov?.ratio !== undefined && Number.isFinite(ov.ratio)
        ? clampNonNegative(ov.ratio)
        : baseRatio;
    return { commodityKey, ratio: nextRatio };
  });
}

/**
 * Produces a cloned PriceRecord with scenario prices applied across
 * composition commodities and any overridden keys. Preserves unedited keys
 * from `latest` so substitution groups still evaluate against full market
 * prices. Returns null when `latest` is null and no explicit priceOverride
 * supplies a numeric price.
 * @param {PriceRecord | null} latest - Latest price record, or null.
 * @param {Composition[]} comp - Base material composition.
 * @param {Record<string, ScenarioOverride>} overrides - Keyed overrides.
 * @returns {PriceRecord | null} Simulated price record, or null.
 */
export function applyScenarioPrices(
  latest: PriceRecord | null,
  comp: Composition[],
  overrides: Record<string, ScenarioOverride>
): PriceRecord | null {
  const keys = new Set<string>([
    ...comp.map((c) => c.commodityKey),
    ...Object.keys(overrides),
  ]);
  const next: PriceRecord = latest ? { ...latest } : { date: '' };
  let anyExplicitPrice = false;
  for (const key of keys) {
    const basePrice = latest ? normalizePrice(latest[key]) : null;
    const scenPrice = resolveScenarioPrice(basePrice, overrides[key]);
    if (scenPrice !== null) {
      next[key] = scenPrice;
      if (basePrice === null) anyExplicitPrice = true;
    }
  }
  if (!latest && !anyExplicitPrice) return null;
  return next;
}

/**
 * Simulates blended material cost, per-commodity cost contributions, and
 * substitution swaps under user-entered gram ratios and price overrides.
 * Reuses SM-61 blendedCost (Σ(g × p) ÷ 1000) and totalGrams.
 * @param {Composition[]} comp - Base material composition (grams per kg).
 * @param {PriceRecord | null} latest - Latest market price record, or null.
 * @param {Record<string, ScenarioOverride>} overrides - Per-key overrides.
 * @param {SubstitutionGroup[]} groups - Interchangeable commodity groups.
 * @param {Commodity[]} commodities - Full commodity registry.
 * @returns {ScenarioResult} Base vs. simulated totals and item breakdown.
 */
export function simulateScenario(
  comp: Composition[],
  latest: PriceRecord | null,
  overrides: Record<string, ScenarioOverride>,
  groups: SubstitutionGroup[],
  commodities: Commodity[]
): ScenarioResult {
  const scenarioComp = applyScenarioComposition(comp, overrides);
  const scenarioPrices = applyScenarioPrices(latest, comp, overrides);

  const baseCost = blendedCost(comp, latest);
  const scenarioCost = blendedCost(scenarioComp, scenarioPrices);
  const delta =
    baseCost !== null && scenarioCost !== null
      ? scenarioCost - baseCost
      : null;
  const deltaPct =
    delta !== null && baseCost !== null
      ? baseCost > 0
        ? (delta / baseCost) * 100
        : delta === 0
          ? 0
          : null
      : null;

  const baseGrams = totalGrams(comp);
  const scenarioGrams = totalGrams(scenarioComp);

  const items: ScenarioItemResult[] = comp.map((row, idx) => {
    const key = row.commodityKey;
    const baseItemGrams = Number.isFinite(row.ratio)
      ? clampNonNegative(row.ratio)
      : 0;
    const scenItemGrams = scenarioComp[idx].ratio;
    const basePrice = latest ? normalizePrice(latest[key]) : null;
    const scenarioPrice = resolveScenarioPrice(basePrice, overrides[key]);
    const baseContribution =
      basePrice !== null ? (baseItemGrams * basePrice) / GRAMS_PER_KG : 0;
    const scenarioContribution =
      scenarioPrice !== null
        ? (scenItemGrams * scenarioPrice) / GRAMS_PER_KG
        : 0;
    return {
      key,
      baseGrams: baseItemGrams,
      scenarioGrams: scenItemGrams,
      basePrice,
      scenarioPrice,
      baseContribution,
      scenarioContribution,
      deltaContribution: scenarioContribution - baseContribution,
    };
  });

  const scenarioSwaps = substitutionSuggestions(
    scenarioComp,
    groups,
    commodities,
    scenarioPrices
  );

  const itemChanged = items.some(
    (it) =>
      it.scenarioGrams !== it.baseGrams ||
      it.scenarioPrice !== it.basePrice
  );
  const extraPriceChanged = Object.entries(overrides).some(([key, ov]) => {
    const basePrice = latest ? normalizePrice(latest[key]) : null;
    return resolveScenarioPrice(basePrice, ov) !== basePrice;
  });

  return {
    baseCost,
    scenarioCost,
    delta,
    deltaPct,
    baseGrams,
    scenarioGrams,
    items,
    scenarioSwaps,
    hasChanges: itemChanged || extraPriceChanged,
  };
}
