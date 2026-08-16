import { detectOutliers } from './outliers';

const hist = (inoc: string, alu: string) => ({
  inoculant_2_6mm_mumbai: inoc,
  aluminium_ingot: alu,
});

describe('detectOutliers', () => {
  it('flags a sharp misread against the recent median', () => {
    const history = [
      hist('308', '345'), hist('308', '344'), hist('308', '346'),
      hist('308', '342'), hist('308', '347'),
    ];
    const record = hist('200', '346'); // inoculant misread 308 -> 200
    const out = detectOutliers(record, history);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('inoculant_2_6mm_mumbai');
    expect(out[0].value).toBe(200);
    expect(out[0].baseline).toBe(308);
    expect(out[0].deviationPct).toBeCloseTo(-35.1, 0);
  });

  it('does not flag normal week-to-week moves', () => {
    const history = [
      hist('308', '345'), hist('308', '344'), hist('308', '346'),
      hist('308', '342'),
    ];
    // aluminium +1.4%, inoculant flat — both within threshold
    expect(detectOutliers(hist('308', '350'), history)).toEqual([]);
  });

  it('is robust to one bad historical value (median, not mean)', () => {
    const history = [
      hist('308', '345'), hist('308', '344'), hist('200', '346'), // 1 bad
      hist('308', '342'), hist('308', '347'),
    ];
    // new 308 is normal vs the median (308); the stray 200 doesn't drag it
    expect(detectOutliers(hist('308', '346'), history)).toEqual([]);
  });

  it('skips a commodity with too little history', () => {
    const history = [hist('308', '345'), hist('308', '344')]; // only 2
    expect(detectOutliers(hist('200', '346'), history)).toEqual([]);
  });

  it('skips unparseable / missing current values', () => {
    const history = [
      hist('308', '345'), hist('308', '344'), hist('308', '346'),
    ];
    expect(detectOutliers(
      { inoculant_2_6mm_mumbai: '', aluminium_ingot: '346' }, history
    )).toEqual([]);
  });
});
