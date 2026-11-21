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
  baseContribution: number | null;
  scenarioContribution: number | null;
  deltaContribution: number | null;
  baseImputed: boolean;
  scenarioImputed: boolean;
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

const RESERVED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'date',
]);

/**
 * Safely checks whether `obj` defines `key` as an own property without
 * walking the prototype chain (safe on null-prototype dictionaries too).
 * @param {object | null | undefined} obj - Object to inspect.
 * @param {string} key - Property key to test.
 * @returns {boolean} True when `key` is an own property on `obj`.
 */
function hasOwn(obj: object | null | undefined, key: string): boolean {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Clamps a numeric value to be non-negative (>= 0).
 * @param {number} value - Input number.
 * @returns {number} Value clamped at zero.
 */
function clampNonNegative(value: number): number {
  return value <= 0 ? 0 : value;
}

/**
 * Normalizes composition ratios, clamping negative or non-finite values
 * to 0 so base totals and per-item rows share the same baseline.
 * @param {Composition[]} comp - Raw material composition (grams per kg).
 * @returns {Composition[]} Normalized composition with ratios >= 0.
 */
function normalizeComposition(comp: Composition[]): Composition[] {
  return comp.map(({ commodityKey, ratio }) => ({
    commodityKey,
    ratio: Number.isFinite(ratio) ? clampNonNegative(ratio) : 0,
  }));
}

/**
 * Reads and normalizes a commodity price from `record`, skipping reserved
 * metadata/prototype keys and inherited properties.
 * @param {PriceRecord | null} record - Price record, or null.
 * @param {string} key - Commodity key to read.
 * @returns {number | null} Normalized price, or null when missing/reserved.
 */
function readPrice(record: PriceRecord | null, key: string): number | null {
  if (!record || RESERVED_KEYS.has(key) || !hasOwn(record, key)) {
    return null;
  }
  return normalizePrice(record[key]);
}

/**
 * Returns a null-prototype PriceRecord containing only safe own commodity
 * fields (clearing `date`) for downstream helpers like `blendedCost`.
 * @param {PriceRecord | null} record - Source price record, or null.
 * @returns {PriceRecord | null} Sanitized price record, or null.
 */
function sanitizePriceRecord(
  record: PriceRecord | null
): PriceRecord | null {
  if (!record) return null;
  const safe = Object.create(null) as PriceRecord;
  safe.date = '';
  for (const key of Object.keys(record)) {
    if (!RESERVED_KEYS.has(key) && hasOwn(record, key)) {
      safe[key] = record[key];
    }
  }
  return safe;
}

/**
 * Computes the effective unit price for one commodity given an optional
 * override. Explicit priceOverride takes precedence over priceDeltaPct and
 * can supply a price for an unpriced commodity; prices clamp at 0 and
 * overflow falls back to basePrice.
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
    const scaled = basePrice * (1 + override.priceDeltaPct / 100);
    return Number.isFinite(scaled) ? clampNonNegative(scaled) : basePrice;
  }
  return basePrice;
}

/**
 * Produces a new composition with overridden gram ratios applied and clamped
 * at 0. Per-row `rowRatios` override `overrides[commodityKey]?.ratio` when
 * specified; non-finite base ratios default to 0.
 * @param {Composition[]} comp - Base material composition (grams per kg).
 * @param {Record<string, ScenarioOverride>} overrides - Keyed overrides.
 * @param {Record<number, number>} rowRatios - Optional per-row gram ratios.
 * @returns {Composition[]} New composition array for scenario calculation.
 */
export function applyScenarioComposition(
  comp: Composition[],
  overrides: Record<string, ScenarioOverride>,
  rowRatios?: Record<number, number>
): Composition[] {
  return comp.map(({ commodityKey, ratio }, idx) => {
    const baseRatio = Number.isFinite(ratio) ? clampNonNegative(ratio) : 0;
    const rowKey = String(idx);
    if (
      rowRatios !== undefined &&
      hasOwn(rowRatios, rowKey) &&
      Number.isFinite(rowRatios[idx])
    ) {
      return { commodityKey, ratio: clampNonNegative(rowRatios[idx]) };
    }
    const ov = hasOwn(overrides, commodityKey)
      ? overrides[commodityKey]
      : undefined;
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
 * prices, while skipping reserved keys (`__proto__`, `constructor`,
 * `prototype`, `date`). Returns null when `latest` is null and no explicit
 * priceOverride supplies a numeric price.
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
    if (RESERVED_KEYS.has(key)) continue;
    const basePrice = readPrice(latest, key);
    const ov = hasOwn(overrides, key) ? overrides[key] : undefined;
    const scenPrice = resolveScenarioPrice(basePrice, ov);
    if (scenPrice !== null) {
      next[key] = scenPrice;
      if (basePrice === null) anyExplicitPrice = true;
    }
  }
  if (!latest && !anyExplicitPrice) return null;
  return next;
}

/**
 * Simulates blended material cost, per-commodity cost contributions (with
 * SM-61 priced-average imputation), and substitution swaps under user
 * overrides. Reuses SM-61 blendedCost (Σ(g × p) ÷ 1000) and totalGrams.
 * @param {Composition[]} comp - Base material composition (grams per kg).
 * @param {PriceRecord | null} latest - Latest market price record, or null.
 * @param {Record<string, ScenarioOverride>} overrides - Per-key overrides.
 * @param {SubstitutionGroup[]} groups - Interchangeable commodity groups.
 * @param {Commodity[]} commodities - Full commodity registry.
 * @param {Record<number, number>} rowRatios - Optional per-row gram ratios.
 * @returns {ScenarioResult} Base vs. simulated totals and item breakdown.
 */
export function simulateScenario(
  comp: Composition[],
  latest: PriceRecord | null,
  overrides: Record<string, ScenarioOverride>,
  groups: SubstitutionGroup[],
  commodities: Commodity[],
  rowRatios?: Record<number, number>
): ScenarioResult {
  const baseComp = normalizeComposition(comp);
  const scenarioComp = applyScenarioComposition(
    baseComp,
    overrides,
    rowRatios
  );
  const scenarioPrices = applyScenarioPrices(latest, baseComp, overrides);
  const safeLatest = sanitizePriceRecord(latest);
  const safeScenarioPrices = sanitizePriceRecord(scenarioPrices);

  const baseGrams = totalGrams(baseComp);
  const scenarioGrams = totalGrams(scenarioComp);

  const rowPrices = baseComp.map((row, idx) => {
    const key = row.commodityKey;
    const basePrice = readPrice(latest, key);
    const ov =
      !RESERVED_KEYS.has(key) && hasOwn(overrides, key)
        ? overrides[key]
        : undefined;
    const scenarioPrice = resolveScenarioPrice(basePrice, ov);
    return {
      key,
      baseItemGrams: row.ratio,
      scenItemGrams: scenarioComp[idx].ratio,
      basePrice,
      scenarioPrice,
    };
  });

  let baseWeighted = 0;
  let basePricedGrams = 0;
  let scenWeighted = 0;
  let scenPricedGrams = 0;
  let anyBasePriced = false;
  let anyScenPriced = false;

  for (const r of rowPrices) {
    if (r.basePrice !== null) {
      anyBasePriced = true;
      baseWeighted += r.baseItemGrams * r.basePrice;
      basePricedGrams += r.baseItemGrams;
    }
    if (r.scenarioPrice !== null) {
      anyScenPriced = true;
      scenWeighted += r.scenItemGrams * r.scenarioPrice;
      scenPricedGrams += r.scenItemGrams;
    }
  }

  const baseAvgPriced =
    basePricedGrams > 0 ? baseWeighted / basePricedGrams : null;
  const scenAvgPriced =
    scenPricedGrams > 0 ? scenWeighted / scenPricedGrams : null;

  let baseCost = blendedCost(baseComp, safeLatest);
  if (
    baseCost === null &&
    baseComp.length > 0 &&
    baseGrams === 0 &&
    anyBasePriced
  ) {
    baseCost = 0;
  }

  let scenarioCost = blendedCost(scenarioComp, safeScenarioPrices);
  if (
    scenarioCost === null &&
    scenarioComp.length > 0 &&
    scenarioGrams === 0 &&
    anyScenPriced
  ) {
    scenarioCost = 0;
  }

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

  const items: ScenarioItemResult[] = rowPrices.map((r) => {
    const baseImputed = r.basePrice === null && baseAvgPriced !== null;
    const effectiveBasePrice =
      r.basePrice !== null ? r.basePrice : baseAvgPriced;
    const scenarioImputed =
      r.scenarioPrice === null && scenAvgPriced !== null;
    const effectiveScenPrice =
      r.scenarioPrice !== null ? r.scenarioPrice : scenAvgPriced;

    const baseContribution =
      effectiveBasePrice !== null
        ? (r.baseItemGrams * effectiveBasePrice) / GRAMS_PER_KG
        : baseCost !== null && r.baseItemGrams === 0
          ? 0
          : null;
    const scenarioContribution =
      effectiveScenPrice !== null
        ? (r.scenItemGrams * effectiveScenPrice) / GRAMS_PER_KG
        : scenarioCost !== null && r.scenItemGrams === 0
          ? 0
          : null;
    const deltaContribution =
      baseContribution !== null && scenarioContribution !== null
        ? scenarioContribution - baseContribution
        : null;

    return {
      key: r.key,
      baseGrams: r.baseItemGrams,
      scenarioGrams: r.scenItemGrams,
      basePrice: r.basePrice,
      scenarioPrice: r.scenarioPrice,
      baseContribution,
      scenarioContribution,
      deltaContribution,
      baseImputed,
      scenarioImputed,
    };
  });

  const scenarioSwaps = substitutionSuggestions(
    scenarioComp,
    groups,
    commodities,
    safeScenarioPrices
  );

  const itemChanged = items.some(
    (it) =>
      it.scenarioGrams !== it.baseGrams ||
      it.scenarioPrice !== it.basePrice
  );
  const extraPriceChanged = Object.keys(overrides).some((key) => {
    if (RESERVED_KEYS.has(key)) return false;
    const basePrice = readPrice(latest, key);
    const ov = hasOwn(overrides, key) ? overrides[key] : undefined;
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
