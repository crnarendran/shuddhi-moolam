import { Building2, Eye } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { usePlan } from '../hooks/usePlan';
import { useView } from '../context/ViewContext';
import { MultiSelect } from './MultiSelect';
import { trackEvent } from '../lib/analytics';

const selCls =
  'px-2.5 py-1.5 rounded-md text-sm border bg-white ' +
  'dark:bg-zinc-900 truncate';

/**
 * Global Company·Product selector (SM-60). One control drives every
 * report: pick a company (My workspace, your own, or one shared with
 * you) and, optionally, a product/recipe within it. The product control
 * adapts to the active report — a single-select normally, a multi-select
 * on Guidance (`multiProduct`) so several products can be compared.
 * Hidden when there's no company to pick.
 * @param props Component properties.
 * @param props.align Layout hint ('left' fills width in mobile drawer).
 * @param props.multiProduct Render product control as a multi-select.
 * @returns Rendered switcher or null when no companies exist.
 */
export function ContextSwitcher({
  align = 'right',
  multiProduct = false,
}: {
  align?: 'left' | 'right';
  multiProduct?: boolean;
}) {
  const { companies, shared: sharedCompanies } = useCompanies();
  const { premium } = usePlan();
  const {
    companyId,
    materialId,
    materialIds,
    materials,
    isShared,
    setCompany,
    setSingle,
    setMulti,
  } = useView();

  if (companies.length === 0 && sharedCompanies.length === 0) return null;

  const isDrawer = align === 'left';
  const companyBorder = isShared
    ? 'border-amber-400 text-amber-700 dark:text-amber-300'
    : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200';
  const companyWidth = isDrawer
    ? 'flex-1 min-w-0 w-full'
    : 'max-w-[11rem]';
  const productWidth = isDrawer ? 'w-full' : 'max-w-[11rem]';

  return (
    <div
      className={
        isDrawer
          ? 'flex flex-col gap-2 w-full'
          : 'flex items-center gap-2'
      }
    >
      <div
        className={
          isDrawer
            ? 'flex items-center gap-2 w-full'
            : 'flex items-center gap-1'
        }
      >
        {isShared ? (
          <Eye className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
        )}
        <select
          aria-label="Company"
          className={`${selCls} ${companyBorder} ${companyWidth}`}
          value={companyId ?? ''}
          onChange={(e) => {
            const val = e.target.value || null;
            setCompany(val);
            const context_type = !val
              ? 'workspace'
              : sharedCompanies.some((c) => c.id === val)
                ? 'shared'
                : 'owned';
            void trackEvent('select_company_context', {
              context_type,
              company_id: val || 'workspace',
            });
          }}
        >
          {premium && <option value="">My workspace</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {sharedCompanies.length > 0 && (
            <optgroup label="Shared with me">
              {sharedCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      {companyId &&
        (multiProduct ? (
          <MultiSelect
            label="Products"
            align={align}
            fullWidth={isDrawer}
            options={materials.map((m) => ({
              value: m.id ?? '',
              label: m.name,
            }))}
            selected={materialIds}
            onChange={(ids) => {
              setMulti(ids);
              void trackEvent('select_product_filter', {
                mode: 'multi',
                selected_count: ids.length,
                has_selection: ids.length > 0,
              });
            }}
          />
        ) : (
          <select
            aria-label="Product"
            className={`${selCls} ${productWidth} border-zinc-300
              dark:border-zinc-700 text-zinc-700 dark:text-zinc-200`}
            value={materialId ?? ''}
            onChange={(e) => {
              const val = e.target.value || null;
              setSingle(val);
              void trackEvent('select_product_filter', {
                mode: 'single',
                selected_count: val ? 1 : 0,
                has_selection: !!val,
              });
            }}
          >
            <option value="">All products</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
}
