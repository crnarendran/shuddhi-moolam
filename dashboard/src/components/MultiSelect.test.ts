import { describe, it, expect } from 'vitest';
import { multiSelectLayoutClasses } from './MultiSelect';

/**
 * Splits a Tailwind class string into individual class tokens.
 * @param cls Space-delimited class string.
 * @returns Array of non-empty class tokens.
 */
function tokens(cls: string): string[] {
  return cls.trim().split(/\s+/);
}

describe('multiSelectLayoutClasses', () => {
  it('uses compact right-aligned defaults when called with {}', () => {
    const cls = multiSelectLayoutClasses({});
    expect(cls.root).toBe('relative');
    expect(tokens(cls.button)).toContain('max-w-[240px]');
    const pop = tokens(cls.popover);
    expect(pop).toContain('right-0');
    expect(pop).toContain('w-64');
    expect(pop).toContain('max-w-[calc(100vw-2rem)]');
  });

  it('uses the same defaults when called with no arguments', () => {
    expect(multiSelectLayoutClasses()).toEqual(multiSelectLayoutClasses({}));
  });

  it('aligns popover left for left-aligned inline usage', () => {
    const cls = multiSelectLayoutClasses({ align: 'left' });
    const pop = tokens(cls.popover);
    expect(pop).toContain('left-0');
    expect(pop).not.toContain('right-0');
    expect(cls.popover).not.toContain('right-0');
  });

  it('fills container width on left when fullWidth is true', () => {
    const cls = multiSelectLayoutClasses({
      align: 'left',
      fullWidth: true,
    });
    expect(tokens(cls.root)).toContain('w-full');
    const btn = tokens(cls.button);
    expect(btn).toContain('w-full');
    expect(btn).toContain('justify-between');
    const pop = tokens(cls.popover);
    expect(pop).toContain('left-0');
    expect(pop).toContain('w-full');
    expect(cls.popover).not.toContain('right-0');
    expect(cls.popover).not.toContain('w-64');
  });

  it('uses mobile full-width and desktop right alignment (Seasonal)', () => {
    const cls = multiSelectLayoutClasses({
      align: 'right',
      mobileFullWidth: true,
    });
    expect(cls.root).toContain('w-full sm:w-auto');
    const btn = tokens(cls.button);
    expect(btn).toContain('w-full');
    expect(btn).toContain('sm:w-auto');
    const pop = tokens(cls.popover);
    expect(pop).toContain('left-0');
    expect(pop).toContain('w-full');
    expect(pop).toContain('sm:left-auto');
    expect(pop).toContain('sm:right-0');
    expect(pop).toContain('sm:w-64');
  });

  it('uses mobile full-width and desktop left alignment (Spreads)', () => {
    const cls = multiSelectLayoutClasses({
      align: 'left',
      mobileFullWidth: true,
    });
    const pop = tokens(cls.popover);
    expect(pop).toContain('left-0');
    expect(pop).toContain('w-full');
    expect(pop).toContain('sm:w-64');
    expect(cls.popover).not.toContain('right-0');
  });
});
