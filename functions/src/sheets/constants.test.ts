import { SHEET_HEADERS, SHEET_HEADERS_FRIENDLY } from './constants';
import { CORE_KEYS, EXTENDED_KEYS } from '../gemini/components';

describe('SHEET_HEADERS', () => {
  it('includes every core component', () => {
    for (const k of CORE_KEYS) expect(SHEET_HEADERS).toContain(k);
  });

  it('excludes every extended component', () => {
    for (const k of EXTENDED_KEYS) expect(SHEET_HEADERS).not.toContain(k);
  });

  it('leads with filename+date and ends with the metadata columns', () => {
    expect(SHEET_HEADERS[0]).toBe('filename');
    expect(SHEET_HEADERS[1]).toBe('date');
    expect(SHEET_HEADERS).toContain('source_pages');
    expect(SHEET_HEADERS).toContain('last_modified_date');
  });

  it('stays within the 26-column single-letter limit', () => {
    expect(SHEET_HEADERS.length).toBeLessThanOrEqual(26);
  });

  it('drops the deprecated cu_lme column', () => {
    expect(SHEET_HEADERS).not.toContain('cu_lme');
  });
});

describe('SHEET_HEADERS_FRIENDLY', () => {
  it('has one title-cased label per raw header', () => {
    expect(SHEET_HEADERS_FRIENDLY).toHaveLength(SHEET_HEADERS.length);
    expect(SHEET_HEADERS_FRIENDLY[0]).toBe('Filename');
    expect(SHEET_HEADERS_FRIENDLY).toContain('Aluminium Ingot');
    expect(SHEET_HEADERS_FRIENDLY).toContain('Lam Coke');
  });

  it('contains no underscores', () => {
    for (const h of SHEET_HEADERS_FRIENDLY) expect(h).not.toContain('_');
  });
});
