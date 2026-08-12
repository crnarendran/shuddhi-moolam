import { type BarChart3 } from 'lucide-react';

export interface SubTab<T extends string> {
  id: T;
  label: string;
  icon: typeof BarChart3;
}

/**
 * A generic secondary (sub-tab) navigation bar — an underline row of
 * icon+label buttons. Used for the Reports and Settings sub-navigation so
 * the top-level nav stays to three items.
 * @param props tabs to show, the active id, and an onSelect callback.
 */
export function SubTabs<T extends string>(
  { tabs, active, onSelect }: {
    tabs: SubTab<T>[];
    active: T;
    onSelect: (id: T) => void;
  }
) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-200
      dark:border-zinc-700 print:hidden">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          aria-current={active === id ? 'page' : undefined}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium
            border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === id
              ? 'border-blue-600 text-blue-700 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 ' +
                'dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Icon className="h-4 w-4" />{label}
        </button>
      ))}
    </div>
  );
}
