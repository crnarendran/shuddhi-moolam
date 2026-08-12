import { useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { COMMODITIES, type Commodity } from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import {
  type Personalization,
  type ReportId,
} from '../lib/userSettings';
import { ReportIntro } from '../components/ReportIntro';
import { REPORT_HELP } from '../lib/help';

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'price-review', label: 'Price Review' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'cost-impact', label: 'Cost Impact' },
  { id: 'spreads', label: 'Spreads' },
];

const CATEGORY_ORDER = [
  'Domestic Prices', 'Melting Scrap', 'Raw Material',
  'Ferro Alloys', 'Raipur Local', 'Coke Ex-Plant',
];

/** Groups commodities by category in a stable, domain-sensible order. */
function groupByCategory(list: Commodity[]): [string, Commodity[]][] {
  const map = new Map<string, Commodity[]>();
  for (const c of list) {
    const arr = map.get(c.category) ?? [];
    arr.push(c);
    map.set(c.category, arr);
  }
  return [...map.entries()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a[0]);
    const ib = CATEGORY_ORDER.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

const tierBadge = (tier: string) =>
  tier === 'extended'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

export function SettingsPage() {
  const { settings, update, signedIn } = useUserSettings();
  const p: Personalization =
    settings.personalization ?? { globalExcluded: [], reports: {} };

  const grouped = useMemo(() => groupByCategory(COMMODITIES), []);
  const allKeys = useMemo(() => COMMODITIES.map((c) => c.key), []);
  const globalExcluded = new Set(p.globalExcluded);
  const allowed = COMMODITIES.filter((c) => !globalExcluded.has(c.key));
  const shownGlobal = COMMODITIES.length - globalExcluded.size;

  const save = (next: Personalization) =>
    void update({ personalization: next });

  const toggleGlobal = (key: string) => {
    const set = new Set(p.globalExcluded);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    save({ ...p, globalExcluded: [...set] });
  };
  const setGlobal = (keys: string[]) => save({ ...p, globalExcluded: keys });

  const toggleReport = (reportId: ReportId, key: string) => {
    const cur = new Set(p.reports[reportId]?.excluded ?? []);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    save({
      ...p,
      reports: { ...p.reports, [reportId]: { excluded: [...cur] } },
    });
  };

  if (!signedIn) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Sign in to customise which commodities appear in your reports.
      </div>
    );
  }

  const bulkBtn =
    'text-xs px-2.5 py-1 rounded-md border border-zinc-300 ' +
    'dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 ' +
    'hover:bg-zinc-100 dark:hover:bg-zinc-800';

  return (
    <div className="flex flex-col gap-8">
      <ReportIntro help={REPORT_HELP['settings']} />
      {/* Global exclusions */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900
              dark:text-zinc-100">Commodities</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Hide a commodity everywhere. {shownGlobal} of{' '}
              {COMMODITIES.length} shown.
            </p>
          </div>
          <div className="flex gap-2">
            <button className={bulkBtn} onClick={() => setGlobal([])}>
              Show all
            </button>
            <button className={bulkBtn}
              onClick={() => setGlobal(allKeys)}>Hide all</button>
            <button className={bulkBtn}
              onClick={() => setGlobal(
                COMMODITIES.filter((c) => c.tier !== 'core').map((c) => c.key)
              )}>Core only</button>
          </div>
        </div>

        {grouped.map(([category, items]) => (
          <div key={category} className="bg-white dark:bg-zinc-800 rounded-lg
            border border-zinc-200 dark:border-zinc-700 p-3">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400
              mb-2">{category}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((c) => {
                const hidden = globalExcluded.has(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleGlobal(c.key)}
                    className={`flex items-center gap-1.5 text-sm px-2.5 py-1
                      rounded-md border transition-colors ${hidden
                        ? 'border-zinc-200 dark:border-zinc-700 ' +
                          'text-zinc-400 dark:text-zinc-500'
                        : 'border-zinc-300 dark:border-zinc-600 ' +
                          'text-zinc-800 dark:text-zinc-100 ' +
                          'bg-zinc-50 dark:bg-zinc-900'}`}
                  >
                    {hidden
                      ? <EyeOff className="h-3.5 w-3.5" />
                      : <Eye className="h-3.5 w-3.5" />}
                    {c.label}
                    {c.tier === 'extended' && (
                      <span className={`text-[10px] px-1 rounded
                        ${tierBadge(c.tier)}`}>ext</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Per-report exclusions */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Per report
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Hide more within a single report. Only globally-shown commodities
            can be toggled here.
          </p>
        </div>
        {REPORTS.map((r) => {
          const excluded = new Set(p.reports[r.id]?.excluded ?? []);
          const shown = allowed.filter((c) => !excluded.has(c.key)).length;
          return (
            <div key={r.id} className="bg-white dark:bg-zinc-800 rounded-lg
              border border-zinc-200 dark:border-zinc-700 p-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200
                mb-2">{r.label}
                <span className="text-xs font-normal text-zinc-400 ml-2">
                  showing {shown} of {allowed.length}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {allowed.map((c) => {
                  const hidden = excluded.has(c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleReport(r.id, c.key)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1
                        rounded-md border ${hidden
                          ? 'border-zinc-200 dark:border-zinc-700 ' +
                            'text-zinc-400 dark:text-zinc-500'
                          : 'border-zinc-300 dark:border-zinc-600 ' +
                            'text-zinc-800 dark:text-zinc-100'}`}
                    >
                      {hidden
                        ? <EyeOff className="h-3 w-3" />
                        : <Eye className="h-3 w-3" />}
                      {c.label}
                    </button>
                  );
                })}
                {allowed.length === 0 && (
                  <span className="text-xs text-zinc-400">
                    All commodities are hidden globally.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
