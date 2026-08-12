import { useEffect, useState } from 'react';
import { Sliders, Building2 } from 'lucide-react';
import { SettingsPage } from '../pages/SettingsPage';
import { CompaniesPage } from '../pages/CompaniesPage';
import { type PriceRecord } from '../lib/reporting';

type SubTab = 'commodities' | 'companies';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Sliders }[] = [
  { id: 'companies', label: 'Companies & Materials', icon: Building2 },
  { id: 'commodities', label: 'Commodities', icon: Sliders },
];

/**
 * Read the settings sub-tab from the URL hash. Companies & Materials is the
 * default landing tab (`#settings`); `#settings/commodities` selects the
 * commodity preferences.
 */
function subFromHash(): SubTab {
  return window.location.hash.split('/')[1] === 'commodities'
    ? 'commodities'
    : 'companies';
}

/**
 * The unified Settings section (SM-36): one place for all configuration,
 * split into two sub-tabs — commodity preferences and company/material
 * management. Sub-tab is reflected in the URL hash so it survives refresh
 * and is shareable.
 * @param props Latest price records (for the companies/materials
 *   blended-cost preview).
 */
export function SettingsSection(
  { records }: { records: PriceRecord[] }
) {
  const [sub, setSub] = useState<SubTab>(subFromHash);

  useEffect(() => {
    const onHash = () => setSub(subFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: SubTab) => {
    setSub(id);
    window.location.hash = id === 'companies' ? 'settings/companies'
      : 'settings';
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => select(id)}
            aria-current={sub === id ? 'page' : undefined}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium
              border-b-2 -mb-px transition-colors whitespace-nowrap ${
              sub === id
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 ' +
                  'dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {sub === 'companies'
        ? <CompaniesPage records={records} />
        : <SettingsPage />}
    </div>
  );
}
