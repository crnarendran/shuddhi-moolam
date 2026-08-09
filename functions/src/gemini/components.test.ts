import {
  COMPONENTS,
  ALL_KEYS,
  CORE_KEYS,
  EXTENDED_KEYS,
  ARCHIVED_KEYS,
  buildPromptFields,
} from './components';

describe('component registry', () => {
  it('has 23 components: 16 core + 6 extended + 1 archived', () => {
    expect(COMPONENTS).toHaveLength(23);
    expect(CORE_KEYS).toHaveLength(16);
    expect(EXTENDED_KEYS).toHaveLength(6);
    expect(ARCHIVED_KEYS).toHaveLength(1);
    expect(ALL_KEYS).toHaveLength(23);
  });

  it('has unique keys', () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it('keeps Copper LME as an archived (Firestore-only) field', () => {
    expect(ARCHIVED_KEYS).toContain('cu_lme');
    expect(CORE_KEYS).not.toContain('cu_lme');
    expect(EXTENDED_KEYS).not.toContain('cu_lme');
  });

  it('the three tiers partition all keys with no overlap', () => {
    expect([...CORE_KEYS, ...EXTENDED_KEYS, ...ARCHIVED_KEYS].sort()).toEqual(
      [...ALL_KEYS].sort()
    );
    const seen = new Set<string>();
    for (const k of [...CORE_KEYS, ...EXTENDED_KEYS, ...ARCHIVED_KEYS]) {
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('every component carries the required metadata', () => {
    for (const c of COMPONENTS) {
      expect(c.key).toMatch(/^[a-z0-9_]+$/);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.page).toBeGreaterThan(0);
      expect(c.category.length).toBeGreaterThan(0);
      expect(['Rs/kg', 'Rs/tonne', 'USD/tonne']).toContain(c.unit);
      expect(c.promptDesc.length).toBeGreaterThan(10);
    }
  });

  it('builds one prompt line per component', () => {
    const lines = buildPromptFields().split('\n');
    expect(lines).toHaveLength(23);
    expect(lines[0]).toContain('aluminium_ingot');
  });
});
