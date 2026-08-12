import { useEffect, useState } from 'react';
import { Sliders, Building2 } from 'lucide-react';
import { SettingsPage } from '../pages/SettingsPage';
import { CompaniesPage } from '../pages/CompaniesPage';
import { SubTabs, type SubTab } from './SubTabs';
import { type PriceRecord } from '../lib/reporting';

type SettingsSub = 'commodities' | 'companies';

const SETTINGS_TABS: SubTab<SettingsSub>[] = [
  { id: 'companies', label: 'Companies & Materials', icon: Building2 },
  { id: 'commodities', label: 'Commodities', icon: Sliders },
];

/**
 * Read the settings sub-tab from the URL hash. Companies & Materials is the
 * default landing tab (`#settings`); `#settings/commodities` selects the
 * commodity preferences.
 */
function subFromHash(): SettingsSub {
  return window.location.hash.split('/')[1] === 'commodities'
    ? 'commodities'
    : 'companies';
}

/**
 * The unified Settings section (SM-36): one place for all configuration,
 * split into two sub-tabs — company/material management and commodity
 * preferences. Sub-tab is reflected in the URL hash so it survives refresh
 * and is shareable.
 * @param props Latest price records (for the companies/materials
 *   blended-cost preview).
 */
export function SettingsSection(
  { records }: { records: PriceRecord[] }
) {
  const [sub, setSub] = useState<SettingsSub>(subFromHash);

  useEffect(() => {
    const onHash = () => setSub(subFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: SettingsSub) => {
    setSub(id);
    window.location.hash = id === 'companies' ? 'settings/companies'
      : 'settings/commodities';
  };

  return (
    <div className="flex flex-col gap-6">
      <SubTabs tabs={SETTINGS_TABS} active={sub} onSelect={select} />
      {sub === 'companies'
        ? <CompaniesPage records={records} />
        : <SettingsPage />}
    </div>
  );
}
