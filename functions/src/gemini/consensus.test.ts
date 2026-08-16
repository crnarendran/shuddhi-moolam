import { consensusValue, mergeRecords } from './consensus';
import { type ExtractionRecord } from './schema';

describe('consensusValue', () => {
  it('picks the majority reading (2 of 3)', () => {
    expect(consensusValue(['47,500', '48,000', '47,500'])).toBe('47,500');
  });

  it('falls back to the numeric median when all differ', () => {
    // 48,000 / 49,000 / 53,300 -> median is 49,000
    expect(consensusValue(['48,000', '49,000', '53,300'])).toBe('49,000');
  });

  it('ignores blank readings when others are present', () => {
    expect(consensusValue(['', '308', '308'])).toBe('308');
  });

  it('returns empty when every reading is blank', () => {
    expect(consensusValue(['', '', ''])).toBe('');
  });
});

describe('mergeRecords', () => {
  const rec = (over: Partial<ExtractionRecord>): ExtractionRecord => ({
    date: '25/05/2026',
    pig_iron_foundry_gr_pune: '47,500',
    inoculant_2_6mm_mumbai: '308',
    source_pages: 'date: 1',
    ...over,
  } as ExtractionRecord);

  it('outvotes a single misread field', () => {
    const merged = mergeRecords([
      rec({ pig_iron_foundry_gr_pune: '47,500' }),
      rec({ pig_iron_foundry_gr_pune: '48,000' }), // the wrong run
      rec({ pig_iron_foundry_gr_pune: '47,500' }),
    ]);
    expect(merged.pig_iron_foundry_gr_pune).toBe('47,500');
    expect(merged.inoculant_2_6mm_mumbai).toBe('308');
  });

  it('keeps source_pages from the first record', () => {
    const merged = mergeRecords([
      rec({ source_pages: 'A' }), rec({ source_pages: 'B' }),
    ]);
    expect(merged.source_pages).toBe('A');
  });

  it('returns the single record unchanged when runs = 1', () => {
    const one = rec({});
    expect(mergeRecords([one])).toBe(one);
  });
});
