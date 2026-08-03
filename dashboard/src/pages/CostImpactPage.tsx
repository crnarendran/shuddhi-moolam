import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  COMMODITIES,
  costImpact,
  quarterKeyLabel,
  type PriceRecord,
} from '../lib/reporting';

const STORE_KEY = 'cost_weights_v1';

const loadWeights = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return Object.fromEntries(COMMODITIES.map((c) => [c.key, 1]));
};

const fmt = (n: number | null, d = 1): string =>
  n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: d });

export function CostImpactPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const [weights, setWeights] = useState<Record<string, number>>(loadWeights);

  const setWeight = (key: string, val: number) => {
    const next = { ...weights, [key]: isNaN(val) ? 0 : val };
    setWeights(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* */ }
  };

  const { rows, sum, latestQuarter } = useMemo(
    () => costImpact(records, weights), [records, weights]
  );

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
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cost impact
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {quarterKeyLabel(latestQuarter)} vs the trailing 4-quarter rolling
          baseline, weighted by per-kg consumption
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4
          col-span-2 md:col-span-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sum of impact / kg
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
            dark:text-zinc-100">{COMMODITIES.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3">Impact contribution per commodity</h3>
        <ReactECharts option={chartOption}
          style={{ height: Math.max(240, contribRows.length * 34) }} />
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b
              border-zinc-200 dark:border-zinc-700">
              <th className="px-4 py-3 font-medium">Commodity</th>
              <th className="px-4 py-3 font-medium text-right">Latest Q</th>
              <th className="px-4 py-3 font-medium text-right">Baseline</th>
              <th className="px-4 py-3 font-medium text-right">Net Δ</th>
              <th className="px-4 py-3 font-medium text-right">Weight (kg)</th>
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
                    <input
                      type="number"
                      step="0.01"
                      value={weights[r.key] ?? 0}
                      onChange={(e) => setWeight(r.key, Number(e.target.value))}
                      className="w-20 text-right bg-zinc-50 dark:bg-zinc-900
                        border border-zinc-300 dark:border-zinc-700 rounded-md
                        py-1 px-2 text-sm"
                    />
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
        Weights are the kg of each commodity per unit of product; edit them above
        (saved in your browser). Impact = net quarterly change × weight.
      </p>
    </div>
  );
}
