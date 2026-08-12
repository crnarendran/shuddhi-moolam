import { useState } from 'react';
import { Building2, ChevronDown, Eye, Check } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { useView } from '../context/ViewContext';

/**
 * Header "view as" switcher (SM-41): flip between the user's own workspace and
 * any company shared with them (read-only). Renders nothing when the user has
 * no shares, so it stays invisible for the common single-workspace case.
 */
export function ContextSwitcher() {
  const { shared: sharedCompanies } = useCompanies();
  const { shared, setShared } = useView();
  const [open, setOpen] = useState(false);

  if (sharedCompanies.length === 0) return null;
  const current = shared ? shared.companyName : 'My workspace';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm
          border transition-colors ${shared
            ? 'border-amber-400 text-amber-700 dark:text-amber-300 ' +
              'bg-amber-50 dark:bg-amber-900/20'
            : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 ' +
              'dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
      >
        {shared
          ? <Eye className="h-4 w-4 shrink-0" />
          : <Building2 className="h-4 w-4 shrink-0" />}
        <span className="max-w-[150px] truncate">{current}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-64 rounded-md border
            border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800
            shadow-lg py-1">
            <button
              onClick={() => { setShared(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm flex items-center
                justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700
                text-zinc-800 dark:text-zinc-100"
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />My workspace</span>
              {!shared && <Check className="h-4 w-4 text-blue-600" />}
            </button>
            <p className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-400
              uppercase tracking-wide">Shared with me</p>
            {sharedCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setShared({
                    companyId: c.id!, companyName: c.name,
                    ownerEmail: c.ownerEmail ?? '',
                  });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm flex items-center
                  justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700
                  text-zinc-800 dark:text-zinc-100"
              >
                <span className="min-w-0">
                  <span className="block truncate">{c.name}</span>
                  {c.ownerEmail && (
                    <span className="block text-xs text-zinc-400 truncate">
                      by {c.ownerEmail}</span>
                  )}
                </span>
                {shared?.companyId === c.id && (
                  <Check className="h-4 w-4 text-amber-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
