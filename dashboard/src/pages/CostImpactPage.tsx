import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  COMMODITIES,
  ALL_COMMODITIES,
  costImpact,
  commoditiesForView,
  quarterKeyLabel,
  type Commodity,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import { useView } from '../context/ViewContext';
import { useCompanies, useMaterials } from '../hooks/useCompanies';
import { useViewState } from '../hooks/useViewState';
import { costImpactWeights, type Company } from '../lib/materials';
import { shouldMigrateWeights } from '../lib/userSettings';
import { ReportIntro } from '../components/ReportIntro';
import { InfoTip } from '../components/InfoTip';
import { PrintButton } from '../components/PrintButton';
import { REPORT_HELP } from '../lib/help';
import { fmtNum as fmt } from '../lib/format';

const STORE_KEY = 'cost_weights_v1';

// Parsed browser weights, or null if none were ever saved (kept as a
// signed-out fallback and the source for the one-off Firestore migration).
const loadLocalWeights = (): Record<string, number> | null => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
};

const defaultWeights = (): Record<string, number> =>
  Object.fromEntries(COMMODITIES.map((c) => [c.key, 1]));

export function CostImpactPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { settings, update } = useUserSettings();
  const [weights, setWeights] = useState<Record<string, number>>(
    () => settings.costImpact?.weights ?? loadLocalWeights() ?? defaultWeights()
  );

  // Adopt weights once they arrive from Firestore (sign-in / other device).
  useEffect(() => {
    const stored = settings.costImpact?.weights;
    if (stored) setWeights(stored);
  }, [settings.costImpact?.weights]);

  // One-off localStorage -> Firestore migration for existing users.
  useEffect(() => {
    const local = loadLocalWeights();
    if (local && shouldMigrateWeights(settings, local)) {
      void update({ costImpact: { weights: local } });
    }
  }, [settings, update]);

  const setWeight = (key: string, val: number) => {
    const next = { ...weights, [key]: isNaN(val) ? 0 : val };
    setWeights(next);
    // Keep a local fallback (for signed-out use) and persist to the account.
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* */ }
    void update({ costImpact: { weights: next } });
  };

  const { scopeKeys, shared: viewShared } = useView();
  const { companies, shared: sharedCompanies } = useCompanies();
  const { value: sel, setValue: setSel } = useViewState(
    'costImpactSel', { companyId: '', materialId: '' }
  );

  // Owned + shared-with-me companies, deduped — so a viewer shared several
  // companies can pick any of them here (read-only) without changing the
  // global workspace switcher (SM-58).
  const allCompanies = useMemo(() => {
    const map = new Map<string, Company>();
    [...companies, ...sharedCompanies].forEach(
      (c) => c.id && map.set(c.id, c)
    );
    return [...map.values()];
  }, [companies, sharedCompanies]);
  const sharedIds = useMemo(
    () => new Set(sharedCompanies.map((c) => c.id)), [sharedCompanies]
  );

  const activeCompany = useMemo(() => {
    if (sel.companyId && allCompanies.some((c) => c.id === sel.companyId)) {
      return sel.companyId;
    }
    if (viewShared?.companyId &&
      allCompanies.some((c) => c.id === viewShared.companyId)) {
      return viewShared.companyId;
    }
    return allCompanies[0]?.id ?? null;
  }, [sel.companyId, viewShared, allCompanies]);
  const { materials } = useMaterials(activeCompany);

  // Unset/stale → default to the first material; 'custom' = manual weights.
  const activeMaterialId = useMemo(() => {
    if (sel.materialId === 'custom') return 'custom';
    if (sel.materialId && materials.some((m) => m.id === sel.materialId)) {
      return sel.materialId;
    }
    return materials[0]?.id ?? 'custom';
  }, [sel.materialId, materials]);
  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === activeMaterialId) ?? null,
    [materials, activeMaterialId]
  );

  // A selected material drives the weights from its BOM (read-only); with no
  // material ('custom'), the hand-entered weights apply.
  const effectiveWeights = useMemo(
    () => activeMaterial
      ? costImpactWeights(activeMaterial.composition) : weights,
    [activeMaterial, weights]
  );
  const commodities = useMemo(() => {
    if (activeMaterial) {
      const keys = [...new Set(
        activeMaterial.composition.map((c) => c.commodityKey)
      )];
      return keys
        .map((k) => ALL_COMMODITIES.find((c) => c.key === k))
        .filter((c): c is Commodity => !!c);
    }
    return commoditiesForView(
      'cost-impact', settings.personalization, scopeKeys
    );
  }, [activeMaterial, settings.personalization, scopeKeys]);
  const { rows, sum, latestQuarter } = useMemo(
    () => costImpact(records, effectiveWeights, 4, commodities),
    [records, effectiveWeights, commodities]
  );

  const setCompany = (id: string) => setSel({ companyId: id, materialId: '' });
  const setMaterial = (id: string) => setSel({ materialId: id });

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const contribRows = rows.filter((r) => r.impact !== null && r.impact !== 0);
  const chartOption = {
    grid: { left: 4, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category',
      data: contribRows.map((r) => r.label),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 18,
      data: contribRows.map((r) => ({
        value: Number(r.impact!.toFixed(3)),
        itemStyle: {
          color: r.impact! > 0 ? '#e24b4a' : '#16a34a',
          borderRadius: 3,
        },
      })),
    }],
  };

  if (!latestQuarter) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">Not enough history for a quarterly cost-impact view.</div>
    );
  }

  const sumTone = sum > 0
    ? 'text-red-600 dark:text-red-400'
    : sum < 0 ? 'text-green-600 dark:text-green-400' : '';

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['cost-impact']} />
      <div className="-mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {quarterKeyLabel(latestQuarter)} vs the trailing 4-quarter rolling
          baseline, weighted by per-kg consumption
        </p>
        <PrintButton orientation="landscape" />
      </div>

      {allCompanies.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Company</span>
            <select value={activeCompany ?? ''}
              onChange={(e) => setCompany(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-zinc-300
                dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[12rem]">
              {allCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{sharedIds.has(c.id) ? ' (shared)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">
              Product / recipe
            </span>
            <select value={activeMaterialId}
              onChange={(e) => setMaterial(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-zinc-300
                dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[12rem]">
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="custom">Custom weights (manual)</option>
            </select>
          </label>
          <span className="text-xs text-zinc-400 pb-2">
            {activeMaterial
              ? 'Weights from this recipe (read-only)'
              : 'Manual weights'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4
          col-span-2 md:col-span-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            Sum of impact / kg
            <InfoTip content={'The total per-unit cost change: each ' +
              'commodity’s net price move × its consumption weight, summed. ' +
              'Red = costlier, green = cheaper.'} />
          </p>
          <p className={`text-2xl font-semibold mt-1 ${sumTone ||
            'text-zinc-900 dark:text-zinc-100'}`}>
            {sum > 0 ? '+' : ''}{fmt(sum, 2)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {sum > 0 ? 'net cost increase' : sum < 0
              ? 'net cost saving' : 'no net change'}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Quarter</p>
          <p className="text-2xl font-semibold mt-1 text-zinc-900
            dark:text-zinc-100">{quarterKeyLabel(latestQuarter)}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Commodities</p>
          <p className="text-2xl font-semibold mt-1 text-zinc-900
            dark:text-zinc-100">{commodities.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3">Impact contribution per commodity</h3>
        <ReactECharts option={chartOption} opts={{ renderer: 'svg' }}
          notMerge style={{ height: Math.max(240, contribRows.length * 34) }} />
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b
              border-zinc-200 dark:border-zinc-700">
              <th className="px-4 py-3 font-medium">Commodity</th>
              <th className="px-4 py-3 font-medium text-right">Latest Q</th>
              <th className="px-4 py-3 font-medium text-right">
                <span className="inline-flex items-center gap-1 justify-end">
                  Baseline<InfoTip term="Rolling baseline" />
                </span>
              </th>
              <th className="px-4 py-3 font-medium text-right">Net Δ</th>
              <th className="px-4 py-3 font-medium text-right">
                <span className="inline-flex items-center gap-1 justify-end">
                  Weight (kg)<InfoTip term="Consumption weight" />
                </span>
              </th>
              <th className="px-4 py-3 font-medium text-right">Impact / kg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const impTone = r.impact === null ? 'text-zinc-400'
                : r.impact > 0 ? 'text-red-600 dark:text-red-400'
                  : r.impact < 0 ? 'text-green-600 dark:text-green-400'
                    : 'text-zinc-500';
              return (
                <tr key={r.key} className="border-b border-zinc-100
                  dark:border-zinc-700/50">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100
                    whitespace-nowrap">{r.label}</td>
                  <td className="px-4 py-3 text-right text-zinc-600
                    dark:text-zinc-300">{fmt(r.latest)}</td>
                  <td className="px-4 py-3 text-right text-zinc-600
                    dark:text-zinc-300">{fmt(r.baseline)}</td>
                  <td className={`px-4 py-3 text-right ${impTone}`}>
                    {r.netChange === null
                      ? '—'
                      : `${r.netChange > 0 ? '+' : ''}${fmt(r.netChange)}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {activeMaterial ? (
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {fmt(effectiveWeights[r.key] ?? 0, 3)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={weights[r.key] ?? 0}
                        onChange={(e) =>
                          setWeight(r.key, Number(e.target.value))}
                        className="w-20 text-right bg-zinc-50 dark:bg-zinc-900
                          border border-zinc-300 dark:border-zinc-700 rounded-md
                          py-1 px-2 text-sm"
                      />
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${impTone}`}>
                    {r.impact === null
                      ? '—'
                      : `${r.impact > 0 ? '+' : ''}${fmt(r.impact, 2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">
        {activeMaterial
          ? `Weights are ${activeMaterial.name}’s recipe — kg of each ` +
            'commodity per kg of product, from its BOM (edit under Companies ' +
            '& Materials). Impact = net quarterly change × weight.'
          : 'Weights are the kg of each commodity per unit of product; edit ' +
            'them in the table (saved to your account, synced across ' +
            'devices). Impact = net quarterly change × weight.'}
      </p>
    </div>
  );
}
