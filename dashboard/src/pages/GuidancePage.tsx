import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { CalendarClock, Shuffle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ALL_COMMODITIES, monthKeyLabel, parseIssueDate, type PriceRecord,
} from '../lib/reporting';
import { useCompanies, useMaterials } from '../hooks/useCompanies';
import {
  blendedCostSeries, materialSeasonalIndex, cheapestMonths,
  substitutionSuggestions, costVsBaseline, DEFAULT_SUB_GROUPS,
} from '../lib/guidance';
import { ReportIntro } from '../components/ReportIntro';
import { InfoTip } from '../components/InfoTip';
import { REPORT_HELP } from '../lib/help';

const fmt = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function latestRecord(records: PriceRecord[]): PriceRecord | null {
  let best: PriceRecord | null = null;
  let bestKey = -1;
  for (const r of records) {
    const p = parseIssueDate(r.date);
    if (!p) continue;
    const k = p.year * 12 + p.month;
    if (k > bestKey) { bestKey = k; best = r; }
  }
  return best;
}

const selCls = 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 ' +
  'dark:border-zinc-700 rounded-md py-2 px-3 text-sm';
const card = 'bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 ' +
  'dark:border-zinc-700 p-4';

export function GuidancePage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { companies, signedIn } = useCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const active = companyId ?? companies[0]?.id ?? null;
  const { materials } = useMaterials(active);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const material = materials.find((m) => m.id === materialId)
    ?? materials[0] ?? null;

  const record = useMemo(() => latestRecord(records), [records]);
  const series = useMemo(
    () => material ? blendedCostSeries(material.composition, records)
      : new Map<string, number>(),
    [material, records]
  );
  const baseline = useMemo(() => costVsBaseline(series), [series]);
  const seasonal = useMemo(
    () => material
      ? materialSeasonalIndex(material.composition, records, record)
      : new Map<number, number>(),
    [material, records, record]
  );
  const cheapest = cheapestMonths(seasonal, 3);
  const swaps = useMemo(
    () => material
      ? substitutionSuggestions(
        material.composition, DEFAULT_SUB_GROUPS, ALL_COMMODITIES, record)
      : [],
    [material, record]
  );

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const monthKeys = [...series.keys()].sort();
  const option = {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category', data: monthKeys.map(monthKeyLabel),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value', scale: true, axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'line', smooth: true, symbol: 'none',
      data: monthKeys.map((k) => Number(series.get(k)!.toFixed(0))),
      lineStyle: { color: '#2563eb', width: 2.5 },
      itemStyle: { color: '#2563eb' },
      markLine: baseline.baseline !== null ? {
        symbol: 'none', data: [{ yAxis: Number(baseline.baseline.toFixed(0)) }],
        lineStyle: { color: axisColor, type: 'dashed' },
        label: { color: axisColor, formatter: 'baseline' },
      } : undefined,
    }],
  };

  if (!signedIn) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">Sign in to view purchasing guidance.</div>
    );
  }
  if (companies.length === 0 || materials.length === 0) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Add a company and at least one material in the{' '}
        <span className="font-medium">Companies</span> tab to get guidance.
      </div>
    );
  }

  const upTone = baseline.pct !== null && baseline.pct > 0;

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['guidance']} />
      <div className="flex flex-wrap items-center gap-2">
        <select className={selCls} value={active ?? ''}
          onChange={(e) => { setCompanyId(e.target.value); setMaterialId(null); }}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className={selCls} value={material?.id ?? ''}
          onChange={(e) => setMaterialId(e.target.value)}>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Cost vs baseline */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            Blended cost / {material?.unit ?? 'unit'}
            <InfoTip term="Blended cost" /></p>
          <p className="text-2xl font-semibold mt-1 text-zinc-900
            dark:text-zinc-100">{fmt(baseline.latest)}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            vs 6-mo baseline<InfoTip term="Rolling baseline" /></p>
          <p className={`text-2xl font-semibold mt-1 flex items-center gap-1
            ${baseline.pct === null ? 'text-zinc-400'
              : upTone ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'}`}>
            {baseline.pct === null ? '—' : (
              <>{upTone ? <TrendingUp className="h-5 w-5" />
                : <TrendingDown className="h-5 w-5" />}
              {baseline.pct > 0 ? '+' : ''}{baseline.pct.toFixed(1)}%</>
            )}
          </p>
        </div>
      </div>

      {monthKeys.length >= 2 && (
        <div className={card}>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
            mb-3">Blended cost over time</h3>
          <ReactECharts option={option} style={{ height: 300 }} />
        </div>
      )}

      {/* Seasonal buy-timing */}
      <div className={card}>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />Seasonal buy-timing</h3>
        {cheapest.length === 0 || cheapest.every((c) => c.pct >= 0) ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No clear seasonal buying window from the available history.
          </p>
        ) : (
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            {cheapest.filter((c) => c.pct < 0).map((c) => (
              <li key={c.month}>
                <span className="font-medium">{c.label}</span> — prices
                typically move {c.pct.toFixed(1)}% into this month
                (weighted across the material).
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Substitution */}
      <div className={card}>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3 flex items-center gap-2">
          <Shuffle className="h-4 w-4" />Cheaper alternatives right now</h3>
        {swaps.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No cheaper same-unit substitute this month — the material already
            uses the best-priced option in each group.
          </p>
        ) : (
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
            {swaps.map((s) => (
              <li key={s.from.key} className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400
                  font-semibold">−{fmt(s.saving)}</span>
                <span>
                  Swap <span className="font-medium">{s.from.label}</span> →{' '}
                  <span className="font-medium">{s.to.label}</span>{' '}
                  <span className="text-xs text-zinc-400">
                    ({s.groupName}, saving / {material?.unit})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-zinc-400">
        Guidance is statistical (seasonality, current prices, same-unit
        substitution) — a starting point, not a forecast.
      </p>
    </div>
  );
}
