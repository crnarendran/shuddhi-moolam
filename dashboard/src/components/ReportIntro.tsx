import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type ReportHelp } from '../lib/help';

// One shared preference across every report, persisted so advanced users can
// collapse the inline docs once and have them stay collapsed (SM-46).
const KEY = 'sm.reportHelp.expanded';

/** Reads the persisted expand preference; defaults to collapsed. */
function initialOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Collapsible intro at the top of a report: the title stays visible with a
 * "Show / Hide help" toggle; the description and "How to read this" list are
 * collapsed by default (SM-46) so advanced users skip straight to the charts.
 * The open/closed choice is remembered across reports and reloads.
 */
export function ReportIntro({ help }: { help: ReportHelp }) {
  const [open, setOpen] = useState<boolean>(initialOpen);
  const toggle = () => setOpen((v) => {
    const next = !v;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // ignore storage failures (private mode etc.)
    }
    return next;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {help.title}
        </h2>
        <button
          onClick={toggle}
          aria-expanded={open}
          className="shrink-0 text-xs flex items-center gap-1 px-2 py-1
            rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-800
            dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          {open
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
          {open ? 'Hide help' : 'Show help'}
        </button>
      </div>
      {open && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-3xl">
            {help.description}
          </p>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700
            bg-zinc-50 dark:bg-zinc-800/40 px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400
              mb-1.5">How to read this</p>
            <ul className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1
              list-disc pl-4">
              {help.howToRead.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
