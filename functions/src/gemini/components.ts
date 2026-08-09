// Single source of truth for the MMR commodity components extracted from
// each weekly newsletter. The Zod schema, Sheets headers, the Gemini
// prompt field list, and the dashboard commodity list are all derived
// from this registry so they can never drift apart.
//
// Tiers:
//   'core'     -> master Sheet + Firestore + dashboards
//   'extended' -> Firestore + dashboards only (kept out of the Sheet)
//   'archived' -> Firestore only (kept out of the Sheet AND dashboards);
//                 captured passively so it is on hand for future use
//                 without paying to re-extract the backlog later.
//
// Extraction always captures every component (all tiers) into Firestore.
// Promoting a component up a tier later (e.g. archived -> extended, or
// extended -> core) is a one-line 'tier' change here, not a re-extraction.

export type ComponentTier = 'core' | 'extended' | 'archived';

export interface Component {
  /** Stable field key used in the record, schema, sheet, and dashboard. */
  key: string;
  /** Human-friendly label for dashboards and reports. */
  label: string;
  /** Approximate source page in the newsletter (a grounding hint). */
  page: number;
  /** Source table / section the value is read from. */
  category: string;
  /** Price unit as printed, e.g. 'Rs/kg' or 'Rs/tonne'. */
  unit: string;
  /** Market or basis the quote applies to. */
  market: string;
  /** Visibility tier — see the file header. */
  tier: ComponentTier;
  /** One-line grounding description used in the Gemini prompt. */
  promptDesc: string;
}

