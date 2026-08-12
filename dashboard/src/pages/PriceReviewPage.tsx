import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  effectiveCommodities,
  monthlyAverages,
  pctChange,
  monthKeyLabel,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import { ReportIntro } from '../components/ReportIntro';
import { PrintButton } from '../components/PrintButton';
import { REPORT_HELP } from '../lib/help';

type Status = 'Review' | 'Watch' | 'OK' | 'No data';

interface Row {
  label: string;
  avgs: (number | null)[];
  delta: number | null;
  pct: number | null;
  status: Status;
}

const fmt = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const statusStyle: Record<Status, string> = {
  Review: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Watch: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  OK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'No data': 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

export function PriceReviewPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const [threshold, setThreshold] = useState(5);
  const { settings } = useUserSettings();
  const commodities = useMemo(
    () => effectiveCommodities('price-review', settings.personalization),
    [settings.personalization]
  );

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const c of commodities) {
      for (const k of monthlyAverages(records, c.key).keys()) set.add(k);
    }
    return [...set].sort();
  }, [records, commodities]);

  const last3 = months.slice(-3);
  const current = last3[last3.length - 1];
  const prev = last3[last3.length - 2];

  const rows: Row[] = useMemo(() => {
    return commodities.map((c) => {
      const m = monthlyAverages(records, c.key);
      const avgs = last3.map((k) => m.get(k) ?? null);
      const cur = current ? m.get(current) ?? null : null;
      const pre = prev ? m.get(prev) ?? null : null;
      const pct = pctChange(pre, cur);
      const delta = cur !== null && pre !== null ? cur - pre : null;
      let status: Status = 'No data';
      if (pct !== null) {
        const a = Math.abs(pct);
        status = a >= threshold ? 'Review' : a >= 3 ? 'Watch' : 'OK';
      }
      return { label: c.label, avgs, delta, pct, status };
    });
  }, [records, commodities, last3, current, prev, threshold]);

  const flagged = rows.filter((r) => r.status === 'Review').length;
  const watch = rows.filter((r) => r.status === 'Watch').length;
  const biggest = rows
    .filter((r) => r.pct !== null)
    .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!))[0];

  const chartRows = rows.filter((r) => r.pct !== null);
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const chartOption = {
    grid: { left: 4, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%', color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category',
      data: chartRows.map((r) => r.label),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: 'bar',
        data: chartRows.map((r) => ({
          value: Number(r.pct!.toFixed(2)),
          itemStyle: {
            color: r.pct! <= -0.05 ? '#e24b4a'
              : r.pct! >= 0.05 ? '#16a34a' : '#9ca3af',
            borderRadius: 3,
          },
        })),
        barMaxWidth: 18,
      },
    ],
  };

  if (months.length < 2) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Not enough history yet — at least two months of processed issues are
        needed for a month-over-month review.
      </div>
    );
  }

  const tiles = [
    { label: 'Commodities', value: String(commodities.length), tone: '' },
    { label: `Flagged ≥${threshold}%`, value: String(flagged),
      tone: flagged > 0 ? 'text-red-600 dark:text-red-400' : '' },
    { label: 'Watch 3–' + threshold + '%', value: String(watch),
      tone: watch > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
    { label: 'Biggest move',
      value: biggest?.pct != null
        ? `${biggest.pct > 0 ? '+' : ''}${biggest.pct.toFixed(1)}%` : '—',
      sub: biggest?.label, tone: '' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['price-review']} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {current && prev
            ? `${monthKeyLabel(current)} vs ${monthKeyLabel(prev)} · `
            : ''}
          month-over-month
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600
            dark:text-zinc-300">
            Threshold
            <input
              type="number"
              min={1}
              max={50}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 1)}
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
                dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm"
            />
            <span>%</span>
          </label>
          <PrintButton />
        </div>
      </div>

      {flagged > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200
          dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm
          text-red-700 dark:text-red-300">
          {flagged} commodit{flagged === 1 ? 'y' : 'ies'} moved beyond ±
          {threshold}% this period — review pricing.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-zinc-50 dark:bg-zinc-800/60
            rounded-lg p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${t.tone ||
              'text-zinc-900 dark:text-zinc-100'}`}>{t.value}</p>
            {t.sub && (
              <p className="text-xs text-zinc-400 truncate mt-0.5">{t.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3">Percent change · latest month</h3>
        <ReactECharts
          option={chartOption}
          opts={{ renderer: 'svg' }}
          style={{ height: Math.max(240, chartRows.length * 34), width: '100%' }}
        />
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b
              border-zinc-200 dark:border-zinc-700">
              <th className="px-4 py-3 font-medium">Commodity</th>
              {last3.map((k) => (
                <th key={k} className="px-4 py-3 font-medium text-right">
                  {monthKeyLabel(k)}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-right">Δ</th>
              <th className="px-4 py-3 font-medium text-right">% MoM</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pctColor = r.pct === null ? 'text-zinc-400'
                : r.pct <= -3 ? 'text-red-600 dark:text-red-400'
                  : r.pct > 0 ? 'text-green-600 dark:text-green-400'
                    : 'text-zinc-500';
              return (
                <tr key={r.label} className="border-b border-zinc-100
                  dark:border-zinc-700/50">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100
                    whitespace-nowrap">{r.label}</td>
                  {r.avgs.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-right text-zinc-600
                      dark:text-zinc-300">{fmt(v)}</td>
                  ))}
                  <td className={`px-4 py-3 text-right ${pctColor}`}>
                    {r.delta === null
                      ? '—'
                      : `${r.delta > 0 ? '+' : ''}${fmt(r.delta)}`}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pctColor}`}>
                    {r.pct === null
                      ? '—'
                      : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs
                      font-medium ${statusStyle[r.status]}`}>{r.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
