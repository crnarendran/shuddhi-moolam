import { useEffect, useState } from 'react';
import { Sliders, Building2, ShieldCheck } from 'lucide-react';
import { SettingsPage } from '../pages/SettingsPage';
import { CompaniesPage } from '../pages/CompaniesPage';
import { AdminPage } from '../pages/AdminPage';
import { SubTabs, type SubTab } from './SubTabs';
import { useIsAdmin } from '../hooks/usePlan';
import { type PriceRecord } from '../lib/reporting';

type SettingsSub = 'commodities' | 'companies' | 'admin';

const BASE_TABS: SubTab<SettingsSub>[] = [
  { id: 'companies', label: 'Companies & Materials', icon: Building2 },
  { id: 'commodities', label: 'Commodities', icon: Sliders },
];
const ADMIN_TAB: SubTab<SettingsSub> = {
  id: 'admin', label: 'Admin', icon: ShieldCheck,
};

/**
 * Read the settings sub-tab from the URL hash. Companies & Materials is the
 * default landing tab (`#settings`); `#settings/commodities` and
 * `#settings/admin` select the others.
 */
function subFromHash(): SettingsSub {
  const s = window.location.hash.split('/')[1];
  if (s === 'commodities') return 'commodities';
  if (s === 'admin') return 'admin';
  return 'companies';
}

/**
 * The unified Settings section (SM-36): one place for all configuration.
 * Sub-tabs — company/material management, commodity preferences, and (for
 * founders only) the Admin plans panel (SM-42). Sub-tab is reflected in the
 * URL hash so it survives refresh and is shareable.
 * @param props Latest price records (for the companies/materials
 *   blended-cost preview).
 */
export function SettingsSection(
  { records }: { records: PriceRecord[] }
) {
  const isAdmin = useIsAdmin();
  const [sub, setSub] = useState<SettingsSub>(subFromHash);
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  useEffect(() => {
    const onHash = () => setSub(subFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: SettingsSub) => {
    setSub(id);
    window.location.hash = `settings/${id}`;
  };

  // A non-admin landing on #settings/admin falls back to companies.
  const active: SettingsSub = sub === 'admin' && !isAdmin ? 'companies' : sub;

  return (
    <div className="flex flex-col gap-6">
      <SubTabs tabs={tabs} active={active} onSelect={select} />
      {active === 'companies' && <CompaniesPage records={records} />}
      {active === 'commodities' && <SettingsPage />}
      {active === 'admin' && isAdmin && <AdminPage />}
    </div>
  );
}
