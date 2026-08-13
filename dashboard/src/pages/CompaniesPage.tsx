import { useMemo, useState } from 'react';
import { Plus, Trash2, Building2, Package, Share2 } from 'lucide-react';
import {
  COMMODITIES, parseIssueDate, type PriceRecord,
} from '../lib/reporting';
import { useCompanies, useMaterials } from '../hooks/useCompanies';
import {
  blendedCost, massShares, totalGrams, type Material,
} from '../lib/materials';
import { ReportIntro } from '../components/ReportIntro';
import { SharePanel } from '../components/SharePanel';
import { useView } from '../context/ViewContext';
import { usePlan } from '../hooks/usePlan';
import { REPORT_HELP } from '../lib/help';

const fmt = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** The most recent price record (by dd/MM/yyyy), or null. */
function latestRecord(records: PriceRecord[]): PriceRecord | null {
  let best: PriceRecord | null = null;
  let bestKey = -1;
  for (const r of records) {
    const p = parseIssueDate(r.date);
    if (!p) continue;
    const k = p.year * 12 + p.month;
    if (k > bestKey) { bestKey = k; best = r; }
  }
  return best;
}

const labelOf = (key: string) =>
  COMMODITIES.find((c) => c.key === key)?.label ?? key;

const emptyMaterial = (): Material => ({
  name: '', unit: 'per kg',
  composition: [{ commodityKey: COMMODITIES[0].key, ratio: 1 }],
});

