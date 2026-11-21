import { useMemo, useState } from 'react';
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
 */
export function WhatIfSimulator({ material, latest, commodities }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<
    Record<string, ScenarioOverride>
  >({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [trackedId, setTrackedId] = useState(material.id);

  if (trackedId !== material.id) {
    setTrackedId(material.id);
    setOverrides({});
    setDrafts({});
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
        commodities
      ),
    [material.composition, latest, overrides, commodities]
  );

  const updateOverride = (
    key: string,
    patch: Partial<ScenarioOverride>
  ) => {
    setOverrides((prev) => {
      const nextEntry = { ...prev[key], ...patch };
      if (nextEntry.ratio === undefined) delete nextEntry.ratio;
      if (nextEntry.priceDeltaPct === undefined) {
        delete nextEntry.priceDeltaPct;
      }
      if (nextEntry.priceOverride === undefined) {
        delete nextEntry.priceOverride;
      }
      const next = { ...prev };
      if (Object.keys(nextEntry).length === 0) {
        delete next[key];
      } else {
        next[key] = nextEntry;
      }
      return next;
    });
  };

  const handleGramsChange = (
    key: string,
    raw: string,
    baseGrams: number
  ) => {
    setDrafts((prev) => ({ ...prev, [`g:${key}`]: raw }));
    if (raw.trim() === '') {
      updateOverride(key, { ratio: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0, parsed);
    updateOverride(key, {
      ratio: clamped === baseGrams ? undefined : clamped,
    });
  };

  const handlePctChange = (key: string, raw: string) => {
    setDrafts((prev) => ({ ...prev, [`p:${key}`]: raw }));
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
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const handleReset = () => {
    setOverrides({});
    setDrafts({});
  };

  const hasDelta = result.hasChanges && result.delta !== null;

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
          <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
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
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          )}
        </button>

        {result.hasChanges && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800
              dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center
              gap-1 px-2 py-1 rounded border border-zinc-200
              dark:border-zinc-700 hover:bg-zinc-100
              dark:hover:bg-zinc-700/60 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
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
                  <th className="py-2 px-3 font-medium">Commodity</th>
                  <th className="py-2 px-2 font-medium text-right">
                    Grams / kg
                  </th>
                  <th className="py-2 px-2 font-medium text-right">
                    Price move %
                  </th>
                  <th className="py-2 px-3 font-medium text-right">
                    Unit price
                  </th>
                  <th className="py-2 px-3 font-medium text-right">
                    Contribution
                  </th>
                  <th className="py-2 px-3 font-medium text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200
                dark:divide-zinc-700">
                {result.items.map((item, idx) => {
                  const label = labelByKey.get(item.key) ?? item.key;
                  const ov = overrides[item.key];
                  const gramDraft = drafts[`g:${item.key}`];
                  const pctDraft = drafts[`p:${item.key}`];
                  const gramValue =
                    gramDraft !== undefined
                      ? gramDraft
                      : String(ov?.ratio ?? item.baseGrams);
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
                              item.key,
                              e.target.value,
                              item.baseGrams
                            )
                          }
                          onBlur={() => clearDraft(`g:${item.key}`)}
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step={1}
                          placeholder="0"
                          disabled={item.basePrice === null}
                          aria-label={`${label} price move percent`}
                          className={numInputCls}
                          value={pctValue}
                          onChange={(e) =>
                            handlePctChange(item.key, e.target.value)
                          }
                          onBlur={() => clearDraft(`p:${item.key}`)}
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
                        ₹{fmt(item.scenarioContribution, 2)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right whitespace-nowrap
                          font-medium ${deltaTone(item.deltaContribution)}`}
                      >
                        {Math.abs(item.deltaContribution) < 1e-9
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
                {result.scenarioSwaps.map((s) => (
                  <li key={s.from.key} className="flex items-start gap-2">
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
