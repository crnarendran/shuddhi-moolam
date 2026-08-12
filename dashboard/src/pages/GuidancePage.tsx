import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { CalendarClock, Shuffle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ALL_COMMODITIES, monthKeyLabel, parseIssueDate, type PriceRecord,
} from '../lib/reporting';
import { useCompanies, useMaterials } from '../hooks/useCompanies';
import { type Material } from '../lib/materials';
import {
  blendedCostSeries, materialSeasonalIndex, cheapestMonths,
  substitutionSuggestions, costVsBaseline, DEFAULT_SUB_GROUPS,
} from '../lib/guidance';
import { useViewState } from '../hooks/useViewState';
import { ReportIntro } from '../components/ReportIntro';
import { InfoTip } from '../components/InfoTip';
import { PrintButton } from '../components/PrintButton';
import { MultiSelect } from '../components/MultiSelect';
import { SERIES_COLORS } from '../lib/chartColors';
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

const GUIDANCE_DEFAULTS: { companyId: string; materialIds: string[] } = {
  companyId: '', materialIds: [],
};

export function GuidancePage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { companies, signedIn } = useCompanies();
  const { value: gv, setValue: setGv } = useViewState(
    'guidance', GUIDANCE_DEFAULTS
  );

  const active = useMemo(() => {
    if (gv.companyId && companies.some((c) => c.id === gv.companyId)) {
      return gv.companyId;
    }
    return companies[0]?.id ?? null;
  }, [gv.companyId, companies]);
  const { materials } = useMaterials(active);

  const activeMaterialIds = useMemo(() => {
    const valid = (gv.materialIds ?? []).filter(
      (id) => materials.some((m) => m.id === id)
    );
    if (valid.length) return valid;
    return materials[0]?.id ? [materials[0].id] : [];
  }, [gv.materialIds, materials]);

  const chartMaterials: Material[] = useMemo(
    () => activeMaterialIds
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is Material => !!m),
    [activeMaterialIds, materials]
  );
  const primary = chartMaterials[0] ?? null;
  const multi = chartMaterials.length > 1;

  const setCompany = (id: string) =>
    setGv({ companyId: id, materialIds: [] });
  const setMaterialIds = (ids: string[]) => setGv({ materialIds: ids });

  const record = useMemo(() => latestRecord(records), [records]);
  const seriesByMat = useMemo(
    () => chartMaterials.map((m) => ({
      id: m.id, name: m.name,
      series: blendedCostSeries(m.composition, records),
    })),
    [chartMaterials, records]
  );
  const baseline = useMemo(
    () => costVsBaseline(seriesByMat[0]?.series ?? new Map<string, number>()),
    [seriesByMat]
  );
  const seasonal = useMemo(
    () => primary
      ? materialSeasonalIndex(primary.composition, records, record)
      : new Map<number, number>(),
    [primary, records, record]
  );
  const cheapest = cheapestMonths(seasonal, 3);
  const swaps = useMemo(
    () => primary
      ? substitutionSuggestions(
        primary.composition, DEFAULT_SUB_GROUPS, ALL_COMMODITIES, record)
      : [],
    [primary, record]
  );

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const allMonths = useMemo(
    () => Array.from(
      new Set(seriesByMat.flatMap((s) => [...s.series.keys()]))
    ).sort(),
    [seriesByMat]
  );
  const option = {
    grid: { left: 8, right: 16, top: multi ? 28 : 16, bottom: 8,
      containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: multi
      ? { data: seriesByMat.map((s) => s.name), textStyle:
        { color: axisColor }, top: 0 }
      : undefined,
    xAxis: {
      type: 'category', data: allMonths.map(monthKeyLabel),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value', scale: true, axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: seriesByMat.map((s, i) => {
      const color = multi ? SERIES_COLORS[i % SERIES_COLORS.length] : '#2563eb';
      return {
        name: s.name,
        type: 'line', smooth: true, symbol: 'none', connectNulls: false,
        data: allMonths.map((k) => {
          const v = s.series.get(k);
          return v == null ? null : Number(v.toFixed(0));
        }),
        lineStyle: { color, width: 2.5 },
        itemStyle: { color },
        markLine: !multi && baseline.baseline !== null ? {
          symbol: 'none',
          data: [{ yAxis: Number(baseline.baseline.toFixed(0)) }],
          lineStyle: { color: axisColor, type: 'dashed' },
          label: { color: axisColor, formatter: 'baseline' },
        } : undefined,
      };
    }),
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
  const primaryNote = multi ? ` · primary: ${primary?.name}` : '';

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['guidance']} />
      <div className="flex flex-wrap items-center gap-2">
        <select className={selCls} value={active ?? ''}
          onChange={(e) => setCompany(e.target.value)}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <MultiSelect
          label="Materials"
          options={materials.map((m) => ({ value: m.id ?? '', label: m.name }))}
          selected={activeMaterialIds}
          onChange={setMaterialIds}
        />
        <div className="ml-auto"><PrintButton /></div>
      </div>

      {/* Cost vs baseline (primary material) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            Blended cost / {primary?.unit ?? 'unit'}
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

      {allMonths.length >= 2 && (
        <div className={card}>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
            mb-3">Blended cost over time
            {multi ? ' · one line per material' : ''}</h3>
          <ReactECharts option={option} opts={{ renderer: 'svg' }}
            style={{ height: 300 }} />
        </div>
      )}

      {/* Seasonal buy-timing (primary material) */}
      <div className={card}>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />Seasonal buy-timing
          <span className="font-normal text-zinc-400">{primaryNote}</span></h3>
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

      {/* Substitution (primary material) */}
      <div className={card}>
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-3 flex items-center gap-2">
          <Shuffle className="h-4 w-4" />Cheaper alternatives right now
          <span className="font-normal text-zinc-400">{primaryNote}</span></h3>
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
                    ({s.groupName}, saving / {primary?.unit})</span>
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
