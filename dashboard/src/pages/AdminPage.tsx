import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { functions, fnName } from '../firebase';
import { type Plan, FOUNDER_EMAILS } from '../hooks/usePlan';

interface UserRow { uid: string; email: string; plan: Plan; lastSignIn: string | null }

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
