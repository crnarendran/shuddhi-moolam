import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ShieldCheck, RefreshCw, Database, FlaskConical } from 'lucide-react';
import { functions, fnName } from '../firebase';
import { type Plan, FOUNDER_EMAILS } from '../hooks/usePlan';

interface UserRow { uid: string; email: string; plan: Plan; lastSignIn: string | null }

// Test PDFs (SM-55 extraction probe). 29/06 is the 16.7 MB File-API case;
// the rest are ~1.3 MB inline cases used as controls.
const PROBE_FILES: { id: string; label: string }[] = [
  { id: '10CZ2_V7xWN8aTV5T2SSdb1kg0IiI1qg3', label: 'MMRW29062026 (16.7MB)' },
  { id: '17unkcTdtZBm7drnoxrX_NJp7hKXlXkOG', label: 'MMRW25052026 (1.4MB)' },
  { id: '1UW7N5xJx0Ie2V2u3F6CMtswbg4u0Ghfe', label: 'MMRW18052026 (1.2MB)' },
  { id: '1sLFtJ_EHgPIitDHIGImJifiLvalkP60B', label: 'MMRW11052026 (1.3MB)' },
  { id: '1o7pBMTZSvKeoTYw55PNanjvYazEniDPd', label: 'MMRW04052026 (1.5MB)' },
];

interface ProbeRun {
  run: number;
  route: string;
  watched: Record<string, string>;
  totalTokens: number;
  thinkingTokens: number;
}
interface ProbeResult {
  filename: string; sizeMb: number; thinkingBudget: number;
  forceInline: boolean; runs: number; model?: string; results: ProbeRun[];
}

/**
 * Founder-only admin panel (SM-42): list every user with their plan and
 * grant/revoke premium inline. Backed by admin-only callables (rules + the
 * callables both enforce founder-only).
 */
