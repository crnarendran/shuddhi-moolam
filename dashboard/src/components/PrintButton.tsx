import { Printer } from 'lucide-react';

/**
 * A "Print / PDF" action for a report. Uses the browser's native print
 * (which offers "Save as PDF"). Temporarily drops dark mode so the output is
 * ink-friendly, and injects the page orientation for this print only
 * (landscape for wide-table reports, portrait otherwise); both are restored
 * after printing. Hidden in the print output.
 * @param props Optional label and page orientation (defaults to portrait).
 */
export function PrintButton(
  { label = 'Print / PDF', orientation = 'portrait' }:
  { label?: string; orientation?: 'portrait' | 'landscape' }
) {
  const handlePrint = () => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    const style = document.createElement('style');
    style.textContent = `@page { size: ${orientation}; margin: 12mm; }`;
    document.head.appendChild(style);
    const restore = () => {
      if (wasDark) html.classList.add('dark');
      style.remove();
      window.removeEventListener('afterprint', restore);
    };
    if (wasDark) html.classList.remove('dark');
    window.addEventListener('afterprint', restore);
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      title="Print or save this report as a PDF"
      className="print:hidden flex items-center gap-2 px-3 py-2 text-sm
        font-medium rounded-md border border-zinc-300 dark:border-zinc-700
        text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100
        dark:hover:bg-zinc-800 transition-colors"
    >
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
