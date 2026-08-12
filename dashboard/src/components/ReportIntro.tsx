import { type ReportHelp } from '../lib/help';

/**
 * Standard, always-visible intro at the top of a report: title, a
 * comprehensive plain-language description of what the report is, and a
 * "How to read this" list. Inline (not a tooltip) so it is self-explanatory
 * on the page.
 */
export function ReportIntro({ help }: { help: ReportHelp }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {help.title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 max-w-3xl">
          {help.description}
        </p>
      </div>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700
        bg-zinc-50 dark:bg-zinc-800/40 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400
          mb-1.5">How to read this</p>
        <ul className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1
          list-disc pl-4">
          {help.howToRead.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      </div>
    </div>
  );
}
