import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  commoditiesForView,
  MONTHS,
  monthlyByYear,
  seasonalIndex,
  yearsOfData,
  confidenceLabel,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import { useViewState } from '../hooks/useViewState';
import { useView } from '../context/ViewContext';
import { ReportIntro } from '../components/ReportIntro';
import { PrintButton } from '../components/PrintButton';
import { MultiSelect } from '../components/MultiSelect';
import { SERIES_COLORS } from '../lib/chartColors';
import { REPORT_HELP } from '../lib/help';

// Empty defaults so an unset selection (first run) is distinguishable from an
// explicitly cleared one ([]): the former defaults to the first commodity,
// the latter shows an empty-state.
const SEASONAL_DEFAULTS: { keys?: string[] } = {};

export function SeasonalPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { settings } = useUserSettings();
  const { scopeKeys } = useView();
  const commodities = useMemo(
    () => commoditiesForView('seasonal', settings.personalization, scopeKeys),
    [settings.personalization, scopeKeys]
  );

  const { value: sv, setValue: setSv } = useViewState(
    'seasonal', SEASONAL_DEFAULTS
  );
  // Unset (first run) -> default to the first commodity; otherwise use the
  // stored selection filtered to what's still visible (may be empty).
  const activeKeys = useMemo(() => {
    if (sv.keys === undefined) {
      return commodities[0] ? [commodities[0].key] : [];
    }
    return sv.keys.filter((k) => commodities.some((c) => c.key === k));
  }, [sv.keys, commodities]);
  const setKeys = (next: string[]) => setSv({ keys: next });

  const labelOf = (k: string) =>
    commodities.find((c) => c.key === k)?.label ?? k;

  const years = yearsOfData(records);
  const confidence = confidenceLabel(years);

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const multi = activeKeys.length > 1;

  // Per commodity: a stable colour + its months-by-year data. Drives the
  // overlay (one colour per commodity; current year solid, previous dotted).
  const overlayByKey = useMemo(
    () => activeKeys.map((k, ci) => ({
      key: k,
      label: labelOf(k),
      color: SERIES_COLORS[ci % SERIES_COLORS.length],
      by: monthlyByYear(records, k),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, activeKeys]
  );
  const patternByKey = useMemo(
    () => activeKeys.map((k) => ({
      key: k, label: labelOf(k), idx: seasonalIndex(records, k),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, activeKeys]
  );

  // Any commodity with at least one year of data → chart is renderable.
  const hasOverlayData = overlayByKey.some((o) => o.by.size > 0);

  const overlayOption = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      data: overlayByKey.map((o) => o.label),
      textStyle: { color: axisColor }, top: 0,
    },
    xAxis: {
      type: 'category',
      data: MONTHS,
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    // For each commodity, one line per year in its own colour; the latest
    // year is solid, earlier years dotted. Series share the commodity name
    // so the legend shows one toggle per commodity.
    series: overlayByKey.flatMap((o) => {
      const yrs = [...o.by.keys()].sort();
      const latest = yrs[yrs.length - 1];
      return yrs.map((y) => ({
        name: o.label,
        type: 'line',
        data: o.by.get(y),
        smooth: true,
        connectNulls: false,
        symbol: 'none',
        lineStyle: {
          color: o.color,
          width: y === latest ? 2.5 : 1.5,
          type: y === latest ? 'solid' : 'dotted',
        },
        itemStyle: { color: o.color },
      }));
    }),
  };

  const patternData = (idx: Map<number, number>) =>
    MONTHS.map((_, i) => {
      const v = idx.get(i + 1);
      return v == null ? null : Number(v.toFixed(2));
    });

  const seasonalOption = {
    grid: { left: 8, right: 16, top: multi ? 28 : 8, bottom: 8,
      containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) =>
        v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    },
    legend: multi
      ? { data: patternByKey.map((p) => p.label), textStyle:
        { color: axisColor }, top: 0 }
      : undefined,
    xAxis: {
      type: 'category',
      data: MONTHS,
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%', color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: multi
      ? patternByKey.map((p, ci) => ({
        name: p.label,
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: patternData(p.idx),
        lineStyle: { color: SERIES_COLORS[ci % SERIES_COLORS.length], width: 2 },
        itemStyle: { color: SERIES_COLORS[ci % SERIES_COLORS.length] },
      }))
      : [{
        type: 'bar',
        barMaxWidth: 22,
        data: MONTHS.map((_, i) => {
          const v = patternByKey[0]?.idx.get(i + 1);
          if (v == null) return null;
          return {
            value: Number(v.toFixed(2)),
            itemStyle: {
              color: v <= -0.05 ? '#e24b4a' : v >= 0.05 ? '#16a34a' : axisColor,
              borderRadius: 3,
            },
          };
        }),
      }],
  };

  const confTone = years >= 3
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['seasonal']} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${confTone}`}>
            confidence: {confidence}
          </span>
          <MultiSelect
            label="Commodities"
            options={commodities.map((c) => ({ value: c.key, label: c.label }))}
            selected={activeKeys}
            onChange={setKeys}
          />
          <PrintButton />
        </div>
      </div>

      {activeKeys.length === 0 ? (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
          text-center">
          Select one or more commodities to see their seasonal patterns.
        </div>
      ) : !hasOverlayData ? (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
          text-center">No history yet for seasonal analysis.</div>
      ) : (
       <>
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2">
          Year-over-year overlay
          <span className="font-normal text-zinc-400">
            {' · '}absolute price · solid = current year · dotted = previous
          </span>
        </h3>
        <ReactECharts option={overlayOption} opts={{ renderer: 'svg' }}
          notMerge style={{ height: 320, width: '100%' }} />
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2">
          Typical seasonal pattern · avg month-over-month change
          {multi ? ' · one line per commodity' : ''}
        </h3>
        <ReactECharts option={seasonalOption} opts={{ renderer: 'svg' }}
          notMerge style={{ height: 260, width: '100%' }} />
        {years < 3 && (
          <p className="text-xs text-zinc-400 mt-2">
            Based on {years} year{years > 1 ? 's' : ''} of data — treat the
            seasonal pattern as indicative, not definitive.
          </p>
        )}
      </div>
       </>
      )}
    </div>
  );
}
