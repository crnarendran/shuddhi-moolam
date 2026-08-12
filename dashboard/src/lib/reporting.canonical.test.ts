import { describe, it, expect } from 'vitest';
import { toCanonicalPriceRecord, type PriceRecord } from './reporting';

// SM-40: Rs/tonne commodities are normalized to Rs/kg (÷1000) at load, so
// charts/blended-cost share one unit. These keys are Rs/tonne in the registry;
// aluminium_ingot / copper_cathode / tin_ingot are Rs/kg.

describe('toCanonicalPriceRecord', () => {
  it('divides Rs/tonne commodities by 1000', () => {
    const r: PriceRecord = {
      date: '01/08/2026',
      melting_foundry_scrap_mumbai: '47000',
      pig_iron_foundry_gr_pune: 46700,
      lam_coke: '30000',
    };
    const c = toCanonicalPriceRecord(r);
    expect(c.melting_foundry_scrap_mumbai).toBe(47);
    expect(c.pig_iron_foundry_gr_pune).toBe(46.7);
    expect(c.lam_coke).toBe(30);
  });

  it('leaves Rs/kg commodities and metadata untouched', () => {
    const r: PriceRecord = {
      date: '01/08/2026',
      aluminium_ingot: '342',
      copper_cathode: 1333.8,
    };
    const c = toCanonicalPriceRecord(r);
    expect(c.aluminium_ingot).toBe('342');
    expect(c.copper_cathode).toBe(1333.8);
    expect(c.date).toBe('01/08/2026');
  });

  it('normalizes a tonne range to its midpoint ÷1000', () => {
    const c = toCanonicalPriceRecord({
      date: '01/08/2026',
      crca_bundle_mumbai: '46000 - 48000',
    });
    expect(c.crca_bundle_mumbai).toBe(47); // (46000+48000)/2/1000
  });

  it('leaves an unparseable / missing tonne cell as-is', () => {
    const c = toCanonicalPriceRecord({
      date: '01/08/2026',
      crca_bundle_chennai: '',
    });
    expect(c.crca_bundle_chennai).toBe('');
  });

  it('does not mutate the input record', () => {
    const r: PriceRecord = { date: '01/08/2026', lam_coke: '30000' };
    toCanonicalPriceRecord(r);
    expect(r.lam_coke).toBe('30000');
  });
});
