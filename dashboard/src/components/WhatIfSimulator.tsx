import { type ReactElement, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { DEFAULT_SUB_GROUPS } from '../lib/guidance';
import { type Material } from '../lib/materials';
import { type Commodity, type PriceRecord } from '../lib/reporting';
import {
  simulateScenario,
  type ScenarioOverride,
} from '../lib/scenario';
import { fmtNum as fmt } from '../lib/format';

interface Props {
  material: Material;
  latest: PriceRecord | null;
  commodities: Commodity[];
}

/**
 * Creates a null-prototype dictionary so keys like `__proto__`,
 * `toString`, and `constructor` cannot collide with Object.prototype.
 * @returns {T} Empty null-prototype dictionary.
 */
function emptyDict<T>(): T {
  return Object.create(null) as T;
}

/**
 * Safely checks whether `obj` defines `key` as an own property without
 * walking the prototype chain.
 * @param {object} obj - Dictionary object to inspect.
 * @param {string} key - Property key to test.
 * @returns {boolean} True when `key` is an own property on `obj`.
 */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Formats a signed currency or quantity delta with Unicode minus for drops.
 * @param {number | null} value - Delta value, or null when unavailable.
 * @param {number} digits - Maximum decimal places.
 * @returns {string} Signed formatted string, or '—' for null.
 */
function formatSigned(value: number | null, digits = 2): string {
  if (value === null) return '—';
  if (value === 0) return fmt(0, digits);
  const sign = value > 0 ? '+' : '−';
  return `${sign}${fmt(Math.abs(value), digits)}`;
}

/**
 * Returns text color class for a cost delta (green for savings, red for cost
 * increase, muted neutral for zero/null).
 * @param {number | null} delta - Cost delta per kg.
 * @returns {string} Tailwind text color classes.
 */
function deltaTone(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1e-9) {
    return 'text-zinc-500 dark:text-zinc-400';
  }
  return delta > 0
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400';
}

const numInputCls =
  'w-20 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 ' +
  'dark:border-zinc-700 rounded-md py-1 px-2 text-right text-sm ' +
  'text-zinc-900 dark:text-zinc-100 focus:outline-none ' +
  'focus:ring-1 focus:ring-blue-500 disabled:opacity-50';

/**
 * Collapsible interactive what-if simulator embedded in each Guidance card.
 * Lets buyers tweak BOM gram ratios and commodity price moves (%) without
 * persisting changes to Firestore.
 * @param {Props} props - Material recipe, latest price record, commodity list.
 * @returns {ReactElement} Collapsible what-if simulator panel.
 */
