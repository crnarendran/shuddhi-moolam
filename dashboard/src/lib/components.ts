// Dashboard mirror of the backend component registry
// (functions/src/gemini/components.ts). Kept in sync by hand — the two
// live in separate TypeScript packages. Update BOTH when a component
// changes. Excludes the Gemini promptDesc (backend-only).
//
// Tiers:
//   'core'     -> master Sheet + Firestore + dashboards
//   'extended' -> Firestore + dashboards only (badged in the UI)
//   'archived' -> Firestore only; NOT shown on dashboards (captured
//                 passively, e.g. Copper LME for future comparison)

export type ComponentTier = 'core' | 'extended' | 'archived';

export interface Component {
  key: string;
  label: string;
  category: string;
  unit: string;
  market: string;
  tier: ComponentTier;
}

export const COMPONENTS: Component[] = [
  // Page 6 — Domestic Prices (Rs/kg)
  {
    key: 'aluminium_ingot',
    label: 'Aluminium Ingot',
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'copper_cathode',
    label: 'Copper Cathode',
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'tin_ingot',
    label: 'Tin Ingot',
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  // Page 7 — Primary Material & Semi-finished (Rs/tonne)
  {
    key: 'melting_foundry_scrap_mumbai',
    label: 'Melting Scrap Foundry (Mumbai/Pune)',
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Mumbai/Pune',
    tier: 'core',
  },
  {
    key: 'crca_bundle_mumbai',
    label: 'CRCA-Bundle LSLP (Mumbai/Pune)',
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Mumbai/Pune',
    tier: 'core',
  },
  {
    key: 'crca_bundle_chennai',
    label: 'CRCA-Bundle LSLP (Chennai)',
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Chennai',
    tier: 'core',
  },
  {
    key: 'pig_iron_sg_grade_a_pune',
    label: 'Pig Iron SG Grade-A (Pune)',
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'Pune',
    tier: 'core',
  },
  {
    key: 'pig_iron_foundry_gr_pune',
    label: 'Pig Iron Foundry Grade-A (Pune)',
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'Pune',
    tier: 'core',
  },
  // Page 8 — Ferro Alloys & Minor Metals, Mumbai (Rs/kg)
  {
    key: 'fe_si_70_75_mumbai',
    label: 'Ferro Silicon 70-75% (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'fe_mn_hc_mumbai',
    label: 'Ferro Manganese HC (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'inoculant_2_6mm_mumbai',
    label: 'Inoculant 2-6mm (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'fe_cr_mumbai',
    label: 'Ferro Chromium HC 60-65% (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  {
    key: 'fe_si_mg_mumbai',
    label: 'Ferro Silicon Magnesium (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
  },
  // Page 8 — Raipur Local Market (Rs/kg)
  {
    key: 'low_sulp_cal_petro_coke',
    label: 'Import Low-Sulphur CPC 98% (Raipur)',
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'core',
  },
  {
    key: 'calcinated_petroleum_coke_9_4mm',
    label: 'Calcined Petroleum Coke 9-4mm (Indian)',
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'core',
  },
  // Page 8 — Coke Ex-Plant (Rs/tonne)
  {
    key: 'lam_coke',
    label: 'Lam Coke',
    category: 'Coke Ex-Plant',
    unit: 'Rs/tonne',
    market: 'Ex-Plant',
    tier: 'core',
  },
  // === Extended (dashboards + Firestore only) ===
  {
    key: 'sponge_iron_mg_punjab',
    label: 'Sponge Iron (Mandi Gobindgarh)',
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'MG-Punjab',
    tier: 'extended',
  },
  {
    key: 'fe_si_70_75_raipur',
    label: 'Ferro Silicon 70/75 (Raipur)',
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
  },
  {
    key: 'fe_mn_70_75_raipur',
    label: 'Ferro Manganese 70/75 (Raipur)',
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
  },
  {
    key: 'silico_manganese_mumbai',
    label: 'Silico Manganese (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'extended',
  },
  {
    key: 'high_fe_mn_78_raipur',
    label: 'High Ferro Manganese 78% (Raipur)',
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
  },
  {
    key: 'graphite_petroleum_coke_mumbai',
    label: 'Graphite Petroleum Coke (Mumbai)',
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'extended',
  },
  // Archived: captured in Firestore but hidden from dashboards.
  {
    key: 'cu_lme',
    label: 'Copper LME (Grade A)',
    category: 'Global Benchmark',
    unit: 'USD/tonne',
    market: 'LME',
    tier: 'archived',
  },
];

/** Components shown on dashboards (core + extended; excludes archived). */
export const VISIBLE_COMPONENTS: Component[] = COMPONENTS.filter(
  (c) => c.tier !== 'archived'
);

/** Core-tier components (also shown in the master Sheet). */
export const CORE_COMPONENTS: Component[] = COMPONENTS.filter(
  (c) => c.tier === 'core'
);

/** Extended-tier components (dashboards + store only). */
export const EXTENDED_COMPONENTS: Component[] = COMPONENTS.filter(
  (c) => c.tier === 'extended'
);
