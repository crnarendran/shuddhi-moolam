import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  effectiveCommodities,
  MONTHS,
  monthlyByYear,
  seasonalIndex,
  yearsOfData,
  confidenceLabel,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import { useViewState } from '../hooks/useViewState';
import { ReportIntro } from '../components/ReportIntro';
import { PrintButton } from '../components/PrintButton';
import { MultiSelect } from '../components/MultiSelect';
import { SERIES_COLORS } from '../lib/chartColors';
import { REPORT_HELP } from '../lib/help';

const SEASONAL_DEFAULTS: { keys: string[] } = { keys: [] };

export function SeasonalPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { settings } = useUserSettings();
  const commodities = useMemo(
    () => effectiveCommodities('seasonal', settings.personalization),
    [settings.personalization]
  );

  const { value: sv, setValue: setSv } = useViewState(
    'seasonal', SEASONAL_DEFAULTS
  );
  // Render-time selection: always a valid, non-empty subset of the effective
  // commodities (falls back to the first) without rewriting storage.
  const activeKeys = useMemo(() => {
    const valid = (sv.keys ?? []).filter(
      (k) => commodities.some((c) => c.key === k)
    );
    if (valid.length) return valid;
    return commodities[0] ? [commodities[0].key] : [];
  }, [sv.keys, commodities]);
  const setKeys = (next: string[]) => setSv({ keys: next });

  const primary = activeKeys[0];
  const labelOf = (k: string) =>
    commodities.find((c) => c.key === k)?.label ?? k;

  const years = yearsOfData(records);
  const confidence = confidenceLabel(years);

  const byYear = useMemo(
    () => monthlyByYear(records, primary), [records, primary]
  );
  const patternByKey = useMemo(
    () => activeKeys.map((k) => ({
      key: k, label: labelOf(k), idx: seasonalIndex(records, k),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, activeKeys]
  );

  const yearKeys = [...byYear.keys()].sort();
  const latestYear = yearKeys[yearKeys.length - 1];
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const multi = activeKeys.length > 1;

  const overlayOption = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { data: yearKeys.map(String), textStyle: { color: axisColor }, top: 0 },
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
    series: yearKeys.map((y) => ({
      name: String(y),
      type: 'line',
      data: byYear.get(y),
      smooth: true,
      connectNulls: false,
      symbol: 'none',
      lineStyle:
        y === latestYear
          ? { color: '#2563eb', width: 3 }
          : { color: axisColor, width: 1.5, type: 'dashed' },
      itemStyle: { color: y === latestYear ? '#2563eb' : axisColor },
    })),
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

  if (yearKeys.length === 0) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">No history yet for seasonal analysis.</div>
    );
  }

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

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2">
          Year-over-year overlay
          <span className="font-normal text-zinc-400">
            {' · '}{labelOf(primary)}
            {multi ? ' (first selection)' : ''}
          </span>
        </h3>
        <ReactECharts option={overlayOption} opts={{ renderer: 'svg' }}
          style={{ height: 320, width: '100%' }} />
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
        dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200
          mb-2">
          Typical seasonal pattern · avg month-over-month change
          {multi ? ' · one line per commodity' : ''}
        </h3>
        <ReactECharts option={seasonalOption} opts={{ renderer: 'svg' }}
          style={{ height: 260, width: '100%' }} />
        {years < 3 && (
          <p className="text-xs text-zinc-400 mt-2">
            Based on {years} year{years > 1 ? 's' : ''} of data — treat the
            seasonal pattern as indicative, not definitive.
          </p>
        )}
      </div>
    </div>
  );
}
