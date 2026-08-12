import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ShieldCheck } from 'lucide-react';
import { functions, fnName } from '../firebase';
import { type Plan } from '../hooks/usePlan';

interface SetPlanResult { success: boolean; uid: string; plan: Plan }

/**
 * Founder-only admin panel (SM-42): grant or revoke a user's premium plan by
 * email, without the CLI. Calls the admin-only setUserPlan callable; rules +
 * the callable both enforce that only founders can do this.
 */
export function AdminPage() {
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Plan>('premium');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  const apply = async () => {
    const to = email.trim().toLowerCase();
    if (!to) return;
    setBusy(true); setMsg(null); setErr(false);
    try {
      const fn = httpsCallable<{ email: string; plan: Plan }, SetPlanResult>(
        functions, fnName('setUserPlan')
      );
      const r = await fn({ email: to, plan });
      setMsg(`${to} is now on the ${r.data.plan} plan.`);
    } catch (e) {
      setErr(true);
      setMsg((e as { message?: string }).message ?? 'Could not update plan.');
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100
          flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />Admin · Plans</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Grant or revoke premium (the ability to create own companies &
          materials) by email. The user must have signed in at least once.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700
        p-4 flex flex-col gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          User email
          <input
            type="email" value={email} placeholder="user@email.com"
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full bg-zinc-50 dark:bg-zinc-900 border
              border-zinc-300 dark:border-zinc-700 rounded-md py-2 px-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Plan</span>
          {(['premium', 'free'] as Plan[]).map((p) => (
            <label key={p} className="flex items-center gap-1 capitalize
              text-zinc-700 dark:text-zinc-200">
              <input type="radio" name="plan" checked={plan === p}
                onChange={() => setPlan(p)} />{p}
            </label>
          ))}
        </div>
        <button
          onClick={() => void apply()} disabled={busy || !email.trim()}
          className="self-start px-4 py-2 rounded-md bg-blue-600 text-white
            text-sm disabled:opacity-50"
        >{busy ? 'Applying…' : 'Apply plan'}</button>
        {msg && (
          <p className={`text-sm ${err
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400'}`}>{msg}</p>
        )}
      </div>
    </div>
  );
}
