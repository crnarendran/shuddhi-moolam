import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

/**
 * A compact multi-select checklist dropdown. Shows a summary button; opens a
 * checkbox list; closes on outside click. Enforces an optional `max` (unchecked
 * options disable once the cap is hit) and never lets the selection drop below
 * one item, so charts always have at least one series.
 * @param props options, current selection, change handler, and optional cap.
 */
export function MultiSelect(
  { options, selected, onChange, max = 6, label }: {
    options: Option[];
    selected: string[];
    onChange: (next: string[]) => void;
    max?: number;
    label?: string;
  }
) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      if (selected.length > 1) onChange(selected.filter((v) => v !== value));
    } else if (selected.length < max) {
      onChange([...selected, value]);
    }
  };

  const summary = selected.length === 1
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
          <div className="absolute right-0 mt-1 z-20 w-64 max-h-72 overflow-auto
            rounded-md border border-zinc-200 dark:border-zinc-700 bg-white
            dark:bg-zinc-800 shadow-lg py-1">
            {options.map((o) => {
              const on = selected.includes(o.value);
              const disabled = !on && selected.length >= max;
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center
                    gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
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
            <p className="px-3 py-1.5 text-xs text-zinc-400">
              Up to {max} at a time.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
