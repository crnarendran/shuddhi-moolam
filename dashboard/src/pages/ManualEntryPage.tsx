import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { PencilLine, Save, Eraser, Search } from 'lucide-react';
import { db, functions, fnName } from '../firebase';
import { COMPONENTS } from '../lib/components';

const HISTORICAL =
  import.meta.env.VITE_HISTORICAL_COLLECTION || 'historical_prices';

/** dd/MM/yyyy → YYYY-MM-DD, or null if not a valid calendar date. */
function toDocId(date: string): string | null {
  const parts = date.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
  if ([dd, mm, yyyy].some((n) => Number.isNaN(n))) return null;
  if (yyyy < 2000 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return null;
  }
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd) return null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${yyyy}-${p2(mm)}-${p2(dd)}`;
}

/**
 * Manual price entry / correction — the "break glass" tool (SM-57). A data
 * editor loads a date, edits the per-kg values, and saves to BOTH the master
 * Sheet and Firestore. A saved date is marked manual and is not overwritten
 * by later automated extraction (until the override is cleared).
 */
export function ManualEntryPage() {
  const [date, setDate] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const docId = toDocId(date);

  const load = async () => {
    if (!docId) { setErr('Enter a valid date as dd/MM/yyyy.'); return; }
    setLoading(true); setErr(null); setMsg(null);
    try {
      const snap = await getDoc(doc(db, HISTORICAL, docId));
      const data = (snap.exists() ? snap.data() : {}) as
        Record<string, unknown>;
      const next: Record<string, string> = {};
      for (const c of COMPONENTS) {
        const v = data[c.key];
        next[c.key] = v === undefined || v === null ? '' : String(v);
      }
      setValues(next);
      setSource((data.source as string) ?? null);
      setLoaded(true);
      setMsg(snap.exists()
        ? `Loaded ${docId}${data.source === 'manual' ? ' (manual)' : ''}`
        : `No data for ${docId} yet — entering a new date.`);
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Load failed.');
    }
    setLoading(false);
  };

  const save = async () => {
    if (!docId) { setErr('Enter a valid date as dd/MM/yyyy.'); return; }
    // Only send non-empty cells (partial edits keep other fields).
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() !== '') payload[k] = v.trim();
    }
    if (Object.keys(payload).length === 0) {
      setErr('Enter at least one value.'); return;
    }
    if (!confirm(
      `Save manual prices for ${date}? This writes the master Sheet and ` +
      'the dashboard, and marks the date manual so automated extraction ' +
      'will not overwrite it.'
    )) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const fn = httpsCallable<
        { date: string; values: Record<string, string> },
        { docId: string; written: string[]; rejected: string[] }
      >(functions, fnName('manualUpsert'));
      const r = await fn({ date, values: payload });
      setSource('manual');
      setMsg(`Saved ${r.data.written.length} value(s) for ${r.data.docId}.`);
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Save failed.');
    }
    setSaving(false);
  };

  const clearOverride = async () => {
    if (!docId) return;
    if (!confirm(
      `Clear the manual override for ${date}? Automated extraction will be ` +
      'allowed to overwrite this date again. The current values stay until ' +
      'then.'
    )) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const fn = httpsCallable<
        { date: string; clearOverride: boolean },
        { restored?: boolean }
      >(functions, fnName('manualUpsert'));
      const r = await fn({ date, clearOverride: true });
      setSource('auto');
      // Reload so the restored auto values (and dropped badge) show.
      await load();
      setMsg(r.data.restored
        ? `Override cleared for ${docId}. Restored the automated values.`
        : `Override cleared for ${docId}. Auto extraction re-enabled ` +
          '(no prior automated value to restore).');
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Clear failed.');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100
          flex items-center gap-2">
          <PencilLine className="h-5 w-5" />Manual price entry
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
          Break-glass tool for when extraction fails or is wrong. Load a week,
          correct the per-kg values, and save — it updates the master Sheet
          and the dashboard, and marks the date manual so automated runs
          won't overwrite it. Values are ₹/kg (e.g. pig iron 47.5).
        </p>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Issue date (dd/MM/yyyy)
          </span>
          <input
            value={date}
            onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
            placeholder="18/05/2026"
            className="px-3 py-1.5 rounded-md border border-zinc-300
              dark:border-zinc-700 bg-white dark:bg-zinc-900 w-40"
          />
        </label>
        <button onClick={() => void load()} disabled={loading || !docId}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md
            border border-zinc-300 dark:border-zinc-700 text-zinc-700
            dark:text-zinc-200 disabled:opacity-50">
          <Search className="h-4 w-4" />{loading ? 'Loading…' : 'Load'}
        </button>
        {source === 'manual' && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100
            text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            manual override
          </span>
        )}
      </div>

      {loaded && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMPONENTS.map((c) => (
              <label key={c.key} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-300 truncate"
                  title={c.label}>{c.label}</span>
                <div className="flex items-center gap-1">
                  <input
                    value={values[c.key] ?? ''}
                    onChange={(e) => setValues((p) => ({
                      ...p, [c.key]: e.target.value,
                    }))}
                    inputMode="decimal"
                    className="px-2 py-1 rounded-md border border-zinc-300
                      dark:border-zinc-700 bg-white dark:bg-zinc-900 w-full"
                  />
                  <span className="text-xs text-zinc-400">₹/kg</span>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={() => void save()} disabled={saving}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md
                bg-blue-600 text-white disabled:opacity-50">
              <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save prices'}
            </button>
            {source === 'manual' && (
              <button onClick={() => void clearOverride()} disabled={saving}
                className="flex items-center gap-1 text-sm px-3 py-1.5
                  rounded-md border border-zinc-300 dark:border-zinc-700
                  text-zinc-700 dark:text-zinc-200 disabled:opacity-50">
                <Eraser className="h-4 w-4" />Clear override (re-enable auto)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
