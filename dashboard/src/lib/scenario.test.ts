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
});