export const COMPONENTS: Component[] = [
  // --- Page 6: Domestic Prices (Average rates, Rs/kg) ---
  {
    key: 'aluminium_ingot',
    label: 'Aluminium Ingot',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Aluminium - Ingot, Mumbai average rate (Rs/kg) from the ' +
      'Domestic Prices table (approx. page 6). Use the "As on <date>" ' +
      'average column, not the daily rates.',
  },
  {
    key: 'copper_cathode',
    label: 'Copper Cathode',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Copper - Cathode, Mumbai average rate (Rs/kg) from the ' +
      'Domestic Prices table (approx. page 6). Use the "As on <date>" ' +
      'average column.',
  },
  {
    key: 'tin_ingot',
    label: 'Tin Ingot',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Tin - Ingot, Mumbai average rate (Rs/kg) from the Domestic ' +
      'Prices table (approx. page 6). Use the "As on <date>" average ' +
      'column.',
  },
  // --- Page 7: Primary Material & Semi-finished (Weekly avg, Rs/tonne) ---
  {
    key: 'melting_foundry_scrap_mumbai',
    label: 'Melting Scrap Foundry (Mumbai/Pune)',
    page: 7,
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Mumbai/Pune',
    tier: 'core',
    promptDesc:
      'Melting Scrap (Mumbai/Pune) (Foundry), weekly average ' +
      '(Rs/tonne) from the Primary Material & Semi-finished Products ' +
      'table, Mandi Gobindgarh (approx. page 7).',
  },
  {
    key: 'crca_bundle_mumbai',
    label: 'CRCA-Bundle LSLP (Mumbai/Pune)',
    page: 7,
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Mumbai/Pune',
    tier: 'core',
    promptDesc:
      'Melting Scrap (CRCA - Bundle) LSLP (Mumbai/Pune), weekly ' +
      'average (Rs/tonne) from the Primary Material table (approx. ' +
      'page 7).',
  },
  {
    key: 'crca_bundle_chennai',
    label: 'CRCA-Bundle LSLP (Chennai)',
    page: 7,
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Chennai',
    tier: 'core',
    promptDesc:
      'Melting Scrap (CRCA - Bundle) LSLP (Chennai), weekly average ' +
      '(Rs/tonne) from the Primary Material table (approx. page 7).',
  },
  {
    key: 'pig_iron_sg_grade_a_pune',
    label: 'Pig Iron SG Grade-A (Pune)',
    page: 7,
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'Pune',
    tier: 'core',
    promptDesc:
      'Pig Iron SG Grade - A (Pune), weekly average (Rs/tonne) from ' +
      'the Raw Material section of the Primary Material table ' +
      '(approx. page 7).',
  },
  {
    key: 'pig_iron_foundry_gr_pune',
    label: 'Pig Iron Foundry Grade-A (Pune)',
    page: 7,
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'Pune',
    tier: 'core',
    promptDesc:
      'Pig Iron Foundry Grade - A (Pune), weekly average (Rs/tonne) ' +
      'from the Raw Material section of the Primary Material table ' +
      '(approx. page 7).',
  },
  // --- Page 8: Ferro Alloys & Minor Metals - Mumbai (Weekly avg, Rs/kg) ---
  {
    key: 'fe_si_70_75_mumbai',
    label: 'Ferro Silicon 70-75% (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Ferro Silicon (70-75%), weekly average (Rs/kg) from the Ferro ' +
      'Alloys & Minor Metals - Mumbai table (approx. page 8).',
  },
  {
    key: 'fe_mn_hc_mumbai',
    label: 'Ferro Manganese HC (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Ferro Manganese HC, weekly average (Rs/kg) from the Ferro ' +
      'Alloys & Minor Metals - Mumbai table (approx. page 8).',
  },
  {
    key: 'inoculant_2_6mm_mumbai',
    label: 'Inoculant 2-6mm (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Inoculant 2-6mm, weekly average (Rs/kg) from the Ferro Alloys ' +
      '& Minor Metals - Mumbai table (approx. page 8).',
  },
  {
    key: 'fe_cr_mumbai',
    label: 'Ferro Chromium HC 60-65% (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Ferro Chromium High Carbon 60 to 65%, weekly average (Rs/kg) ' +
      'from the Ferro Alloys & Minor Metals - Mumbai table (approx. ' +
      'page 8).',
  },
  {
    key: 'fe_si_mg_mumbai',
    label: 'Ferro Silicon Magnesium (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'core',
    promptDesc:
      'Ferro Silicon Magnesium, weekly average (Rs/kg) from the ' +
      'Ferro Alloys & Minor Metals - Mumbai table (approx. page 8).',
  },
  // --- Page 8: Raipur Local Market Prices (Basic rates, Rs/kg) ---
  {
    key: 'low_sulp_cal_petro_coke',
    label: 'Import Low-Sulphur CPC 98% (Raipur)',
    page: 8,
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'core',
    promptDesc:
      'Import Low Sulphur (max 1.5%) cal. petro. coke 98%, basic ' +
      'rate (Rs/kg) from the Raipur Local Market Prices table ' +
      '(approx. page 8).',
  },
  {
    key: 'calcinated_petroleum_coke_9_4mm',
    label: 'Calcined Petroleum Coke 9-4mm (Indian)',
    page: 8,
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'core',
    promptDesc:
      'Calcinated Petroleum Coke (9-4mm) (Indian Market), basic rate ' +
      '(Rs/kg) from the Raipur Local Market Prices table (approx. ' +
      'page 8).',
  },
  // --- Page 8: Coke - Ex-Plant Basic Prices (Rs/tonne) ---
  {
    key: 'lam_coke',
    label: 'Lam Coke',
    page: 8,
    category: 'Coke Ex-Plant',
    unit: 'Rs/tonne',
    market: 'Ex-Plant',
    tier: 'core',
    promptDesc:
      'Lam Coke, basic price (Rs per tonne) from the Coke - Ex-Plant ' +
      'Basic Prices table (approx. page 8).',
  },
  // === EXTENDED (Firestore + dashboards only; not written to the Sheet) ===
  {
    key: 'sponge_iron_mg_punjab',
    label: 'Sponge Iron (Mandi Gobindgarh)',
    page: 7,
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'MG-Punjab',
    tier: 'extended',
    promptDesc:
      'Sponge Iron (MG-Punjab), weekly average (Rs/tonne) from the ' +
      'Primary Material table, Mandi Gobindgarh (approx. page 7).',
  },
  {
    key: 'fe_si_70_75_raipur',
    label: 'Ferro Silicon 70/75 (Raipur)',
    page: 8,
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
    promptDesc:
      'Ferro Silicon 70/75, basic rate (Rs/kg) from the Raipur Local ' +
      'Market Prices table (approx. page 8). This is the Raipur quote, ' +
      'distinct from the Mumbai Ferro Silicon.',
  },
  {
    key: 'fe_mn_70_75_raipur',
    label: 'Ferro Manganese 70/75 (Raipur)',
    page: 8,
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
    promptDesc:
      'Ferro Manganese 70/75, basic rate (Rs/kg) from the Raipur ' +
      'Local Market Prices table (approx. page 8).',
  },
  {
    key: 'silico_manganese_mumbai',
    label: 'Silico Manganese (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'extended',
    promptDesc:
      'Silico Manganese, weekly average (Rs/kg) from the Ferro ' +
      'Alloys & Minor Metals - Mumbai table (approx. page 8).',
  },
  {
    key: 'high_fe_mn_78_raipur',
    label: 'High Ferro Manganese 78% (Raipur)',
    page: 8,
    category: 'Raipur Local',
    unit: 'Rs/kg',
    market: 'Raipur',
    tier: 'extended',
    promptDesc:
      'High Ferro Manganese (78% Mn), basic rate (Rs/kg) from the ' +
      'Raipur Local Market Prices table (approx. page 8).',
  },
  {
    key: 'graphite_petroleum_coke_mumbai',
    label: 'Graphite Petroleum Coke (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'extended',
    promptDesc:
      'Graphite Petroleum coke 0.5 to 1mm, weekly average (Rs/kg) ' +
      'from the Ferro Alloys & Minor Metals - Mumbai table (approx. ' +
      'page 8).',
  },
  // === ARCHIVED (Firestore only; not in Sheet, not on dashboards) ===
  {
    key: 'cu_lme',
    label: 'Copper LME (Grade A)',
    page: 1,
    category: 'Global Benchmark',
    unit: 'USD/tonne',
    market: 'LME',
    tier: 'archived',
    promptDesc:
      'LME Settlement Rate for Copper Grade A (London Metal Exchange) ' +
      '- a USD-denominated global benchmark, distinct from the domestic ' +
      'Copper Cathode. Captured for possible future global comparison; ' +
      'typically printed on a summary / front page.',
  },
  // Tier 1: foundry-relevant references (page 7 metallics, page 8 alloys)
  {
    key: 'cast_iron_scrap_bhavnagar',
    label: 'Cast Iron Scrap (Bhavnagar)',
    page: 7,
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Bhavnagar',
    tier: 'archived',
    promptDesc:
      'Cast Iron Scrap (Bhavnagar), weekly average (Rs/tonne) from the ' +
      'Primary Material & Semi-finished Products table, Mandi ' +
      'Gobindgarh (approx. page 7).',
  },
  {
    key: 'heavy_melting_scrap_mumbai_pune',
    label: 'Heavy Melting Scrap (Mumbai/Pune)',
    page: 7,
    category: 'Melting Scrap',
    unit: 'Rs/tonne',
    market: 'Mumbai/Pune',
    tier: 'archived',
    promptDesc:
      'Heavy Melting Scrap (Mumbai/Pune) (old), weekly average ' +
      '(Rs/tonne) from the Primary Material table (approx. page 7).',
  },
  {
    key: 'pig_iron_foundry_grade_b_punjab',
    label: 'Pig Iron Foundry Grade-B (Punjab)',
    page: 7,
    category: 'Raw Material',
    unit: 'Rs/tonne',
    market: 'Punjab',
    tier: 'archived',
    promptDesc:
      'Pig Iron Foundry Grade - B (Punjab), weekly average (Rs/tonne) ' +
      'from the Raw Material section of the Primary Material table ' +
      '(approx. page 7).',
  },
  {
    key: 'steel_shots_mumbai',
    label: 'Steel Shots (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'archived',
    promptDesc:
      'Steel Shots, weekly average (Rs/kg) from the Ferro Alloys & ' +
      'Minor Metals - Mumbai table (approx. page 8).',
  },
  {
    key: 'fe_mn_mc_mumbai',
    label: 'Ferro Manganese MC (Mumbai)',
    page: 8,
    category: 'Ferro Alloys',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'archived',
    promptDesc:
      'Ferro Manganese MC (medium carbon), weekly average (Rs/kg) ' +
      'from the Ferro Alloys & Minor Metals - Mumbai table (approx. ' +
      'page 8).',
  },
  // Tier 2: domestic non-ferrous macro benchmarks (page 6, Rs/kg, Mumbai)
  {
    key: 'zinc_ingot',
    label: 'Zinc Ingot',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'archived',
    promptDesc:
      'Zinc - Ingot, Mumbai average rate (Rs/kg) from the Domestic ' +
      'Prices table (approx. page 6). Use the "As on <date>" average ' +
      'column.',
  },
  {
    key: 'lead_ingot',
    label: 'Lead Ingot',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'archived',
    promptDesc:
      'Lead - Ingot, Mumbai average rate (Rs/kg) from the Domestic ' +
      'Prices table (approx. page 6). Use the "As on <date>" average ' +
      'column.',
  },
  {
    key: 'nickel_ingot',
    label: 'Nickel Ingot',
    page: 6,
    category: 'Domestic Prices',
    unit: 'Rs/kg',
    market: 'Mumbai',
    tier: 'archived',
    promptDesc:
      'Nickel - Ingot, Mumbai average rate (Rs/kg) from the Domestic ' +
      'Prices table (approx. page 6). Use the "As on <date>" average ' +
      'column.',
  },
];

/** All component keys, in registry (display) order. */
export const ALL_KEYS: string[] = COMPONENTS.map((c) => c.key);

/** Keys of components written to the master Sheet (tier === 'core'). */
export const CORE_KEYS: string[] = COMPONENTS.filter(
  (c) => c.tier === 'core'
).map((c) => c.key);

/** Keys of components kept out of the Sheet (tier === 'extended'). */
export const EXTENDED_KEYS: string[] = COMPONENTS.filter(
  (c) => c.tier === 'extended'
).map((c) => c.key);

/** Keys captured to Firestore only (tier === 'archived'). */
export const ARCHIVED_KEYS: string[] = COMPONENTS.filter(
  (c) => c.tier === 'archived'
).map((c) => c.key);

/**
 * Builds the bulleted field list injected into the Gemini prompt, one
 * line per component: "- <key>: <grounding description>".
 * @return {string} The newline-joined prompt field list.
 */
export function buildPromptFields(): string {
  return COMPONENTS.map((c) => `- ${c.key}: ${c.promptDesc}`).join('\n');
}
