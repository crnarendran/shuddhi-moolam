import { useState, type ReactNode } from 'react';

/**
 * Lightweight, dependency-free tooltip. Shows on hover, keyboard focus, and
 * tap; dismisses on leave/blur/Escape. Theme-aware and viewport-clamped
 * (max-width). Wrap any trigger element.
 */
export function Tooltip(
  { content, children }: { content: ReactNode; children: ReactNode }
) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        className="inline-flex cursor-help outline-none"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
            w-64 max-w-[80vw] rounded-md px-3 py-2 text-xs leading-relaxed
            text-left font-normal shadow-lg
            bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {content}
        </span>
      )}
    </span>
  );
}
