import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight, dependency-free tooltip. Shows on hover, keyboard focus, and
 * tap; dismisses on leave/blur/Escape. Renders into a body-level portal with
 * fixed positioning so it is never clipped by an ancestor's `overflow`
 * (e.g. a scrolling table). Flips below the trigger when there isn't room
 * above. Theme-aware and viewport width-clamped.
 */
export function Tooltip(
  { content, children }: { content: ReactNode; children: ReactNode }
) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, below: false });
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const below = r.top < 140;
      setPos({
        x: r.left + r.width / 2,
        y: below ? r.bottom : r.top,
        below,
      });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span
        tabIndex={0}
        className="inline-flex cursor-help outline-none"
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}
      >
        {children}
      </span>
      {open && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: pos.below
              ? 'translate(-50%, 8px)'
              : 'translate(-50%, calc(-100% - 8px))',
          }}
          className="z-[100] w-64 max-w-[80vw] rounded-md px-3 py-2 text-xs
            leading-relaxed text-left font-normal shadow-lg pointer-events-none
            bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}