function MaterialEditor({
  initial, record, onSave, onCancel,
}: {
  initial: Material;
  record: PriceRecord | null;
  onSave: (m: Material) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<Material>(initial);
  const cost = blendedCost(m.composition, record);
  const shares = massShares(m.composition);
  const grams = totalGrams(m.composition);
  const setRow = (i: number, patch: Partial<{ commodityKey: string; ratio: number }>) =>
    setM({
      ...m,
      composition: m.composition.map((r, j) =>
        j === i ? { ...r, ...patch } : r),
    });
  const valid = m.name.trim() !== '' && m.composition.length > 0
    && m.composition.every((r) => Number.isFinite(r.ratio) && r.ratio > 0);

  const inputCls = 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 ' +
    'dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm';

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200
      dark:border-zinc-700 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} flex-1 min-w-[180px]`}
          placeholder="Material name (e.g. Ductile Iron GR-500)"
          value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
        <span className="flex items-center px-2 py-1.5 text-sm rounded-md
          border border-zinc-300 dark:border-zinc-700 bg-zinc-100
          dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400">per kg</span>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1">
        Amounts are grams of each commodity per <b>1 kg</b> of finished
        material — the base metallics plus trace additions (ferro-alloys,
        inoculants) that offset melting loss. The % is each commodity’s share
        of a kilogram; a recipe need not total 1000 g — the balance is melting
        loss / burn-off, not missing data.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase
          tracking-wide text-zinc-400">
          <span className="flex-1">Commodity</span>
          <span className="w-24 text-right">grams / kg</span>
          <span className="w-6" />
          <span className="w-12 text-right">% of kg</span>
        </div>
        {m.composition.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className={`${inputCls} flex-1`} value={r.commodityKey}
              onChange={(e) => setRow(i, { commodityKey: e.target.value })}>
              {COMMODITIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <input type="number" step="0.01" className={`${inputCls} w-24
              text-right`} value={r.ratio}
              onChange={(e) => setRow(i, { ratio: Number(e.target.value) })} />
            <button className="text-zinc-400 hover:text-red-500 p-1"
              onClick={() => setM({
                ...m,
                composition: m.composition.filter((_, j) => j !== i),
              })}>
              <Trash2 className="h-4 w-4" />
            </button>
            <span className="text-xs text-zinc-400 w-12 text-right">
              {shares[i].pct.toFixed(shares[i].pct < 1 ? 2 : 1)}%
            </span>
          </div>
        ))}
        <button className="self-start text-xs flex items-center gap-1
          text-blue-600 dark:text-blue-400"
          onClick={() => setM({
            ...m,
            composition: [...m.composition,
              { commodityKey: COMMODITIES[0].key, ratio: 1 }],
          })}>
          <Plus className="h-3.5 w-3.5" /> Add commodity
        </button>
        <p className="text-xs text-zinc-400">
          Total: {fmt(grams)} g charged per kg
          {grams < 1000 && (
            <span> — the {fmt(1000 - grams)} g balance to 1 kg is melting
              loss / burn-off</span>
          )}
        </p>
      </div>

      <div className="flex items-center justify-between border-t
        border-zinc-100 dark:border-zinc-700/50 pt-3">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Blended cost:{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {fmt(cost)}
          </span>
          <span className="text-xs ml-1">/ kg</span>
        </span>
        <div className="flex gap-2">
          <button className="text-sm px-3 py-1.5 rounded-md text-zinc-600
            dark:text-zinc-300" onClick={onCancel}>Cancel</button>
          <button disabled={!valid}
            className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white
              disabled:opacity-50"
            onClick={() => onSave(m)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export function CompaniesPage({ records }: { records: PriceRecord[] }) {
  const {
    companies, shared: sharedCompanies, signedIn, addCompany, deleteCompany,
  } = useCompanies();
  const { shared: viewShared } = useView();
  const { premium, loading: planLoading } = usePlan();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [sharingId, setSharingId] = useState<string | null>(null);
  const record = useMemo(() => latestRecord(records), [records]);

  const active = viewShared
    ? viewShared.companyId
    : selectedId ?? (companies.length ? companies[0].id ?? null : null);
  const { materials, saveMaterial, deleteMaterial } = useMaterials(active);
  const [editing, setEditing] = useState<Material | null>(null);

  if (!signedIn) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm py-12
        text-center">
        Sign in to manage companies and their materials.
      </div>
    );
  }

  // Read-only view of a company shared with the user (SM-41).
  if (viewShared) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900
            dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="h-5 w-5" />{viewShared.companyName}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Read-only · shared by {viewShared.ownerEmail || 'the owner'}
          </p>
        </div>
        {materials.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8">
            This company has no materials yet.
          </p>
        ) : materials.map((m) => {
          const cost = blendedCost(m.composition, record);
          return (
            <div key={m.id} className="bg-white dark:bg-zinc-800 rounded-lg
              border border-zinc-200 dark:border-zinc-700 p-3">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {m.name}
                <span className="text-xs font-normal text-zinc-400 ml-2">
                  {m.composition.length} commodities · {fmt(cost)} / kg
                </span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {m.composition
                  .map((r) => `${labelOf(r.commodityKey)} ${r.ratio}g`)
                  .join(' · ')}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // Free plan: creating your own companies/materials is premium (SM-42).
  if (!planLoading && !premium) {
    return (
      <div className="flex flex-col gap-4">
        <ReportIntro help={REPORT_HELP['companies']} />
        <div className="rounded-lg border border-amber-200
          dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-5">
          <h3 className="text-base font-semibold text-amber-800
            dark:text-amber-200 flex items-center gap-2">
            <Building2 className="h-5 w-5" />Creating companies is a premium
            feature</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Modelling your own companies and materials (BOMs) and generating
            guidance from them is available on a paid plan. Contact the team to
            get access.
          </p>
          {sharedCompanies.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
              You have {sharedCompanies.length} compan
              {sharedCompanies.length === 1 ? 'y' : 'ies'} shared with you —
              switch to {sharedCompanies.length === 1 ? 'it' : 'one'} using the
              <b> view selector</b> at the top right to see its materials and
              charts (read-only).
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportIntro help={REPORT_HELP['companies']} />
      <div className="grid md:grid-cols-[260px_1fr] gap-6">
      {/* Companies list */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100
          flex items-center gap-2"><Building2 className="h-5 w-5" />Companies</h2>
        <div className="flex gap-2">
          <input className="flex-1 bg-zinc-50 dark:bg-zinc-900 border
            border-zinc-300 dark:border-zinc-700 rounded-md py-1.5 px-2 text-sm"
            placeholder="New company" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                void addCompany(newName.trim()); setNewName('');
              }
            }} />
          <button className="px-2 rounded-md bg-blue-600 text-white"
            onClick={() => {
              if (newName.trim()) { void addCompany(newName.trim()); setNewName(''); }
            }}><Plus className="h-4 w-4" /></button>
        </div>
        {companies.length === 0 && (
          <p className="text-sm text-zinc-400">No companies yet.</p>
        )}
        {companies.map((c) => (
          <div key={c.id}
            className={`flex items-center justify-between rounded-md px-3 py-2
              text-sm cursor-pointer border ${active === c.id
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            onClick={() => { setSelectedId(c.id ?? null); setEditing(null); }}>
            <span className="text-zinc-800 dark:text-zinc-100">{c.name}</span>
            <button className="text-zinc-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${c.name}" and its materials?`)) {
                  void deleteCompany(c.id!);
                  if (active === c.id) setSelectedId(null);
                }
              }}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      {/* Materials for the active company */}
      <div className="flex flex-col gap-3">
        {!active ? (
          <p className="text-sm text-zinc-400 py-8">
            Select or add a company to define its materials.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-zinc-800
                dark:text-zinc-100 flex items-center gap-2">
                <Package className="h-4 w-4" />Materials</h3>
              {!editing && (
                <div className="flex items-center gap-2">
                  <button className="text-sm flex items-center gap-1 px-3 py-1.5
                    rounded-md border border-zinc-300 dark:border-zinc-700
                    text-zinc-700 dark:text-zinc-200"
                    onClick={() => setSharingId(
                      sharingId === active ? null : active
                    )}>
                    <Share2 className="h-4 w-4" />Share</button>
                  <button className="text-sm flex items-center gap-1 px-3 py-1.5
                    rounded-md bg-blue-600 text-white"
                    onClick={() => setEditing(emptyMaterial())}>
                    <Plus className="h-4 w-4" />Add material</button>
                </div>
              )}
            </div>

            {sharingId === active && active && (
              <SharePanel companyId={active}
                companyName={
                  companies.find((c) => c.id === active)?.name ?? ''
                } />
            )}

            {editing && (
              <MaterialEditor initial={editing} record={record}
                onCancel={() => setEditing(null)}
                onSave={(m) => {
                  void saveMaterial({ ...m, unit: 'per kg' });
                  setEditing(null);
                }} />
            )}

            {materials.length === 0 && !editing && (
              <p className="text-sm text-zinc-400">
                No materials yet for this company.
              </p>
            )}

            {materials.map((m) => {
              const cost = blendedCost(m.composition, record);
              return (
                <div key={m.id} className="bg-white dark:bg-zinc-800 rounded-lg
                  border border-zinc-200 dark:border-zinc-700 p-3 flex items-start
                  justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900
                      dark:text-zinc-100">{m.name}
                      <span className="text-xs font-normal text-zinc-400 ml-2">
                        {m.composition.length} commodities · {fmt(cost)} / kg
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {m.composition
                        .map((r) => `${labelOf(r.commodityKey)} ${r.ratio}g`)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="text-xs px-2 py-1 rounded-md border
                      border-zinc-300 dark:border-zinc-700 text-zinc-600
                      dark:text-zinc-300" onClick={() => setEditing(m)}>Edit</button>
                    <button className="text-zinc-400 hover:text-red-500 p-1"
                      onClick={() => {
                        if (confirm(`Delete "${m.name}"?`)) {
                          void deleteMaterial(m.id!);
                        }
                      }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