export function WhatIfSimulator({
  material,
  latest,
  commodities,
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<
    Record<string, ScenarioOverride>
  >(emptyDict);
  const [rowRatios, setRowRatios] = useState<Record<number, number>>(
    emptyDict
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(emptyDict);
  const [trackedId, setTrackedId] = useState(material.id);

  if (trackedId !== material.id) {
    setTrackedId(material.id);
    setOverrides(emptyDict());
    setRowRatios(emptyDict());
    setDrafts(emptyDict());
  }

  const labelByKey = useMemo(
    () => new Map(commodities.map((c) => [c.key, c.label])),
    [commodities]
  );

  const result = useMemo(
    () =>
      simulateScenario(
        material.composition,
        latest,
        overrides,
        DEFAULT_SUB_GROUPS,
        commodities,
        rowRatios
      ),
    [material.composition, latest, overrides, commodities, rowRatios]
  );

  const updateOverride = (
    key: string,
    patch: Partial<ScenarioOverride>
  ) => {
    setOverrides((prev) => {
      const existing = hasOwn(prev, key) ? prev[key] : undefined;
      const nextEntry: ScenarioOverride = { ...existing, ...patch };
      if (nextEntry.ratio === undefined) delete nextEntry.ratio;
      if (nextEntry.priceDeltaPct === undefined) {
        delete nextEntry.priceDeltaPct;
      }
      if (nextEntry.priceOverride === undefined) {
        delete nextEntry.priceOverride;
      }
      const next = Object.assign(
        emptyDict<Record<string, ScenarioOverride>>(),
        prev
      );
      if (Object.keys(nextEntry).length === 0) {
        delete next[key];
      } else {
        next[key] = nextEntry;
      }
      return next;
    });
  };

  const handleGramsChange = (
    idx: number,
    raw: string,
    baseGrams: number
  ) => {
    const draftKey = `g:${idx}`;
    setDrafts((prev) => {
      const next = Object.assign(
        emptyDict<Record<string, string>>(),
        prev
      );
      next[draftKey] = raw;
      return next;
    });
    if (raw.trim() === '') {
      setRowRatios((prev) => {
        if (!hasOwn(prev, String(idx))) return prev;
        const next = Object.assign(
          emptyDict<Record<number, number>>(),
          prev
        );
        delete next[idx];
        return next;
      });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0, parsed);
    setRowRatios((prev) => {
      if (clamped === baseGrams) {
        if (!hasOwn(prev, String(idx))) return prev;
        const next = Object.assign(
          emptyDict<Record<number, number>>(),
          prev
        );
        delete next[idx];
        return next;
      }
      const next = Object.assign(emptyDict<Record<number, number>>(), prev);
      next[idx] = clamped;
      return next;
    });
  };

  const handlePctChange = (idx: number, key: string, raw: string) => {
    const draftKey = `p:${idx}`;
    setDrafts((prev) => {
      const next = Object.assign(
        emptyDict<Record<string, string>>(),
        prev
      );
      next[draftKey] = raw;
      return next;
    });
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') {
      updateOverride(key, { priceDeltaPct: undefined });
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    updateOverride(key, {
      priceDeltaPct: parsed === 0 ? undefined : parsed,
    });
  };

  const clearDraft = (draftKey: string) => {
    setDrafts((prev) => {
      if (!hasOwn(prev, draftKey)) return prev;
      const next = Object.assign(emptyDict<Record<string, string>>(), prev);
      delete next[draftKey];
      return next;
    });
  };

  const handleReset = () => {
    setOverrides(emptyDict());
    setRowRatios(emptyDict());
    setDrafts(emptyDict());
  };

  const hasDelta = result.hasChanges && result.delta !== null;
  const canReset =
    result.hasChanges ||
    Object.keys(overrides).length > 0 ||
    Object.keys(rowRatios).length > 0;

  return (
    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="text-sm font-medium text-zinc-700 dark:text-zinc-200
            flex items-center gap-2 hover:text-zinc-900
            dark:hover:text-white transition-colors"
        >
          <SlidersHorizontal
            className="h-4 w-4 text-zinc-500"
            aria-hidden="true"
          />
          <span>What-if scenario</span>
          {hasDelta && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full
                bg-zinc-100 dark:bg-zinc-700/70 ${deltaTone(result.delta)}`}
            >
              {formatSigned(result.delta, 2)} / kg
              {result.deltaPct !== null &&
                ` (${formatSigned(result.deltaPct, 1)}%)`}
            </span>
          )}
          {open ? (
            <ChevronDown
              className="h-4 w-4 text-zinc-400"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="h-4 w-4 text-zinc-400"
              aria-hidden="true"
            />
          )}
        </button>

        {canReset && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800
              dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center
              gap-1 px-2 py-1 rounded border border-zinc-200
              dark:border-zinc-700 hover:bg-zinc-100
              dark:hover:bg-zinc-700/60 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Base cost / kg
              </p>
              <p className="text-base font-semibold text-zinc-900
                dark:text-zinc-100 mt-0.5">
                {fmt(result.baseCost)}
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Simulated cost / kg
              </p>
              <p className="text-base font-semibold text-zinc-900
                dark:text-zinc-100 mt-0.5">
                {fmt(result.scenarioCost)}
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Impact
              </p>
              <p className={`text-base font-semibold mt-0.5
                ${deltaTone(result.delta)}`}>
                {result.delta === null ? (
                  '—'
                ) : (
                  <>
                    {formatSigned(result.delta, 2)}
                    {result.deltaPct !== null && (
                      <span className="text-xs font-medium ml-1">
                        ({formatSigned(result.deltaPct, 1)}%)
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Recipe mass
              </p>
              <p className="text-base font-semibold text-zinc-900
                dark:text-zinc-100 mt-0.5">
                {fmt(result.baseGrams, 0)} g →{' '}
                {fmt(result.scenarioGrams, 0)} g
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-zinc-200
            dark:border-zinc-700 rounded-md">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/60 text-left
                  text-[11px] uppercase tracking-wide text-zinc-500
                  dark:text-zinc-400 border-b border-zinc-200
                  dark:border-zinc-700">
                  <th scope="col" className="py-2 px-3 font-medium">
                    Commodity
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-2 font-medium text-right"
                  >
                    Grams / kg
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-2 font-medium text-right"
                  >
                    Price move %
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 font-medium text-right"
                  >
                    Unit price
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 font-medium text-right"
                  >
                    Contribution
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 font-medium text-right"
                  >
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200
                dark:divide-zinc-700">
                {result.items.map((item, idx) => {
                  const label = labelByKey.get(item.key) ?? item.key;
                  const ov = hasOwn(overrides, item.key)
                    ? overrides[item.key]
                    : undefined;
                  const rowRatio = hasOwn(rowRatios, String(idx))
                    ? rowRatios[idx]
                    : undefined;
                  const gramDraftKey = `g:${idx}`;
                  const pctDraftKey = `p:${idx}`;
                  const gramDraft = hasOwn(drafts, gramDraftKey)
                    ? drafts[gramDraftKey]
                    : undefined;
                  const pctDraft = hasOwn(drafts, pctDraftKey)
                    ? drafts[pctDraftKey]
                    : undefined;
                  const gramValue =
                    gramDraft !== undefined
                      ? gramDraft
                      : String(rowRatio ?? ov?.ratio ?? item.baseGrams);
                  const pctValue =
                    pctDraft !== undefined
                      ? pctDraft
                      : ov?.priceDeltaPct !== undefined
                        ? String(ov.priceDeltaPct)
                        : '';
                  const priceChanged =
                    item.basePrice !== null &&
                    item.scenarioPrice !== null &&
                    item.scenarioPrice !== item.basePrice;

                  return (
                    <tr
                      key={`${item.key}-${idx}`}
                      className="text-zinc-800 dark:text-zinc-200"
                    >
                      <td className="py-2 px-3 font-medium">{label}</td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          aria-label={`${label} grams per kg`}
                          className={numInputCls}
                          value={gramValue}
                          onChange={(e) =>
                            handleGramsChange(
                              idx,
                              e.target.value,
                              item.baseGrams
                            )
                          }
                          onBlur={() => clearDraft(gramDraftKey)}
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step={1}
                          placeholder="0"
                          disabled={
                            item.basePrice === null || item.basePrice === 0
                          }
                          aria-label={`${label} price move percent`}
                          className={numInputCls}
                          value={pctValue}
                          onChange={(e) =>
                            handlePctChange(idx, item.key, e.target.value)
                          }
                          onBlur={() => clearDraft(pctDraftKey)}
                        />
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap
                        text-xs text-zinc-600 dark:text-zinc-300">
                        {item.basePrice === null ? (
                          '—'
                        ) : priceChanged ? (
                          <span>
                            ₹{fmt(item.basePrice)} →{' '}
                            <span className="font-semibold text-zinc-900
                              dark:text-zinc-100">
                              ₹{fmt(item.scenarioPrice)}
                            </span>
                          </span>
                        ) : (
                          <span>₹{fmt(item.basePrice)}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {item.scenarioContribution === null ? (
                          '—'
                        ) : (
                          <span>
                            ₹{fmt(item.scenarioContribution, 2)}
                            {item.scenarioImputed && (
                              <span
                                className="ml-1 text-[10px] text-zinc-400
                                  dark:text-zinc-500"
                                title="Imputed from priced average"
                              >
                                (est)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2 px-3 text-right whitespace-nowrap
                          font-medium ${deltaTone(item.deltaContribution)}`}
                      >
                        {item.deltaContribution === null ||
                        Math.abs(item.deltaContribution) < 1e-9
                          ? '—'
                          : formatSigned(item.deltaContribution, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result.hasChanges && result.scenarioSwaps.length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded-md p-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide
                text-zinc-500 dark:text-zinc-400 mb-1.5">
                Simulated cheaper alternatives
              </h5>
              <ul className="text-sm text-zinc-700 dark:text-zinc-300
                space-y-1">
                {result.scenarioSwaps.map((s, idx) => (
                  <li
                    key={`${s.from.key}-${s.to.key}-${idx}`}
                    className="flex items-start gap-2"
                  >
                    <span className="text-green-600 dark:text-green-400
                      font-semibold">
                      −{fmt(s.saving)}
                    </span>
                    <span>
                      Swap <span className="font-medium">{s.from.label}</span>
                      {' → '}
                      <span className="font-medium">{s.to.label}</span>{' '}
                      <span className="text-xs text-zinc-400">
                        ({s.groupName}, saving / kg)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-zinc-400">
            Simulation only — changes here do not modify your saved recipe.
          </p>
        </div>
      )}
    </div>
  );
}
