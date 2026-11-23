import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  CalendarClock, LineChart, Shuffle, TrendingDown, TrendingUp,
} from 'lucide-react';
import {
  ALL_COMMODITIES, monthKeyLabel, quarterKeyLabel, parseIssueDate,
  type PriceRecord,
} from '../lib/reporting';
import { useCompanies } from '../hooks/useCompanies';
import { useView } from '../context/ViewContext';
import { type Material } from '../lib/materials';
import {
  blendedCostSeries, blendedCostQuarterSeries, materialSeasonalIndex,
  cheapestMonths, substitutionSuggestions, costVsBaseline, DEFAULT_SUB_GROUPS,
} from '../lib/guidance';
import { forecastSeries, type ForecastResult } from '../lib/forecast';
import { ReportIntro } from '../components/ReportIntro';
import { InfoTip } from '../components/InfoTip';
import { PrintButton } from '../components/PrintButton';
import { WhatIfSimulator } from '../components/WhatIfSimulator';
import { SERIES_COLORS } from '../lib/chartColors';
import { REPORT_HELP } from '../lib/help';
import { fmtChartValue, fmtNum as fmt } from '../lib/format';

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

const card = 'bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 ' +
  'dark:border-zinc-700 p-4';

interface MaterialGuidance {
  material: Material;
  color: string;
  series: Map<string, number>;
  baseline: ReturnType<typeof costVsBaseline>;
  cheapest: ReturnType<typeof cheapestMonths>;
  swaps: ReturnType<typeof substitutionSuggestions>;
  forecast: ForecastResult | null;
}

/**
 * Formats a signed forecast percentage change using Unicode minus for drops.
 * @param {number | null} pct - End-of-horizon percent change, or null.
 * @returns {string} Formatted signed percentage or '—'.
 */