export function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [probeFileId, setProbeFileId] = useState(PROBE_FILES[0].id);
  const [probeBudget, setProbeBudget] = useState(1024);
  const [probeRuns, setProbeRuns] = useState(2);
  const [probeModel, setProbeModel] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const fn = httpsCallable<unknown, { users: UserRow[] }>(
        functions, fnName('listUserPlans')
      );
      const r = await fn({});
      setUsers(r.data.users);
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Could not load users.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const seed = async () => {
    if (!confirm(
      'Copy ALL prod companies + materials into the staging and dev ' +
      'partitions? Test companies with the same ids are overwritten. ' +
      'Prod is not modified.'
    )) return;
    setSeeding(true); setSeedMsg(null); setErr(null);
    try {
      const fn = httpsCallable<unknown, {
        results: { target: string; companies: number; materials: number }[];
      }>(functions, fnName('seedEnvData'));
      const r = await fn({});
      setSeedMsg(r.data.results
        .map((x) => `${x.target}: ${x.companies} companies, ` +
          `${x.materials} materials`)
        .join(' · '));
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Seed failed.');
    }
    setSeeding(false);
  };

  const runProbe = async () => {
    setProbing(true); setProbeResult(null); setErr(null);
    try {
      const fn = httpsCallable<
        { fileId: string; thinkingBudget: number; runs: number; model?: string },
        ProbeResult
      >(functions, fnName('probeExtraction'), { timeout: 540000 });
      const r = await fn({
        fileId: probeFileId, thinkingBudget: probeBudget, runs: probeRuns,
        model: probeModel.trim() || undefined,
      });
      setProbeResult(r.data);
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Probe failed.');
    }
    setProbing(false);
  };

  const setPlan = async (email: string, plan: Plan) => {
    setBusy(email); setErr(null);
    try {
      await httpsCallable<{ email: string; plan: Plan }, unknown>(
        functions, fnName('setUserPlan')
      )({ email, plan });
      await load();
    } catch (e) {
      setErr((e as { message?: string }).message ?? 'Could not update plan.');
    }
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100
            flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />Admin · Plans</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Every user who has signed in, with their plan. Premium unlocks
            creating own companies & materials. Founders are always premium.
          </p>
        </div>
        <button onClick={() => void load()}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md
            border border-zinc-300 dark:border-zinc-700 text-zinc-600
            dark:text-zinc-300">
          <RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700
        p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100
            flex items-center gap-2">
            <Database className="h-4 w-4" />Seed test data from prod</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            Copy every prod company + its materials into the staging and dev
            partitions so you can test with real data. Companies you don't own
            are shared to you read-only, so they show in the view switcher.
            Upserts by id (safe to re-run to refresh); prod is never modified.
          </p>
          {seedMsg && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Done — {seedMsg}
            </p>
          )}
        </div>
        <button onClick={() => void seed()} disabled={seeding}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md
            bg-blue-600 text-white disabled:opacity-50 whitespace-nowrap">
          <Database className="h-4 w-4" />
          {seeding ? 'Copying…' : 'Copy prod → staging & dev'}
        </button>
      </div>

      {/* Extraction probe (SM-55): re-run Gemini extraction on a test PDF with
          a chosen thinking budget, read-only (never writes to the Sheet). */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700
        p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100
            flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />Extraction probe</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Re-run extraction on a test PDF and inspect the confusable fields —
            no writes to the Sheet. Compare thinking budgets and check run-to-run
            consistency. (The Drive service account must be able to read the file.)
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-500 dark:text-zinc-400
            flex flex-col gap-1">PDF
            <select value={probeFileId}
              onChange={(e) => setProbeFileId(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
                dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm min-w-[200px]">
              {PROBE_FILES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500 dark:text-zinc-400
            flex flex-col gap-1">Thinking budget
            <select value={probeBudget}
              onChange={(e) => setProbeBudget(Number(e.target.value))}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
                dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm">
              <option value={1024}>1024 (current)</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500 dark:text-zinc-400
            flex flex-col gap-1">Runs
            <input type="number" min={1} max={4} value={probeRuns}
              onChange={(e) => setProbeRuns(Number(e.target.value))}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
                dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm w-16" />
          </label>
          <label className="text-xs text-zinc-500 dark:text-zinc-400
            flex flex-col gap-1">Model (blank = default)
            <input type="text" list="probe-models" value={probeModel}
              onChange={(e) => setProbeModel(e.target.value)}
              placeholder="gemini-3.6-flash"
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300
                dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm w-52" />
            <datalist id="probe-models">
              <option value="gemini-3.6-flash" />
              <option value="gemini-3.6-pro" />
              <option value="gemini-3.1-pro" />
            </datalist>
          </label>
          <button onClick={() => void runProbe()} disabled={probing}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md
              bg-blue-600 text-white disabled:opacity-50 whitespace-nowrap">
            <FlaskConical className="h-4 w-4" />
            {probing ? 'Running…' : 'Run probe'}
          </button>
        </div>
        {probing && (
          <p className="text-xs text-zinc-400">
            Extracting {probeRuns}× — this can take up to a few minutes…</p>
        )}
        {probeResult && (
          <div className="overflow-x-auto">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              {probeResult.filename} · {probeResult.sizeMb} MB · budget{' '}
              {probeResult.thinkingBudget} · {probeResult.model}
            </p>
            <table className="text-xs border-collapse">
              <thead className="text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-2 py-1 text-left">run</th>
                  <th className="px-2 py-1 text-left">route</th>
                  {Object.keys(probeResult.results[0]?.watched ?? {}).map((k) => (
                    <th key={k} className="px-2 py-1 text-right">
                      {k.replace(/_mumbai|_pune|_mumbai_pune/g, '')
                        .replace(/_/g, ' ')}</th>
                  ))}
                  <th className="px-2 py-1 text-right">tokens</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800 dark:text-zinc-100">
                {probeResult.results.map((r) => (
                  <tr key={r.run} className="border-t border-zinc-100
                    dark:border-zinc-800">
                    <td className="px-2 py-1">{r.run}</td>
                    <td className="px-2 py-1">{r.route}</td>
                    {Object.values(r.watched).map((v, i) => (
                      <td key={i} className="px-2 py-1 text-right tabular-nums">
                        {String(v)}</td>
                    ))}
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.totalTokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200
        dark:border-zinc-700">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500 dark:text-zinc-400
            bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200
            dark:border-zinc-700">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Last sign-in</th>
              <th className="px-4 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center
                text-zinc-400">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center
                text-zinc-400">No users yet.</td></tr>
            ) : users.map((u) => (
              <tr key={u.uid} className="border-b border-zinc-100
                dark:border-zinc-800">
                <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">
                  {u.email}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.plan === 'premium'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 ' +
                        'dark:text-green-300'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 ' +
                        'dark:text-zinc-300'}`}>{u.plan}</span>
                </td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  {u.lastSignIn
                    ? new Date(u.lastSignIn).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    disabled={busy === u.email || FOUNDER_EMAILS.includes(u.email.toLowerCase())}
                    onClick={() => void setPlan(
                      u.email, u.plan === 'premium' ? 'free' : 'premium'
                    )}
                    className="text-xs px-2 py-1 rounded-md border
                      border-zinc-300 dark:border-zinc-700 text-zinc-700
                      dark:text-zinc-200 disabled:opacity-50"
                    title={FOUNDER_EMAILS.includes(u.email.toLowerCase()) ? "Founders are always premium" : ""}
                  >
                    {u.plan === 'premium' ? 'Make free' : 'Make premium'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
