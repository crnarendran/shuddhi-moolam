import { describe, it, expect } from 'vitest';
import {
  simulateScenario,
  applyScenarioComposition,
  applyScenarioPrices,
  type ScenarioOverride,
} from './scenario';
import { DEFAULT_SUB_GROUPS } from './guidance';
import { ALL_COMMODITIES, type PriceRecord } from './reporting';

const comp = [
  { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
  { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
  { commodityKey: 'fe_si_70_75_mumbai', ratio: 50 },
];

const latest: PriceRecord = {
  date: '10/08/2026',
  pig_iron_sg_grade_a_pune: '50',
  melting_foundry_scrap_mumbai: '46',
  fe_si_70_75_mumbai: '120',
  fe_si_70_75_raipur: '130',
};

describe('simulateScenario', () => {
  it('returns identical cost and zero delta with no overrides', () => {
    const res = simulateScenario(
      comp,
      latest,
      {},
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    // (500*50 + 500*46 + 50*120) / 1000 = (25000 + 23000 + 6000) / 1000 = 54
    expect(res.baseCost).toBeCloseTo(54, 9);
    expect(res.scenarioCost).toBeCloseTo(54, 9);
    expect(res.delta).toBe(0);
    expect(res.deltaPct).toBe(0);
    expect(res.baseGrams).toBe(1050);
    expect(res.scenarioGrams).toBe(1050);
    expect(res.hasChanges).toBe(false);
    expect(res.items).toHaveLength(3);
  });

  it('recalculates blended cost on a +10% price move incl. >1000 g mass',
    () => {
      const overrides: Record<string, ScenarioOverride> = {
        pig_iron_sg_grade_a_pune: { priceDeltaPct: 10 },
      };
      const res = simulateScenario(
        comp,
        latest,
        overrides,
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      // Pig iron: 50 -> 55; +5 * 500 / 1000 = +2.5 Rs/kg (54 -> 56.5)
      expect(res.baseCost).toBeCloseTo(54, 9);
      expect(res.scenarioCost).toBeCloseTo(56.5, 9);
      expect(res.delta).toBeCloseTo(2.5, 9);
      expect(res.deltaPct).toBeCloseTo((2.5 / 54) * 100, 9);
      expect(res.hasChanges).toBe(true);
      expect(res.items[0].scenarioPrice).toBeCloseTo(55, 9);
      expect(res.items[0].deltaContribution).toBeCloseTo(2.5, 9);
    }
  );

  it('clamps scenario price at 0 when priceDeltaPct drops below -100%',
    () => {
      const overrides: Record<string, ScenarioOverride> = {
        fe_si_70_75_mumbai: { priceDeltaPct: -150 },
      };
      const res = simulateScenario(
        comp,
        latest,
        overrides,
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(res.items[2].scenarioPrice).toBe(0);
      // (25000 + 23000 + 0) / 1000 = 48
      expect(res.scenarioCost).toBeCloseTo(48, 9);
      expect(res.delta).toBeCloseTo(-6, 9);
    }
  );

  it('prefers priceOverride over priceDeltaPct and prices unpriced rows',
    () => {
      const partialLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: '50',
        melting_foundry_scrap_mumbai: '46',
      };
      const overrides: Record<string, ScenarioOverride> = {
        pig_iron_sg_grade_a_pune: { priceDeltaPct: 50, priceOverride: 60 },
        fe_si_70_75_mumbai: { priceOverride: 100 },
      };
      const prices = applyScenarioPrices(partialLatest, comp, overrides);
      expect(prices?.pig_iron_sg_grade_a_pune).toBe(60);
      expect(prices?.fe_si_70_75_mumbai).toBe(100);

      const res = simulateScenario(
        comp,
        partialLatest,
        overrides,
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(res.items[0].scenarioPrice).toBe(60);
      expect(res.items[2].basePrice).toBeNull();
      expect(res.items[2].scenarioPrice).toBe(100);
      // (500*60 + 500*46 + 50*100) / 1000 = 58
      expect(res.scenarioCost).toBeCloseTo(58, 9);
    }
  );

  it('updates recipe mass and blended cost on ratio overrides, clamping <0',
    () => {
      const overrides: Record<string, ScenarioOverride> = {
        melting_foundry_scrap_mumbai: { ratio: 600 },
        fe_si_70_75_mumbai: { ratio: -10 },
      };
      const nextComp = applyScenarioComposition(comp, overrides);
      expect(nextComp[1].ratio).toBe(600);
      expect(nextComp[2].ratio).toBe(0);

      const res = simulateScenario(
        comp,
        latest,
        overrides,
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      // (500*50 + 600*46 + 0*120) / 1000 = (25000 + 27600) / 1000 = 52.6
      expect(res.baseGrams).toBe(1050);
      expect(res.scenarioGrams).toBe(1100);
      expect(res.scenarioCost).toBeCloseTo(52.6, 9);
      expect(res.delta).toBeCloseTo(-1.4, 9);
      expect(res.hasChanges).toBe(true);
    }
  );

  it('handles null latest record safely without NaN', () => {
    const res = simulateScenario(
      comp,
      null,
      { pig_iron_sg_grade_a_pune: { priceDeltaPct: 10 } },
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    expect(res.baseCost).toBeNull();
    expect(res.scenarioCost).toBeNull();
    expect(res.delta).toBeNull();
    expect(res.deltaPct).toBeNull();
    expect(res.scenarioSwaps).toEqual([]);
  });

  it('recomputes substitution swaps when a price move changes cheapest pick',
    () => {
      // Base: fe_si_70_75_mumbai is 120, cheaper than raipur (130) -> no swap
      const baseRes = simulateScenario(
        comp,
        latest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(
        baseRes.scenarioSwaps.some((s) => s.from.key === 'fe_si_70_75_mumbai')
      ).toBe(false);

      // Move Mumbai up +25% (120 -> 150 > Raipur 130): swap now saves Rs 1/kg
      const bumpedRes = simulateScenario(
        comp,
        latest,
        { fe_si_70_75_mumbai: { priceDeltaPct: 25 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      const swap = bumpedRes.scenarioSwaps.find(
        (s) => s.from.key === 'fe_si_70_75_mumbai'
      );
      expect(swap).toBeDefined();
      expect(swap?.to.key).toBe('fe_si_70_75_raipur');
      // (150 - 130) * 50 / 1000 = 1.0 Rs/kg of product
      expect(swap?.saving).toBeCloseTo(1.0, 9);
    }
  );

  it('imputes unpriced rows at priced avg and sums contributions to total',
    () => {
      const mixedComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
      ];
      const partialLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: '50',
      };
      const res = simulateScenario(
        mixedComp,
        partialLatest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(res.baseCost).toBeCloseTo(50, 9);
      expect(res.scenarioCost).toBeCloseTo(50, 9);
      expect(res.items[0].baseImputed).toBe(false);
      expect(res.items[0].scenarioImputed).toBe(false);
      expect(res.items[1].baseImputed).toBe(true);
      expect(res.items[1].scenarioImputed).toBe(true);
      const baseSum = res.items.reduce(
        (acc, it) => acc + (it.baseContribution ?? 0),
        0
      );
      const scenSum = res.items.reduce(
        (acc, it) => acc + (it.scenarioContribution ?? 0),
        0
      );
      expect(baseSum).toBeCloseTo(res.baseCost ?? NaN, 9);
      expect(scenSum).toBeCloseTo(res.scenarioCost ?? NaN, 9);
    }
  );

  it('gives negative deltaContribution when priceOverride is below avg',
    () => {
      const mixedComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
      ];
      const partialLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: '50',
      };
      const res = simulateScenario(
        mixedComp,
        partialLatest,
        { melting_foundry_scrap_mumbai: { priceOverride: 30 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(res.items[1].baseImputed).toBe(true);
      expect(res.items[1].scenarioImputed).toBe(false);
      expect(res.items[1].baseContribution).toBeCloseTo(25, 9);
      expect(res.items[1].scenarioContribution).toBeCloseTo(15, 9);
      expect(res.items[1].deltaContribution).toBeCloseTo(-10, 9);
      expect(res.delta).toBeCloseTo(-10, 9);
      expect(res.items[1].deltaContribution).toBeCloseTo(res.delta ?? NaN, 9);
    }
  );

  it('matches result.delta when changing unpriced row grams', () => {
    const mixedComp = [
      { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
      { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
    ];
    const partialLatest: PriceRecord = {
      date: '10/08/2026',
      pig_iron_sg_grade_a_pune: '50',
    };
    const res = simulateScenario(
      mixedComp,
      partialLatest,
      { melting_foundry_scrap_mumbai: { ratio: 600 } },
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    expect(res.items[1].baseContribution).toBeCloseTo(25, 9);
    expect(res.items[1].scenarioContribution).toBeCloseTo(30, 9);
    expect(res.items[1].deltaContribution).toBeCloseTo(5, 9);
    expect(res.delta).toBeCloseTo(5, 9);
    expect(res.items[1].deltaContribution).toBeCloseTo(res.delta ?? NaN, 9);
  });

  it('sets null contributions when latest is null', () => {
    const res = simulateScenario(
      comp,
      null,
      {},
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    for (const item of res.items) {
      expect(item.baseContribution).toBeNull();
      expect(item.scenarioContribution).toBeNull();
      expect(item.deltaContribution).toBeNull();
      expect(item.baseImputed).toBe(false);
      expect(item.scenarioImputed).toBe(false);
    }
  });

  it('supports per-row overrides when commodity keys duplicate in recipe',
    () => {
      const dupComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 300 },
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 200 },
        { commodityKey: 'fe_si_70_75_mumbai', ratio: 50 },
      ];
      const nextComp = applyScenarioComposition(
        dupComp,
        { pig_iron_sg_grade_a_pune: { ratio: 100 } },
        { 1: 400 }
      );
      expect(nextComp.map((c) => c.ratio)).toEqual([100, 400, 50]);

      const res = simulateScenario(
        dupComp,
        latest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES,
        { 1: 400 }
      );
      expect(res.items[0].scenarioGrams).toBe(300);
      expect(res.items[1].scenarioGrams).toBe(400);
      expect(res.scenarioGrams).toBe(750);
      // (300*50 + 400*50 + 50*120) / 1000 = 41
      expect(res.scenarioCost).toBeCloseTo(41, 9);
      expect(res.hasChanges).toBe(true);
    }
  );

  it('returns 0 cost and -100% delta when all priced recipe grams are zeroed',
    () => {
      const res = simulateScenario(
        comp,
        latest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES,
        { 0: 0, 1: 0, 2: 0 }
      );
      expect(res.scenarioGrams).toBe(0);
      expect(res.scenarioCost).toBe(0);
      expect(res.delta).toBeCloseTo(-54, 9);
      expect(res.deltaPct).toBeCloseTo(-100, 9);
      expect(res.hasChanges).toBe(true);

      const zeroBaseRes = simulateScenario(
        [{ commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 0 }],
        latest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(zeroBaseRes.baseCost).toBe(0);
      expect(zeroBaseRes.scenarioCost).toBe(0);
      expect(zeroBaseRes.delta).toBe(0);
      expect(zeroBaseRes.deltaPct).toBe(0);

      const emptyRes = simulateScenario(
        [],
        latest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(emptyRes.baseCost).toBeNull();
      expect(emptyRes.scenarioCost).toBeNull();

      const unpricedZeroRes = simulateScenario(
        [{ commodityKey: 'missing_key', ratio: 0 }],
        { date: '10/08/2026' },
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(unpricedZeroRes.baseCost).toBeNull();
      expect(unpricedZeroRes.scenarioCost).toBeNull();
    }
  );

  it('clamps negative and non-finite base ratios before simulation', () => {
    const badComp = [
      { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
      { commodityKey: 'fe_si_70_75_mumbai', ratio: -100 },
      { commodityKey: 'melting_foundry_scrap_mumbai', ratio: Number.NaN },
    ];
    const res = simulateScenario(
      badComp,
      latest,
      {},
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    expect(res.baseGrams).toBe(500);
    expect(res.baseCost).toBeCloseTo(25, 9);
    expect(res.scenarioCost).toBeCloseTo(25, 9);
    expect(res.items[1].baseGrams).toBe(0);
    expect(res.items[2].baseGrams).toBe(0);
    expect(res.hasChanges).toBe(false);
  });

  it('guards against reserved keys and prototype-chain lookups', () => {
    const hazardComp = [
      { commodityKey: 'date', ratio: 500 },
      { commodityKey: 'toString', ratio: 500 },
      { commodityKey: 'constructor', ratio: 500 },
      { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
    ];
    const hazardOverrides = Object.create(null) as Record<
      string,
      ScenarioOverride
    >;
    hazardOverrides['__proto__'] = { priceOverride: 999 };
    hazardOverrides['constructor'] = { priceOverride: 999 };
    hazardOverrides['prototype'] = { priceOverride: 999 };
    hazardOverrides['date'] = { priceOverride: 999 };

    const prices = applyScenarioPrices(latest, hazardComp, hazardOverrides);
    expect(prices?.date).toBe('10/08/2026');
    expect(
      applyScenarioPrices(null, [{ commodityKey: 'date', ratio: 100 }], {
        date: { priceOverride: 999 },
      })
    ).toBeNull();

    const dateOnlyRes = simulateScenario(
      [{ commodityKey: 'date', ratio: 500 }],
      latest,
      hazardOverrides,
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    expect(dateOnlyRes.baseCost).toBeNull();
    expect(dateOnlyRes.scenarioCost).toBeNull();
    expect(dateOnlyRes.items[0].basePrice).toBeNull();
    expect(dateOnlyRes.items[0].scenarioPrice).toBeNull();

    const mixedRes = simulateScenario(
      hazardComp,
      latest,
      hazardOverrides,
      DEFAULT_SUB_GROUPS,
      ALL_COMMODITIES
    );
    expect(mixedRes.items[0].basePrice).toBeNull();
    expect(mixedRes.items[1].basePrice).toBeNull();
    expect(mixedRes.items[2].basePrice).toBeNull();
    expect(mixedRes.items[2].scenarioPrice).toBeNull();
    expect(mixedRes.hasChanges).toBe(false);
  });

  it('falls back to basePrice if percentage scaling overflows to Infinity',
    () => {
      const bigLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: String(Number.MAX_VALUE),
      };
      const res = simulateScenario(
        [{ commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 1000 }],
        bigLatest,
        { pig_iron_sg_grade_a_pune: { priceDeltaPct: 1000 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(Number.isFinite(res.items[0].scenarioPrice)).toBe(true);
      expect(res.items[0].scenarioPrice).toBe(Number.MAX_VALUE);
    }
  );

  it('handles null latest with explicit priceOverride and preserves null base',
    () => {
      const mixedComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
      ];
      const res = simulateScenario(
        mixedComp,
        null,
        { pig_iron_sg_grade_a_pune: { priceOverride: 40 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(res.baseCost).toBeNull();
      expect(res.scenarioCost).toBeCloseTo(40, 9);
      expect(res.delta).toBeNull();
      expect(res.items[0].baseContribution).toBeNull();
      expect(res.items[0].scenarioContribution).toBeCloseTo(20, 9);
      expect(res.items[0].scenarioImputed).toBe(false);
      expect(res.items[0].deltaContribution).toBeNull();
      expect(res.items[1].baseContribution).toBeNull();
      expect(res.items[1].scenarioContribution).toBeCloseTo(20, 9);
      expect(res.items[1].scenarioImputed).toBe(true);
      expect(res.items[1].deltaContribution).toBeNull();
      expect(res.hasChanges).toBe(true);
    }
  );

  it('keeps ₹0 base price unchanged on % move and ignores JSON __proto__',
    () => {
      const zeroPriceLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: '0',
      };
      const zeroRes = simulateScenario(
        [{ commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 }],
        zeroPriceLatest,
        { pig_iron_sg_grade_a_pune: { priceDeltaPct: 50 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(zeroRes.items[0].basePrice).toBe(0);
      expect(zeroRes.items[0].scenarioPrice).toBe(0);
      expect(zeroRes.hasChanges).toBe(false);

      const jsonOverrides = JSON.parse(
        '{"__proto__": {"priceOverride": 999}}'
      ) as Record<string, ScenarioOverride>;
      const prices = applyScenarioPrices(latest, comp, jsonOverrides);
      expect(prices).not.toBeNull();
      expect(Object.getPrototypeOf({})).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).priceOverride).toBeUndefined();
    }
  );

  it('keeps 0g row contributions/deltas consistent when mixed recipe hits 0g',
    () => {
      const mixedComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 500 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
      ];
      const partialLatest: PriceRecord = {
        date: '10/08/2026',
        pig_iron_sg_grade_a_pune: '50',
      };

      const zeroed = simulateScenario(
        mixedComp,
        partialLatest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES,
        { 0: 0, 1: 0 }
      );
      expect(zeroed.baseCost).toBeCloseTo(50, 9);
      expect(zeroed.scenarioCost).toBe(0);
      expect(zeroed.delta).toBeCloseTo(-50, 9);
      expect(zeroed.items[0].scenarioContribution).toBe(0);
      expect(zeroed.items[0].deltaContribution).toBeCloseTo(-25, 9);
      expect(zeroed.items[1].scenarioContribution).toBe(0);
      expect(zeroed.items[1].deltaContribution).toBeCloseTo(-25, 9);

      const zeroBaseComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: 0 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 0 },
      ];
      const raised = simulateScenario(
        zeroBaseComp,
        partialLatest,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES,
        { 0: 500, 1: 500 }
      );
      expect(raised.baseCost).toBe(0);
      expect(raised.scenarioCost).toBeCloseTo(50, 9);
      expect(raised.delta).toBeCloseTo(50, 9);
      expect(raised.items[1].baseContribution).toBe(0);
      expect(raised.items[1].scenarioContribution).toBeCloseTo(25, 9);
      expect(raised.items[1].deltaContribution).toBeCloseTo(25, 9);

      const nullLatest = simulateScenario(
        zeroBaseComp,
        null,
        {},
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES
      );
      expect(nullLatest.baseCost).toBeNull();
      expect(nullLatest.items[0].baseContribution).toBeNull();
      expect(nullLatest.items[1].baseContribution).toBeNull();
    }
  );

  it('normalizes negative zero (-0) in ratio, rowRatios, and priceOverride',
    () => {
      const negZeroComp = [
        { commodityKey: 'pig_iron_sg_grade_a_pune', ratio: -0 },
        { commodityKey: 'melting_foundry_scrap_mumbai', ratio: 500 },
      ];
      const res = simulateScenario(
        negZeroComp,
        latest,
        { pig_iron_sg_grade_a_pune: { priceOverride: -0 } },
        DEFAULT_SUB_GROUPS,
        ALL_COMMODITIES,
        { 1: -0 }
      );
      expect(Object.is(res.items[0].baseGrams, 0)).toBe(true);
      expect(Object.is(res.items[0].scenarioGrams, 0)).toBe(true);
      expect(Object.is(res.items[0].scenarioPrice, 0)).toBe(true);
      expect(Object.is(res.items[1].scenarioGrams, 0)).toBe(true);
    }
  );
});
