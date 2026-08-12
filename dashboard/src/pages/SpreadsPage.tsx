import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  effectiveCommodities,
  monthlySpread,
  meanStd,
  monthKeyLabel,
  type PriceRecord,
} from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import { useViewState } from '../hooks/useViewState';
import { ReportIntro } from '../components/ReportIntro';
import { InfoTip } from '../components/InfoTip';
import { PrintButton } from '../components/PrintButton';
import { MultiSelect } from '../components/MultiSelect';
import { SERIES_COLORS } from '../lib/chartColors';
import { REPORT_HELP } from '../lib/help';

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const SPREADS_DEFAULTS: { reference: string; compare: string[] } = {
  reference: 'pig_iron_foundry_gr_pune',
  compare: ['melting_foundry_scrap_mumbai'],
};

export function SpreadsPage(
  { records, isDark }: { records: PriceRecord[]; isDark: boolean }
) {
  const { settings } = useUserSettings();
  const commodities = useMemo(
    () => effectiveCommodities('spreads', settings.personalization),
    [settings.personalization]
  );
  const has = (k: string) => commodities.some((c) => c.key === k);
  const labelOf = (k: string) =>
    commodities.find((c) => c.key === k)?.label ?? k;

  const { value: sv, setValue: setSv } = useViewState(
    'spreads', SPREADS_DEFAULTS
  );
  const reference = has(sv.reference ?? '')
    ? (sv.reference as string)
    : (commodities[0]?.key ?? '');
  const compare = useMemo(() => {
    const valid = (sv.compare ?? []).filter(has);
    if (valid.length) return valid;
    const first = commodities.find((c) => c.key !== reference)?.key
      ?? commodities[0]?.key;
    return first ? [first] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sv.compare, commodities, reference]);
  const setReference = (k: string) => setSv({ reference: k });
  const setCompare = (next: string[]) => setSv({ compare: next });

  const single = compare.length === 1;

  // One spread series (Aᵢ − reference) per compared commodity.
  const perCompare = useMemo(
    () => compare.map((a) => ({
      key: a, label: labelOf(a), sp: monthlySpread(records, a, reference),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, compare, reference]
  );
  const allMonths = useMemo(
    () => Array.from(
      new Set(perCompare.flatMap((pc) => [...pc.sp.keys()]))
    ).sort(),
    [perCompare]
  );

  // Stats only meaningful for a single pair.
  const primaryValues = single
    ? allMonths
      .map((m) => perCompare[0].sp.get(m))
      .filter((v): v is number => v != null)
    : [];
  const { mean, std } = single ? meanStd(primaryValues) : { mean: 0, std: 0 };
  const latest = primaryValues.length
    ? primaryValues[primaryValues.length - 1] : null;
  const z = single && latest !== null && std > 0 ? (latest - mean) / std : null;
  const deviates = z !== null && Math.abs(z) >= 2;
  const refLabel = labelOf(reference);

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.18)';
  const option = {
    grid: { left: 8, right: 16, top: single ? 16 : 28, bottom: 8,
      containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: single ? undefined
      : { data: perCompare.map((p) => p.label), textStyle:
        { color: axisColor }, top: 0 },
    xAxis: {
      type: 'category',
      data: allMonths.map(monthKeyLabel),
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: perCompare.map((pc, i) => {
      const color = single ? '#2563eb' : SERIES_COLORS[i % SERIES_COLORS.length];
      return {
        name: pc.label,
        type: 'line',
        data: allMonths.map((m) => {
          const v = pc.sp.get(m);
          return v == null ? null : Number(v.toFixed(2));
        }),
        smooth: true,
        connectNulls: false,
        symbol: 'none',
        lineStyle: { color, width: single ? 2.5 : 2 },
        itemStyle: { color },
        markLine: single ? {
          symbol: 'none',
          data: [{ yAxis: Number(mean.toFixed(2)), name: 'mean' }],
          lineStyle: { color: axisColor, type: 'dashed' },
          label: { color: axisColor, formatter: 'mean' },
        } : undefined,
        markArea: single && std > 0 ? {
          itemStyle: { color: 'rgba(37,99,235,0.08)' },
          data: [[
            { yAxis: Number((mean - std).toFixed(2)) },
            { yAxis: Number((mean + std).toFixed(2)) },
          ]],
        } : undefined,
      };
    }),
  };

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['spreads']} />
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {single
            ? `${labelOf(compare[0])} − ${refLabel}, monthly, mean ±1σ band`
            : `Spreads vs ${refLabel}, monthly`}
        </p>
        <div className="flex items-center gap-2">
          <MultiSelect
            label="Compare"
            options={commodities.map((c) => ({ value: c.key, label: c.label }))}
            selected={compare}
            onChange={setCompare}
          />
          <span className="text-zinc-400">vs</span>
          <select value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
              dark:border-zinc-700 rounded-md py-2 px-2 text-sm">
            {commodities.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto"><PrintButton /></div>
      </div>

      {allMonths.length < 2 ? (
        <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
          text-center">
          Not enough overlapping history for this selection.
        </div>
      ) : (
        <>
          {single && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Latest spread', value: latest !== null
                  ? fmt(latest) : '—', tip: 'Spread' as const },
                { label: 'Mean', value: fmt(mean), tip: undefined },
                { label: 'Std dev', value: fmt(std), tip: undefined },
                { label: 'Deviation', value: z !== null
                  ? `${z > 0 ? '+' : ''}${z.toFixed(1)}σ` : '—',
                tone: deviates ? 'text-amber-600 dark:text-amber-400' : '',
                tip: 'Deviation (σ)' as const },
              ].map((t) => (
                <div key={t.label} className="bg-zinc-50 dark:bg-zinc-800/60
                  rounded-lg p-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400
                    flex items-center gap-1">
                    {t.label}{t.tip && <InfoTip term={t.tip} />}</p>
                  <p className={`text-2xl font-semibold mt-1 ${t.tone ||
                    'text-zinc-900 dark:text-zinc-100'}`}>{t.value}</p>
                </div>
              ))}
            </div>
          )}

          {single && deviates && (
            <div className="rounded-lg border border-amber-200
              dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3
              text-sm text-amber-700 dark:text-amber-300">
              The current spread is {Math.abs(z!).toFixed(1)}σ from its norm —
              an unusual {labelOf(compare[0])}/{refLabel} relationship worth a
              look.
            </div>
          )}

          <div className="bg-white dark:bg-zinc-800 rounded-lg border
            border-zinc-200 dark:border-zinc-700 p-4">
            <ReactECharts option={option} opts={{ renderer: 'svg' }}
              style={{ height: 340, width: '100%' }} />
          </div>
        </>
      )}
    </div>
  );
}
