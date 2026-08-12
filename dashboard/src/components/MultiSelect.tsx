import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

/**
 * A compact multi-select checklist dropdown with Select-all / Clear shortcuts.
 * Closes on outside click. The selection may be empty (callers show an
 * empty-state); colours cycle so any number of series is allowed.
 * @param props options, current selection, change handler, optional label.
 */
export function MultiSelect(
  { options, selected, onChange, label }: {
    options: Option[];
    selected: string[];
    onChange: (next: string[]) => void;
    label?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const allValues = options.map((o) => o.value);
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggle = (value: string) => {
    onChange(selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]);
  };

  const summary = selected.length === 0
    ? 'None'
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? '1 selected'
      : `${selected.length} selected`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border
          border-zinc-300 dark:border-zinc-700 rounded-md py-2 px-3 text-sm
          text-zinc-800 dark:text-zinc-100 max-w-[240px]"
      >
        {label && <span className="text-zinc-400">{label}</span>}
        <span className="truncate">{summary}</span>
        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-64 max-h-80 overflow-auto
            rounded-md border border-zinc-200 dark:border-zinc-700 bg-white
            dark:bg-zinc-800 shadow-lg py-1">
            <div className="flex gap-3 px-3 py-2 border-b border-zinc-100
              dark:border-zinc-700 text-xs">
              <button
                onClick={() => onChange(allValues)}
                disabled={allSelected}
                className="text-blue-600 dark:text-blue-400 hover:underline
                  disabled:opacity-40 disabled:no-underline"
              >Select all</button>
              <button
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-zinc-500 dark:text-zinc-400 hover:underline
                  disabled:opacity-40 disabled:no-underline"
              >Clear</button>
            </div>
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center
                    gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    on ? 'text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-zinc-700 dark:text-zinc-200'}`}
                >
                  <span className="w-4 shrink-0">
                    {on && <Check className="h-4 w-4" />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
