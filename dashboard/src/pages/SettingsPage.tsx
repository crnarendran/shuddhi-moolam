import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Eye, EyeOff } from 'lucide-react';
import { auth } from '../firebase';
import { COMMODITIES, type Commodity } from '../lib/reporting';
import { useUserSettings } from '../hooks/useUserSettings';
import {
  type Personalization,
  type ReportId,
} from '../lib/userSettings';
import { ReportIntro } from '../components/ReportIntro';
import { REPORT_HELP } from '../lib/help';
import { trackEvent } from '../lib/analytics';

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

const ALERT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an optional guidance-alert contact email address.
 * @param {string} trimmed Trimmed email candidate (may be empty).
 * @returns {string | null} Validation error message, or null when valid.
 */
function validateAlertEmail(trimmed: string): string | null {
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    !ALERT_EMAIL_RE.test(trimmed) ||
    lower.endsWith('.gserviceaccount.com')
  ) {
    return 'Enter a valid non-service-account email address.';
  }
  return null;
}

/**
 * Groups commodities by category in a stable, domain-sensible order.
 * @param {Commodity[]} list All dashboard commodities.
 * @returns {[string, Commodity[]][]} Ordered [category, items] tuples.
 */
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

  const [alertEnabled, setAlertEnabled] = useState<boolean>(
    settings.guidanceAlerts?.enabled ?? false
  );
  const [alertEmail, setAlertEmail] = useState<string>(
    settings.guidanceAlerts?.email ?? ''
  );
  const [alertThreshold, setAlertThreshold] = useState<string>(
    String(settings.guidanceAlerts?.dipThresholdPct ?? 3)
  );
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAlertEnabled(settings.guidanceAlerts?.enabled ?? false);
    setAlertEmail(settings.guidanceAlerts?.email ?? '');
    setAlertThreshold(String(settings.guidanceAlerts?.dipThresholdPct ?? 3));
  }, [
    settings.guidanceAlerts?.enabled,
    settings.guidanceAlerts?.email,
    settings.guidanceAlerts?.dipThresholdPct,
  ]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const saveAlerts = async () => {
    const trimmedEmail = alertEmail.trim();
    const emailErr = validateAlertEmail(trimmedEmail);
    if (emailErr) {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setAlertSaved(false);
      setAlertError(emailErr);
      return;
    }

    const parsed = parseFloat(alertThreshold);
    const dipThresholdPct = Number.isFinite(parsed)
      ? Math.min(50, Math.max(1, parsed))
      : 3;
    const hadStoredEmail = Boolean(settings.guidanceAlerts?.email);
    const email = trimmedEmail
      ? trimmedEmail
      : hadStoredEmail
        ? ''
        : undefined;
    setAlertSaving(true);
    setAlertSaved(false);
    setAlertError(null);
    try {
      const ok = await update({
        guidanceAlerts: {
          enabled: alertEnabled,
          email,
          dipThresholdPct,
        },
      });
      if (ok) {
        setAlertThreshold(String(dipThresholdPct));
        setAlertSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setAlertSaved(false), 2500);
      } else {
        setAlertError('Could not save alert settings. Please try again.');
      }
    } catch {
      setAlertError('Could not save alert settings. Please try again.');
    } finally {
      setAlertSaving(false);
    }
  };

  const grouped = useMemo(() => groupByCategory(COMMODITIES), []);
  const allKeys = useMemo(() => COMMODITIES.map((c) => c.key), []);
  const globalExcluded = new Set(p.globalExcluded);
  const allowed = COMMODITIES.filter((c) => !globalExcluded.has(c.key));
  const shownGlobal = COMMODITIES.length - globalExcluded.size;

  const save = (next: Personalization) =>
    void update({ personalization: next });

  const toggleGlobal = (key: string) => {
    const set = new Set(p.globalExcluded);
    const willExclude = !set.has(key);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    void trackEvent('commodity_preference_toggled', {
      scope: 'global',
      commodity_key: key,
      action: willExclude ? 'hide' : 'show',
    });
    save({ ...p, globalExcluded: [...set] });
  };
  const setGlobal = (keys: string[]) => save({ ...p, globalExcluded: keys });

  const toggleReport = (reportId: ReportId, key: string) => {
    const cur = new Set(p.reports[reportId]?.excluded ?? []);
    const willExclude = !cur.has(key);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    void trackEvent('commodity_preference_toggled', {
      scope: reportId,
      commodity_key: key,
      action: willExclude ? 'hide' : 'show',
    });
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
  const inputCls =
    'bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 ' +
    'dark:border-zinc-700 rounded-md py-1.5 px-2.5 text-sm ' +
    'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 ' +
    'dark:placeholder:text-zinc-500';

  return (
    <div className="flex flex-col gap-8">
      <ReportIntro help={REPORT_HELP['settings']} />
      {/* Weekly guidance alerts (SM-70) */}
      <section
        className="bg-white dark:bg-zinc-800 rounded-lg border
          border-zinc-200 dark:border-zinc-700 p-4 flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-base font-semibold text-zinc-900
                dark:text-zinc-100 flex items-center gap-2"
            >
              <Bell
                aria-hidden="true"
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
              />
              Weekly guidance alerts
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Monday email digest when your materials show a cost dip vs prior
              quarter or an upcoming seasonal buying window.
            </p>
          </div>
          <label
            className="flex items-center gap-2 text-sm text-zinc-700
              dark:text-zinc-200 shrink-0 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(e) => setAlertEnabled(e.target.checked)}
              aria-label="Enable weekly guidance alerts"
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600
                text-blue-600"
            />
            Enabled
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-zinc-600
              dark:text-zinc-300">
              Contact email
            </span>
            <input
              type="email"
              aria-label="Guidance alert contact email"
              placeholder={auth.currentUser?.email || 'you@example.com'}
              value={alertEmail}
              onChange={(e) => {
                setAlertEmail(e.target.value);
                if (alertError) setAlertError(null);
              }}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1 w-36">
            <span className="text-xs font-medium text-zinc-600
              dark:text-zinc-300">
              Dip threshold (%)
            </span>
            <input
              type="number"
              min={1}
              max={50}
              step={0.5}
              aria-label="Guidance alert dip threshold percent"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={alertSaving}
              onClick={() => void saveAlerts()}
              aria-label="Save weekly guidance alerts"
              className="px-3.5 py-1.5 rounded-md text-sm font-medium
                bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                text-white transition-colors"
            >
              {alertSaving ? 'Saving…' : 'Save'}
            </button>
            {alertSaved && (
              <span
                role="status"
                className="text-xs font-medium text-emerald-600
                  dark:text-emerald-400"
              >
                Saved
              </span>
            )}
          </div>
        </div>
        {alertError && (
          <p
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            {alertError}
          </p>
        )}
      </section>
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
