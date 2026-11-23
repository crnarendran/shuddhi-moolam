import { Resend } from 'resend';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  COMPANIES_COLLECTION,
  HISTORICAL_COLLECTION,
} from '../config';
import {
  computeBlendedCost,
  evaluateBuyWindows,
  resolveGuidanceAlertRecipient,
  escapeHtml,
  buildGuidanceAlertHtml,
  sendGuidanceAlertEmail,
  type MaterialSpec,
  type BuyWindowOpportunity,
} from './guidanceAlerts';
import { runGuidanceAlertsJob } from './guidanceAlertsJob';
import { PriceRecord } from './aggregate';
import { OUTCOME_EMAIL_FROM } from '../pipeline/outcomeEmail';

jest.mock('resend');
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('Guidance Alerts Engine (SM-70)', () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  describe('computeBlendedCost', () => {
    it('computes SM-61 Σ(g × p) ÷ 1000 with ranges and commas', () => {
      const comp = [
        { commodityKey: 'fe_si', ratio: 800 },
        { commodityKey: 'scrap', ratio: 250 },
      ];
      const rec: PriceRecord = {
        date: '10/08/2026',
        fe_si: '100',
        scrap: '205 - 195',
      };
      // (800 * 100 + 250 * 200) / 1000 = 130
      expect(computeBlendedCost(comp, rec)).toBeCloseTo(130, 9);
    });

    it('imputes unpriced commodities at the priced average', () => {
      const comp = [
        { commodityKey: 'fe_si_mg_mumbai', ratio: 2 },
        { commodityKey: 'crca_bundle_mumbai', ratio: 0.1 },
      ];
      const rec: PriceRecord = {
        date: '10/09/2026',
        fe_si_mg_mumbai: '170',
      };
      // priced avg 170 over 2.1 g total -> 170 * 2.1 / 1000 = 0.357
      expect(computeBlendedCost(comp, rec)).toBeCloseTo(0.357, 9);
    });

    it('clamps negative and non-finite ratios to zero', () => {
      const comp = [
        { commodityKey: 'a', ratio: 500 },
        { commodityKey: 'b', ratio: -200 },
        { commodityKey: 'c', ratio: Number.NaN },
      ];
      const rec: PriceRecord = {
        date: '10/08/2026',
        a: '100',
        b: '900',
        c: '500',
      };
      // Only a (500g * 100) / 1000 = 50; negative/NaN ratios clamped to 0.
      expect(computeBlendedCost(comp, rec)).toBeCloseTo(50, 9);
    });

    it('returns null when record is null or nothing is priced', () => {
      const comp = [{ commodityKey: 'a', ratio: 500 }];
      expect(computeBlendedCost(comp, null)).toBeNull();
      expect(computeBlendedCost(comp, { date: '10/08/2026', a: '' }))
        .toBeNull();
      expect(computeBlendedCost([], { date: '10/08/2026', a: '100' }))
        .toBeNull();
    });
  });

  describe('evaluateBuyWindows', () => {
    it('triggers quarterly dip when quarterDeltaPct <= -threshold', () => {
      const materials: MaterialSpec[] = [
        {
          id: 'm1',
          name: 'Ductile Iron',
          companyName: 'Foundry A',
          composition: [{ commodityKey: 'cu', ratio: 1000 }],
        },
        {
          id: 'm2',
          name: 'Mild Dip',
          companyName: 'Foundry A',
          composition: [{ commodityKey: 'zn', ratio: 1000 }],
        },
      ];
      const records: PriceRecord[] = [
        { date: '10/02/2026', cu: '100', zn: '100' }, // Q1
        { date: '10/05/2026', cu: '95', zn: '98' }, // Q2: -5% vs -2%
      ];
      const res = evaluateBuyWindows(materials, records, {
        dipThresholdPct: 3,
        now: new Date('2026-05-20T12:00:00Z'),
      });
      expect(res).toHaveLength(1);
      expect(res[0].materialName).toBe('Ductile Iron');
      expect(res[0].companyName).toBe('Foundry A');
      expect(res[0].currentCost).toBeCloseTo(95, 6);
      expect(res[0].priorQuarterCost).toBeCloseTo(100, 6);
      expect(res[0].quarterDeltaPct).toBeCloseTo(-5, 6);
      expect(res[0].reasons).toContain('Cost down 5.0% vs prior quarter');
    });

    it('computes next-month seasonal dip and wraps Dec -> Jan', () => {
      const materials: MaterialSpec[] = [
        {
          id: 'm1',
          name: 'Bronze Mix',
          companyName: 'Foundry B',
          composition: [
            { commodityKey: 'cu', ratio: 500 },
            { commodityKey: 'sn', ratio: 500 },
          ],
        },
      ];
      // Latest record (15/12/2025): cu=100 (50% cost share), sn=100 (50%)
      // Seasonal MoM into Jan (1): cu -10% (2024->2025), sn -2% => -6%
      const records: PriceRecord[] = [
        { date: '15/12/2024', cu: '100', sn: '100' },
        { date: '15/01/2025', cu: '90', sn: '98' },
        { date: '15/12/2025', cu: '100', sn: '100' },
      ];
      const res = evaluateBuyWindows(materials, records, {
        dipThresholdPct: 5,
        now: new Date('2025-12-20T00:00:00Z'),
      });
      expect(res).toHaveLength(1);
      expect(res[0].nextMonthLabel).toBe('Jan');
      expect(res[0].nextMonthSeasonalPct).toBeCloseTo(-6, 6);
      expect(res[0].reasons).toContain('Seasonal dip in Jan (-6.0%)');
    });

    it('uses latest dated record within a month for seasonal cost shares',
      () => {
        const materials: MaterialSpec[] = [
          {
            id: 'm1',
            name: 'Weighted Alloy',
            companyName: 'Foundry C',
            composition: [
              { commodityKey: 'cu', ratio: 500 },
              { commodityKey: 'sn', ratio: 500 },
            ],
          },
        ];
        // Both Dec 2025 records exist; 20/12/2025 is latest:
        // At 20/12/2025: cu=300 (75% share), sn=100 (25% share)
        // Jan seasonal: cu=-10%, sn=+2% => -7.5 + 0.5 = -7.0%
        const records: PriceRecord[] = [
          { date: '10/12/2024', cu: '100', sn: '100' },
          { date: '10/01/2025', cu: '90', sn: '102' },
          { date: '20/12/2025', cu: '300', sn: '100' },
          { date: '05/12/2025', cu: '100', sn: '300' },
        ];
        const res = evaluateBuyWindows(materials, records, {
          dipThresholdPct: 3,
          now: new Date('2025-12-22T00:00:00Z'),
        });
        expect(res).toHaveLength(1);
        expect(res[0].nextMonthSeasonalPct).toBeCloseTo(-7, 6);
      }
    );

    it('combines reasons and sorts by strongest negative signal first', () => {
      const materials: MaterialSpec[] = [
        {
          id: 'm-mild',
          name: 'Mild',
          companyName: 'Co 1',
          composition: [{ commodityKey: 'a', ratio: 1000 }],
        },
        {
          id: 'm-strong-seas',
          name: 'Strong Seasonal',
          companyName: 'Co 1',
          composition: [{ commodityKey: 'b', ratio: 1000 }],
        },
        {
          id: 'm-both',
          name: 'Both Signals',
          companyName: 'Co 2',
          composition: [{ commodityKey: 'c', ratio: 1000 }],
        },
      ];
      // now = 2026-06-15 -> nextMonth = Jul (7)
      // a: Q1 100 -> Q2 96 (-4% quarter), Jul flat
      // b: Q1 100 -> Q2 102 (+2% quarter), Jul -12% seasonal
      // c: Q1 100 -> Q2 92 (-8% quarter), Jul -5% seasonal
      const records: PriceRecord[] = [
        { date: '10/06/2025', a: '100', b: '100', c: '100' },
        { date: '10/07/2025', a: '100', b: '88', c: '95' },
        { date: '10/02/2026', a: '100', b: '100', c: '100' },
        { date: '10/05/2026', a: '96', b: '102', c: '92' },
      ];
      const res = evaluateBuyWindows(materials, records, {
        dipThresholdPct: 3,
        now: new Date('2026-06-15T10:00:00Z'),
      });
      expect(res.map((o) => o.materialName)).toEqual([
        'Strong Seasonal',
        'Both Signals',
        'Mild',
      ]);
      expect(res[1].reasons).toEqual([
        'Cost down 8.0% vs prior quarter',
        'Seasonal dip in Jul (-5.0%)',
      ]);
    });

    it('triggers seasonal signal even with only a single quarter', () => {
      const materials: MaterialSpec[] = [
        {
          id: 'm1',
          name: 'Single Q',
          companyName: 'Co',
          composition: [{ commodityKey: 'a', ratio: 1000 }],
        },
      ];
      const records: PriceRecord[] = [
        { date: '10/07/2026', a: '100' },
        { date: '10/08/2026', a: '90' }, // Aug MoM -10%, same Q3
      ];
      const res = evaluateBuyWindows(materials, records, {
        dipThresholdPct: 3,
        now: new Date('2026-07-20T00:00:00Z'),
      });
      expect(res).toHaveLength(1);
      expect(res[0].priorQuarterCost).toBeNull();
      expect(res[0].quarterDeltaPct).toBeNull();
      expect(res[0].nextMonthLabel).toBe('Aug');
      expect(res[0].nextMonthSeasonalPct).toBeCloseTo(-10, 6);
    });

    it('skips malformed records without string date and still evaluates',
      () => {
        const materials: MaterialSpec[] = [
          {
            id: 'm1',
            name: 'Copper Mix',
            companyName: 'Foundry D',
            composition: [{ commodityKey: 'cu', ratio: 1000 }],
          },
        ];
        const malformed = [
          {} as PriceRecord,
          { date: 123 } as unknown as PriceRecord,
          { date: '10/01/2026', cu: '100' },
          { date: '10/04/2026', cu: '90' },
        ];
        const res = evaluateBuyWindows(materials, malformed, {
          dipThresholdPct: 3,
          now: new Date('2026-04-20T00:00:00Z'),
        });
        expect(res).toHaveLength(1);
        expect(res[0].quarterDeltaPct).toBeCloseTo(-10, 6);
      }
    );

    it('safely ignores prototype-like commodity keys', () => {
      const materials: MaterialSpec[] = [
        {
          id: 'm1',
          name: 'Proto Guard',
          companyName: 'Foundry E',
          composition: [
            { commodityKey: '__proto__', ratio: 500 },
            { commodityKey: 'toString', ratio: 500 },
          ],
        },
      ];
      const records: PriceRecord[] = [
        { date: '10/01/2026', cu: '100' },
        { date: '10/04/2026', cu: '90' },
      ];
      expect(() =>
        evaluateBuyWindows(materials, records, {
          dipThresholdPct: 3,
          now: new Date('2026-04-20T00:00:00Z'),
        })
      ).not.toThrow();
      expect(
        evaluateBuyWindows(materials, records, {
          dipThresholdPct: 3,
          now: new Date('2026-04-20T00:00:00Z'),
        })
      ).toEqual([]);
    });
  });

  describe('resolveGuidanceAlertRecipient', () => {
    it('strictly restricts to crnarendran@gmail.com in dev and staging',
      () => {
        expect(
          resolveGuidanceAlertRecipient('buyer@co.com', 'owner@co.com', 'dev')
        ).toBe('crnarendran@gmail.com');
        expect(
          resolveGuidanceAlertRecipient(undefined, undefined, 'dev')
        ).toBe('crnarendran@gmail.com');
        expect(
          resolveGuidanceAlertRecipient(
            'buyer@co.com',
            'owner@co.com',
            'staging'
          )
        ).toBe('crnarendran@gmail.com');
        expect(
          resolveGuidanceAlertRecipient(undefined, undefined, 'staging')
        ).toBe('crnarendran@gmail.com');
      }
    );

    it('prefers trimmed lowercased prefEmail over fallback in prod and main',
      () => {
        expect(
          resolveGuidanceAlertRecipient(
            '  Buyer@Plant.COM ',
            'owner@plant.com',
            'prod'
          )
        ).toBe('buyer@plant.com');
        expect(
          resolveGuidanceAlertRecipient('   ', 'Owner@Plant.COM', 'main')
        ).toBe('owner@plant.com');
      }
    );

    it('rejects service account and invalid emails', () => {
      expect(
        resolveGuidanceAlertRecipient(
          'bot@proj.iam.gserviceaccount.com',
          'owner@co.com',
          'prod'
        )
      ).toBeNull();
      expect(
        resolveGuidanceAlertRecipient('not-an-email', 'owner@co.com', 'prod')
      ).toBeNull();
      expect(resolveGuidanceAlertRecipient(undefined, null, 'prod')).toBeNull();
    });
  });

  describe('escapeHtml and buildGuidanceAlertHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml(`<script>"'&</script>`)).toBe(
        '&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;'
      );
    });

    it('builds XSS-safe HTML table and guidance link', () => {
      const opps: BuyWindowOpportunity[] = [
        {
          companyName: '<img src=x onerror=alert(1)>',
          materialName: 'Alloy & "Steel"',
          currentCost: 145.5,
          priorQuarterCost: 160,
          quarterDeltaPct: -9.1,
          nextMonthLabel: 'Jan<script>',
          nextMonthSeasonalPct: -4.2,
          reasons: ['Cost down 9.1% vs prior quarter', '<b>bad</b>'],
        },
      ];
      const html = buildGuidanceAlertHtml(opps, 'https://app.example.com/');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('Alloy &amp; &quot;Steel&quot;');
      expect(html).toContain('Jan&lt;script&gt;');
      expect(html).toContain('&lt;b&gt;bad&lt;/b&gt;');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('https://app.example.com/#reports/guidance');
    });

    it('rejects unsafe non-http baseUrl protocols', () => {
      const opps: BuyWindowOpportunity[] = [
        {
          companyName: 'Co',
          materialName: 'Mat',
          currentCost: 100,
          priorQuarterCost: 110,
          quarterDeltaPct: -9.1,
          nextMonthLabel: 'Jul',
          nextMonthSeasonalPct: null,
          reasons: ['Cost down 9.1% vs prior quarter'],
        },
      ];
      const html = buildGuidanceAlertHtml(opps, 'javascript:alert(1)');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('#reports/guidance');
    });
  });

  describe('sendGuidanceAlertEmail', () => {
    const sampleOpps: BuyWindowOpportunity[] = [
      {
        companyName: 'Foundry A',
        materialName: 'Ductile Iron',
        currentCost: 95,
        priorQuarterCost: 100,
        quarterDeltaPct: -5,
        nextMonthLabel: 'Jul',
        nextMonthSeasonalPct: -4,
        reasons: ['Cost down 5.0% vs prior quarter'],
      },
    ];

    it('returns false when opportunities is empty', async () => {
      process.env.RESEND_API_KEY = 're_test_123';
      const ok = await sendGuidanceAlertEmail({
        to: 'buyer@co.com',
        opportunities: [],
      });
      expect(ok).toBe(false);
      expect(Resend).not.toHaveBeenCalled();
    });

    it('returns false when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;
      const ok = await sendGuidanceAlertEmail({
        to: 'buyer@co.com',
        opportunities: sampleOpps,
      });
      expect(ok).toBe(false);
      expect(Resend).not.toHaveBeenCalled();
    });

    it('sends via Resend using OUTCOME_EMAIL_FROM', async () => {
      process.env.RESEND_API_KEY = 're_test_123';
      const mockSend = jest.fn().mockResolvedValue({ error: null });
      (Resend as unknown as jest.Mock).mockImplementation(() => ({
        emails: { send: mockSend },
      }));

      const ok = await sendGuidanceAlertEmail({
        to: 'buyer@co.com',
        opportunities: sampleOpps,
        baseUrl: 'https://sai-shuddhi-moolam.web.app',
      });
      expect(ok).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const args = mockSend.mock.calls[0][0];
      expect(args.from).toBe(OUTCOME_EMAIL_FROM);
      expect(args.to).toBe('buyer@co.com');
      expect(args.html).toContain('Ductile Iron');
      expect(args.html).toContain(
        'https://sai-shuddhi-moolam.web.app/#reports/guidance'
      );
    });

    it('returns false without throwing on Resend API error or exception',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockErr = jest.fn().mockResolvedValue({
          error: { message: 'rate limited' },
        });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockErr },
        }));
        await expect(
          sendGuidanceAlertEmail({
            to: 'buyer@co.com',
            opportunities: sampleOpps,
          })
        ).resolves.toBe(false);

        const mockThrow = jest.fn().mockRejectedValue(new Error('network'));
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockThrow },
        }));
        await expect(
          sendGuidanceAlertEmail({
            to: 'buyer@co.com',
            opportunities: sampleOpps,
          })
        ).resolves.toBe(false);
      }
    );
  });

  describe('runGuidanceAlertsJob', () => {
    it('returns early when no users opted in', async () => {
      const colMock = jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        })),
      }));
      (getFirestore as unknown as jest.Mock).mockReturnValue({
        collection: colMock,
      });

      await runGuidanceAlertsJob();
      expect(colMock).toHaveBeenCalledTimes(1);
      expect(colMock).toHaveBeenCalledWith('user_settings');
    });

    it('sends consolidated email for opted-in users with buy windows',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const settingsDocs = [
          {
            id: 'uid-1',
            data: () => ({
              guidanceAlerts: {
                enabled: true,
                email: 'buyer@plant.com',
                dipThresholdPct: 3,
              },
            }),
          },
        ];
        const histDocs = [
          { data: () => ({ date: '10/01/2026', cu: '100' }) },
          { data: () => ({ date: '10/04/2026', cu: '90' }) },
        ];
        const matDocs = [
          {
            id: 'mat-1',
            data: () => ({
              name: 'Copper Bar',
              composition: [{ commodityKey: 'cu', ratio: 1000 }],
            }),
          },
        ];
        const companyDocs = [
          {
            id: 'comp-1',
            data: () => ({ name: 'Plant One', ownerEmail: 'owner@plant.com' }),
            ref: {
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: matDocs }),
              })),
            },
          },
        ];

        const colMock = jest.fn((name: string) => {
          if (name === 'user_settings') {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  size: 1,
                  docs: settingsDocs,
                }),
              })),
            };
          }
          if (name === 'entitlements') {
            return {
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ plan: 'premium' }),
                }),
              })),
            };
          }
          if (name === HISTORICAL_COLLECTION) {
            return {
              get: jest.fn().mockResolvedValue({ docs: histDocs }),
            };
          }
          if (name === COMPANIES_COLLECTION) {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  docs: companyDocs,
                }),
              })),
            };
          }
          return {};
        });
        (getFirestore as unknown as jest.Mock).mockReturnValue({
          collection: colMock,
        });
        (getAuth as unknown as jest.Mock).mockReturnValue({
          getUser: jest.fn().mockResolvedValue({ email: 'auth@plant.com' }),
        });

        await runGuidanceAlertsJob();

        expect(mockSend).toHaveBeenCalledTimes(1);
        const sent = mockSend.mock.calls[0][0];
        expect(sent.to).toBe(
          resolveGuidanceAlertRecipient('buyer@plant.com', 'owner@plant.com')
        );
        expect(sent.html).toContain('Plant One');
        expect(sent.html).toContain('Copper Bar');
        expect(sent.html).toContain('Cost down 10.0% vs prior quarter');
      }
    );

    it('skips downgraded free user even when spoofing founder prefEmail',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const settingsDocs = [
          {
            id: 'uid-free',
            data: () => ({
              guidanceAlerts: {
                enabled: true,
                email: 'crnarendran@gmail.com',
                dipThresholdPct: 3,
              },
            }),
          },
        ];
        const histDocs = [
          { data: () => ({ date: '10/01/2026', cu: '100' }) },
          { data: () => ({ date: '10/04/2026', cu: '90' }) },
        ];
        const matDocs = [
          {
            id: 'mat-1',
            data: () => ({
              name: 'Copper Bar',
              composition: [{ commodityKey: 'cu', ratio: 1000 }],
            }),
          },
        ];
        const companyDocs = [
          {
            id: 'comp-1',
            data: () => ({ name: 'Plant Free', ownerEmail: 'free@plant.com' }),
            ref: {
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: matDocs }),
              })),
            },
          },
        ];

        const colMock = jest.fn((name: string) => {
          if (name === 'user_settings') {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  size: 1,
                  docs: settingsDocs,
                }),
              })),
            };
          }
          if (name === 'entitlements') {
            return {
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ plan: 'free' }),
                }),
              })),
            };
          }
          if (name === HISTORICAL_COLLECTION) {
            return {
              get: jest.fn().mockResolvedValue({ docs: histDocs }),
            };
          }
          if (name === COMPANIES_COLLECTION) {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  docs: companyDocs,
                }),
              })),
            };
          }
          return {};
        });
        (getFirestore as unknown as jest.Mock).mockReturnValue({
          collection: colMock,
        });
        (getAuth as unknown as jest.Mock).mockReturnValue({
          getUser: jest.fn().mockResolvedValue({ email: 'free@plant.com' }),
        });

        await runGuidanceAlertsJob();

        expect(mockSend).not.toHaveBeenCalled();
      }
    );

    it('sends alert to verified founder without entitlements doc',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const settingsDocs = [
          {
            id: 'uid-founder',
            data: () => ({
              guidanceAlerts: {
                enabled: true,
                email: 'founder-pref@plant.com',
                dipThresholdPct: 3,
              },
            }),
          },
        ];
        const histDocs = [
          { data: () => ({ date: '10/01/2026', cu: '100' }) },
          { data: () => ({ date: '10/04/2026', cu: '90' }) },
        ];
        const matDocs = [
          {
            id: 'mat-1',
            data: () => ({
              name: 'Copper Bar',
              composition: [{ commodityKey: 'cu', ratio: 1000 }],
            }),
          },
        ];
        const companyDocs = [
          {
            id: 'comp-1',
            data: () => ({ name: 'Founder Plant' }),
            ref: {
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: matDocs }),
              })),
            },
          },
        ];

        const colMock = jest.fn((name: string) => {
          if (name === 'user_settings') {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  size: 1,
                  docs: settingsDocs,
                }),
              })),
            };
          }
          if (name === 'entitlements') {
            return {
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: false,
                  data: () => undefined,
                }),
              })),
            };
          }
          if (name === HISTORICAL_COLLECTION) {
            return {
              get: jest.fn().mockResolvedValue({ docs: histDocs }),
            };
          }
          if (name === COMPANIES_COLLECTION) {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  docs: companyDocs,
                }),
              })),
            };
          }
          return {};
        });
        (getFirestore as unknown as jest.Mock).mockReturnValue({
          collection: colMock,
        });
        (getAuth as unknown as jest.Mock).mockReturnValue({
          getUser: jest.fn().mockResolvedValue({
            email: 'MVSaiKishore@gmail.com',
          }),
        });

        await runGuidanceAlertsJob();

        expect(mockSend).toHaveBeenCalledTimes(1);
      }
    );

    it('clamps stored dipThresholdPct below 1 up to MIN_DIP_THRESHOLD_PCT=1',
      async () => {
        process.env.RESEND_API_KEY = 're_test_123';
        const mockSend = jest.fn().mockResolvedValue({ error: null });
        (Resend as unknown as jest.Mock).mockImplementation(() => ({
          emails: { send: mockSend },
        }));

        const settingsDocs = [
          {
            id: 'uid-1',
            data: () => ({
              guidanceAlerts: {
                enabled: true,
                email: 'buyer@plant.com',
                dipThresholdPct: 0.5,
              },
            }),
          },
        ];
        // -0.8% dip triggers at min=0.5 but NOT when clamped to min=1
        const histDocs = [
          { data: () => ({ date: '10/01/2026', cu: '100' }) },
          { data: () => ({ date: '10/04/2026', cu: '99.2' }) },
        ];
        const matDocs = [
          {
            id: 'mat-1',
            data: () => ({
              name: 'Copper Bar',
              composition: [{ commodityKey: 'cu', ratio: 1000 }],
            }),
          },
        ];
        const companyDocs = [
          {
            id: 'comp-1',
            data: () => ({ name: 'Plant One', ownerEmail: 'owner@plant.com' }),
            ref: {
              collection: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ docs: matDocs }),
              })),
            },
          },
        ];

        const colMock = jest.fn((name: string) => {
          if (name === 'user_settings') {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  size: 1,
                  docs: settingsDocs,
                }),
              })),
            };
          }
          if (name === 'entitlements') {
            return {
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ plan: 'premium' }),
                }),
              })),
            };
          }
          if (name === HISTORICAL_COLLECTION) {
            return {
              get: jest.fn().mockResolvedValue({ docs: histDocs }),
            };
          }
          if (name === COMPANIES_COLLECTION) {
            return {
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  empty: false,
                  docs: companyDocs,
                }),
              })),
            };
          }
          return {};
        });
        (getFirestore as unknown as jest.Mock).mockReturnValue({
          collection: colMock,
        });
        (getAuth as unknown as jest.Mock).mockReturnValue({
          getUser: jest.fn().mockResolvedValue({ email: 'auth@plant.com' }),
        });

        await runGuidanceAlertsJob();

        expect(mockSend).not.toHaveBeenCalled();
      }
    );
  });
});
