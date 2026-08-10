import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  effectiveCommodities,
  monthlySpread,
  meanStd,
  monthKeyLabel,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function SpreadsPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { settings } = useUserSettings();
  const commodities = useMemo(
    () => effectiveCommodities('spreads', settings.personalization),
    [settings.personalization]
  );
  // Default to the scrap vs pig-iron substitution spread (comparable scale).
  const [keyA, setKeyA] = useState('melting_foundry_scrap_mumbai');
  const [keyB, setKeyB] = useState('pig_iron_foundry_gr_pune');
  // Keep both selections within the effective set.
  useEffect(() => {
    if (!commodities.some((c) => c.key === keyA)) {
      setKeyA(commodities[0]?.key ?? '');
    }
    if (!commodities.some((c) => c.key === keyB)) {
      setKeyB(commodities[1]?.key ?? commodities[0]?.key ?? '');
    }
  }, [commodities, keyA, keyB]);

  const spread = useMemo(
    () => monthlySpread(records, keyA, keyB), [records, keyA, keyB]
  );
  const monthsKeys = [...spread.keys()].sort();
  const values = monthsKeys.map((k) => spread.get(k)!);
  const { mean, std } = meanStd(values);
  const latest = values.length ? values[values.length - 1] : null;
  const z = latest !== null && std > 0 ? (latest - mean) / std : null;
  const labelA = commodities.find((c) => c.key === keyA)?.label ?? keyA;
  const labelB = commodities.find((c) => c.key === keyB)?.label ?? keyB;

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const option = {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: monthsKeys.map(monthKeyLabel),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'line',
      data: values.map((v) => Number(v.toFixed(2))),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#2563eb', width: 2.5 },
      itemStyle: { color: '#2563eb' },
      markLine: {
        symbol: 'none',
        data: [{ yAxis: Number(mean.toFixed(2)), name: 'mean' }],
        lineStyle: { color: axisColor, type: 'dashed' },
        label: { color: axisColor, formatter: 'mean' },
      },
      markArea: std > 0 ? {
        itemStyle: { color: 'rgba(37,99,235,0.08)' },
        data: [[
          { yAxis: Number((mean - std).toFixed(2)) },
          { yAxis: Number((mean + std).toFixed(2)) },
        ]],
      } : undefined,
    }],
  };

  const deviates = z !== null && Math.abs(z) >= 2;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Spread monitor
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {labelA} − {labelB}, monthly, with mean ±1σ band
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={keyA} onChange={(e) => setKeyA(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
              dark:border-zinc-700 rounded-md py-2 px-2 text-sm">
            {commodities.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <span className="text-zinc-400">−</span>
          <select value={keyB} onChange={(e) => setKeyB(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
              dark:border-zinc-700 rounded-md py-2 px-2 text-sm">
            {commodities.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {monthsKeys.length < 2 ? (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
          text-center">
          Not enough overlapping history for these two commodities.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Latest spread', value: latest !== null
                ? fmt(latest) : '—' },
              { label: 'Mean', value: fmt(mean) },
              { label: 'Std dev', value: fmt(std) },
              { label: 'Deviation', value: z !== null
                ? `${z > 0 ? '+' : ''}${z.toFixed(1)}σ` : '—',
              tone: deviates ? 'text-amber-600 dark:text-amber-400' : '' },
            ].map((t) => (
              <div key={t.label} className="bg-zinc-50 dark:bg-zinc-800/60
                rounded-lg p-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${t.tone ||
                  'text-zinc-900 dark:text-zinc-100'}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {deviates && (
            <div className="rounded-lg border border-amber-200
              dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3
              text-sm text-amber-700 dark:text-amber-300">
              The current spread is {Math.abs(z!).toFixed(1)}σ from its norm —
              an unusual {labelA}/{labelB} relationship worth a look.
            </div>
          )}

          <div className="bg-white dark:bg-zinc-800 rounded-lg border
            border-zinc-200 dark:border-zinc-700 p-4">
            <ReactECharts option={option}
              style={{ height: 340, width: '100%' }} />
          </div>
        </>
      )}
    </div>
  );
}