function formatForecastDelta(pct: number | null): string {
  if (pct === null) return '—';
  if (pct === 0) return '0.0%';
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/**
 * Returns Tailwind text color classes for a forecast direction.
 * @param {ForecastResult['direction']} direction - Forecast direction.
 * @returns {string} Tailwind color classes.
 */
function forecastDeltaTone(
  direction: ForecastResult['direction']
): string {
  if (direction === 'up') return 'text-red-600 dark:text-red-400';
  if (direction === 'down') return 'text-green-600 dark:text-green-400';
  return 'text-zinc-500 dark:text-zinc-400';
}

/**
 * Returns Tailwind badge classes for a forecast accuracy rating.
 * @param {ForecastResult['accuracy']['rating']} rating - Backtest tier.
 * @returns {string} Tailwind background and text classes.
 */
function ratingBadgeTone(
  rating: ForecastResult['accuracy']['rating']
): string {
  if (rating === 'high') {
    return 'bg-emerald-50 text-emerald-700 ' +
      'dark:bg-emerald-950/60 dark:text-emerald-300';
  }
  if (rating === 'moderate') {
    return 'bg-amber-50 text-amber-700 ' +
      'dark:bg-amber-950/60 dark:text-amber-300';
  }
  return 'bg-zinc-100 text-zinc-600 ' +
    'dark:bg-zinc-700/70 dark:text-zinc-300';
}

/**
 * Builds ECharts overlay series for a single-material 3-month forecast:
 * a stacked 80% confidence band over the forecast months only, plus a
 * dashed forecast line bridging from the last actual month.
 * @param {string[]} allMonths - Combined chronological "YYYY-MM" axis keys.
 * @param {Map<string, number>} actualSeries - Historical monthly costs.
 * @param {ForecastResult} forecast - Computed 3-month forecast.
 * @returns {Array<Record<string, unknown>>} ECharts series objects.
 */
function buildForecastOverlaySeries(
  allMonths: string[],
  actualSeries: Map<string, number>,
  forecast: ForecastResult
) {
  const actualKeys = [...actualSeries.keys()].sort();
  const lastMonth = actualKeys[actualKeys.length - 1];
  const lastRaw = lastMonth ? actualSeries.get(lastMonth) : undefined;
  const lastVal = lastRaw !== undefined ? Number(lastRaw.toFixed(1)) : null;
  const byMonth = new Map(forecast.points.map((p) => [p.month, p]));

  return [
    {
      name: 'Forecast lower',
      type: 'line',
      stack: 'forecast-band',
      symbol: 'none',
      connectNulls: false,
      silent: true,
      tooltip: { show: false },
      lineStyle: { opacity: 0 },
      data: allMonths.map((m) => {
        const p = byMonth.get(m);
        return p ? Number(p.lower.toFixed(2)) : null;
      }),
    },
    {
      name: 'Forecast band',
      type: 'line',
      stack: 'forecast-band',
      symbol: 'none',
      connectNulls: false,
      silent: true,
      tooltip: { show: false },
      lineStyle: { opacity: 0 },
      areaStyle: { color: 'rgba(37, 99, 235, 0.14)' },
      data: allMonths.map((m) => {
        const p = byMonth.get(m);
        return p ? Number(Math.max(0, p.upper - p.lower).toFixed(2)) : null;
      }),
    },
    {
      name: 'Forecast (3 mo)',
      type: 'line',
      smooth: false,
      symbol: 'none',
      connectNulls: false,
      lineStyle: { color: '#2563eb', width: 2, type: 'dashed' },
      itemStyle: { color: '#2563eb' },
      data: allMonths.map((m) => {
        if (m === lastMonth) return lastVal;
        const p = byMonth.get(m);
        return p ? Number(p.point.toFixed(1)) : null;
      }),
    },
  ];
}

/**
 * Compact 3-month forecast summary block rendered inside each MaterialCard.
 * @param {{ forecast: ForecastResult | null }} props - Forecast or null.
 * @returns {JSX.Element} Forecast summary or insufficient-history note.
 */
function ForecastSection({
  forecast,
}: {
  forecast: ForecastResult | null;
}) {
  if (!forecast) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2 flex items-center gap-2">
          <LineChart className="h-4 w-4" aria-hidden="true" />
          3-month forecast
        </h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Needs at least 6 months of history for a 3-month forecast.
        </p>
      </div>
    );
  }

  const end = forecast.points[forecast.points.length - 1];
  const { mae, mape, rating } = forecast.accuracy;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
        mb-2 flex items-center gap-2">
        <LineChart className="h-4 w-4" aria-hidden="true" />
        3-month forecast
      </h4>

      <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded-lg p-3
        space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-semibold text-zinc-900
              dark:text-zinc-100">
              ₹{fmt(end.point)} / kg
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              range ₹{fmt(end.lower)}–₹{fmt(end.upper)}
            </span>
            {forecast.endDeltaPct !== null && (
              <span className={`text-xs font-semibold
                ${forecastDeltaTone(forecast.direction)}`}>
                {formatForecastDelta(forecast.endDeltaPct)} vs latest
              </span>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
            ${ratingBadgeTone(rating)}`}>
            Backtest: ±₹{fmt(mae, 1)} · {mape.toFixed(1)}% MAPE · {rating}
          </span>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs
          text-zinc-600 dark:text-zinc-300">
          {forecast.points.map((p) => (
            <li key={p.month} className="bg-white dark:bg-zinc-800/70
              rounded px-2.5 py-1.5 border border-zinc-200/70
              dark:border-zinc-700/70">
              {`${monthKeyLabel(p.month)}: ₹${fmt(p.point)} ` +
                `(₹${fmt(p.lower)}–₹${fmt(p.upper)})`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Full guidance block for a single material: cost-vs-baseline tiles, seasonal
 * buy-timing, cheaper-alternative substitutions, 3-month forecast, and
 * what-if simulator. Rendered once per selected material so guidance covers
 * every comparison, not just the first.
 * @param {object} props - Component props.
 * @param {MaterialGuidance} props.g - Pre-computed material guidance.
 * @param {PriceRecord | null} props.latest - Latest available price record.
 * @param {boolean} props.showDot - Whether to show the material color dot.
 * @returns {JSX.Element} Rendered material guidance card.
 */
function MaterialCard({
  g,
  latest,
  showDot,
}: {
  g: MaterialGuidance;
  latest: PriceRecord | null;
  showDot: boolean;
}) {
  const { material, color, baseline, cheapest, swaps, forecast } = g;
  const up = baseline.pct !== null && baseline.pct > 0;
  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100
        mb-3 flex items-center gap-2">
        {showDot && (
          <span className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ background: color }} />
        )}
        {material.name}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            Blended cost / kg
            <InfoTip term="Blended cost" /></p>
          <p className="text-2xl font-semibold mt-1 text-zinc-900
            dark:text-zinc-100">{fmt(baseline.latest)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {baseline.latestKey
              ? `${quarterKeyLabel(baseline.latestKey)} to date` : '—'}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400
            flex items-center gap-1">
            vs prior quarter<InfoTip term="Prior quarter" /></p>
          <p className={`text-2xl font-semibold mt-1 flex items-center gap-1
            ${baseline.pct === null ? 'text-zinc-400'
              : up ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'}`}>
            {baseline.pct === null ? '—' : (
              <>{up ? <TrendingUp className="h-5 w-5" />
                : <TrendingDown className="h-5 w-5" />}
              {baseline.pct > 0 ? '+' : ''}{baseline.pct.toFixed(1)}%</>
            )}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {baseline.baselineKeys.length > 0
              ? `vs ${quarterKeyLabel(baseline.baselineKeys[0])}` +
                ` (${fmt(baseline.baseline)})`
              : 'no prior quarter yet'}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />Seasonal buy-timing</h4>
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

      <div>
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2 flex items-center gap-2">
          <Shuffle className="h-4 w-4" />Cheaper alternatives right now</h4>
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
                    ({s.groupName}, saving / kg)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ForecastSection forecast={forecast} />

      <WhatIfSimulator
        material={material}
        latest={latest}
        commodities={ALL_COMMODITIES}
      />
    </div>
  );
}

/**
 * Purchasing Guidance page: blended cost trend with 3-month single-material
 * forecast bands, cost-vs-baseline tiles, seasonal buy-timing, substitution
 * suggestions, and interactive what-if simulation.
 * @param {object} props - Component props.
 * @param {PriceRecord[]} props.records - Historical price records.
 * @param {boolean} props.isDark - Whether dark theme is active.
 * @returns {JSX.Element} Rendered purchasing guidance view.
 */
export function GuidancePage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { signedIn } = useCompanies();
  // Company + product(s) come from the global Company·Product selector
  // (SM-60). On Guidance that selector is a multi-select, so `products` may
  // hold several materials to compare side by side.
  const { companyId, company, products, materials } = useView();

  const chartMaterials: Material[] = products;
  const multi = chartMaterials.length > 1;

  const record = useMemo(() => latestRecord(records), [records]);
  // Full guidance computed per selected material.
  const guidance: MaterialGuidance[] = useMemo(
    () => chartMaterials.map((m, i) => {
      const series = blendedCostSeries(m.composition, records);
      const seasonal = materialSeasonalIndex(m.composition, records, record);
      return {
        material: m,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        series,
        // Quarter-over-quarter: Q-to-date vs the prior calendar quarter,
        // matching how Cost Impact aggregates (SM-60). The chart above stays
        // monthly for trend resolution.
        baseline: costVsBaseline(
          blendedCostQuarterSeries(m.composition, records)
        ),
        cheapest: cheapestMonths(seasonal, 3),
        swaps: substitutionSuggestions(
          m.composition, DEFAULT_SUB_GROUPS, ALL_COMMODITIES, record),
        forecast: forecastSeries(series, 3),
      };
    }),
    [chartMaterials, records, record]
  );

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const actualMonths = useMemo(
    () => Array.from(
      new Set(guidance.flatMap((g) => [...g.series.keys()]))
    ).sort(),
    [guidance]
  );
  const singleForecast = !multi ? (guidance[0]?.forecast ?? null) : null;
  const allMonths = useMemo(
    () => singleForecast
      ? [...actualMonths, ...singleForecast.points.map((p) => p.month)]
      : actualMonths,
    [actualMonths, singleForecast]
  );
  const baseSeries = guidance.map((g) => {
    const color = multi ? g.color : '#2563eb';
    return {
      name: g.material.name,
      type: 'line', smooth: true, symbol: 'none', connectNulls: false,
      data: allMonths.map((k) => {
        const v = g.series.get(k);
        return v == null ? null : Number(v.toFixed(1));
      }),
      lineStyle: { color, width: 2.5 },
      itemStyle: { color },
      markLine: !multi && g.baseline.baseline !== null ? {
        symbol: 'none',
        data: [{ yAxis: Number(g.baseline.baseline.toFixed(1)) }],
        lineStyle: { color: axisColor, type: 'dashed' },
        label: { color: axisColor, formatter: 'baseline' },
      } : undefined,
    };
  });
  const overlaySeries = singleForecast && guidance[0]
    ? buildForecastOverlaySeries(allMonths, guidance[0].series, singleForecast)
    : [];
  const legendItems = multi
    ? guidance.map((g) => g.material.name)
    : singleForecast && guidance[0]
      ? [guidance[0].material.name, 'Forecast (3 mo)']
      : null;
  const option = {
    grid: {
      left: 8,
      right: 16,
      top: legendItems ? 28 : 16,
      bottom: 8,
      containLabel: true,
    },
    tooltip: { trigger: 'axis', valueFormatter: fmtChartValue },
    legend: legendItems
      ? { data: legendItems, textStyle: { color: axisColor }, top: 0 }
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
    series: [...baseSeries, ...overlaySeries],
  };

  if (!signedIn) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">Sign in to view purchasing guidance.</div>
    );
  }
  if (!companyId) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Pick a company in the header selector (top right) to see guidance.
      </div>
    );
  }
  if (materials.length === 0) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Add at least one material to this company in the{' '}
        <span className="font-medium">Companies</span> tab to get guidance.
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Select one or more products in the header selector to compare.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['guidance']} />
      <div className="flex flex-wrap items-center gap-2">
        {company && (
          <span className="text-sm font-medium text-zinc-600
            dark:text-zinc-300">
            {company.name}
          </span>
        )}
        <div className="ml-auto"><PrintButton /></div>
      </div>

      {actualMonths.length >= 2 && (
        <div className={card}>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
            mb-3">Blended cost over time
            {multi ? ' · one line per material' : ''}</h3>
          <ReactECharts option={option} opts={{ renderer: 'svg' }}
            notMerge style={{ height: 300 }} />
        </div>
      )}

      {/* Full guidance per selected material. */}
      {guidance.map((g) => (
        <MaterialCard
          key={g.material.id}
          g={g}
          latest={record}
          showDot={multi}
        />
      ))}

      <p className="text-xs text-zinc-400">
        Guidance is statistical (seasonality, current prices, same-unit
        substitution). The 3-month forecast is a damped statistical
        extrapolation with backtested 80% error bands, not a price guarantee.
      </p>
    </div>
  );
}
