import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Single option item rendered in a {@link MultiSelect} list. */
export interface Option {
  value: string;
  label: string;
}

/** Horizontal alignment of the {@link MultiSelect} dropdown popover. */
export type MultiSelectAlign = 'left' | 'right';

/** Layout options controlling {@link MultiSelect} width and alignment. */
export interface MultiSelectLayoutOptions {
  align?: MultiSelectAlign;
  fullWidth?: boolean;
  mobileFullWidth?: boolean;
}

/** Resolved Tailwind class names for the {@link MultiSelect} parts. */
export interface MultiSelectLayoutClasses {
  root: string;
  button: string;
  popover: string;
}

/** Props accepted by the {@link MultiSelect} component. */
export interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
  align?: MultiSelectAlign;
  fullWidth?: boolean;
  mobileFullWidth?: boolean;
}

const BTN_BASE =
  'flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border ' +
  'border-zinc-300 dark:border-zinc-700 rounded-md py-2 px-3 ' +
  'text-sm text-zinc-800 dark:text-zinc-100';

const POP_BASE =
  'absolute mt-1 z-20 max-h-80 overflow-auto rounded-md border ' +
  'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 ' +
  'shadow-lg py-1';

/**
 * Computes responsive Tailwind classes for the MultiSelect root,
 * trigger button, and dropdown popover so popovers do not clip off-screen
 * on narrow mobile viewports or inside drawers.
 * @param opts Layout configuration (alignment and full-width behavior).
 * @returns Resolved class strings for root, button, and popover elements.
 */
export function multiSelectLayoutClasses(
  opts: MultiSelectLayoutOptions = {},
): MultiSelectLayoutClasses {
  const {
    align = 'right',
    fullWidth = false,
    mobileFullWidth = false,
  } = opts;
  const edge = align === 'left' ? 'left-0' : 'right-0';
  const maxVw = 'max-w-[calc(100vw-2rem)]';

  if (fullWidth) {
    return {
      root: 'relative w-full',
      button: `${BTN_BASE} w-full justify-between`,
      popover: `${POP_BASE} ${edge} w-full ${maxVw}`,
    };
  }

  if (mobileFullWidth) {
    const popPos =
      align === 'right'
        ? 'left-0 w-full sm:left-auto sm:right-0 sm:w-64'
        : 'left-0 w-full sm:w-64';
    return {
      root: 'relative w-full sm:w-auto',
      button:
        `${BTN_BASE} w-full justify-between sm:w-auto sm:max-w-[240px]`,
      popover: `${POP_BASE} ${popPos} ${maxVw}`,
    };
  }

  return {
    root: 'relative',
    button: `${BTN_BASE} max-w-[240px]`,
    popover: `${POP_BASE} ${edge} w-64 ${maxVw}`,
  };
}

/**
 * A compact multi-select checklist dropdown with Select-all / Clear
 * shortcuts. Closes on outside click. The selection may be empty
 * (callers show an empty-state); colours cycle so any number of series
 * is allowed.
 * @param props Options, selection state, change handler, and layout props.
 * @returns Rendered multi-select dropdown element.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  label,
  align,
  fullWidth,
  mobileFullWidth,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const allValues = options.map((o) => o.value);
  const allSelected =
    options.length > 0 && selected.length === options.length;
  const layout = multiSelectLayoutClasses({
    align,
    fullWidth,
    mobileFullWidth,
  });

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? 'None'
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ??
          '1 selected'
        : `${selected.length} selected`;

  return (
    <div className={layout.root}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={layout.button}
      >
        <span className="flex items-center gap-2 min-w-0">
          {label && (
            <span className="text-zinc-400 shrink-0">{label}</span>
          )}
          <span className="truncate">{summary}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className={layout.popover}>
            <div
              className="flex gap-3 px-3 py-2 border-b border-zinc-100
                dark:border-zinc-700 text-xs"
            >
              <button
                type="button"
                onClick={() => onChange(allValues)}
                disabled={allSelected}
                className="text-blue-600 dark:text-blue-400
                  hover:underline disabled:opacity-40
                  disabled:no-underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-zinc-500 dark:text-zinc-400
                  hover:underline disabled:opacity-40
                  disabled:no-underline"
              >
                Clear
              </button>
            </div>
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm flex
                    items-center gap-2 hover:bg-zinc-100
                    dark:hover:bg-zinc-700 ${
                      on
                        ? 'text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-zinc-700 dark:text-zinc-200'
                    }`}
                >
                  <span className="w-4 shrink-0">
                    {on && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 break-words">{o.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
