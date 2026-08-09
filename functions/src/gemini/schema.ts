import { z } from 'zod';

// The extraction contract. Core price fields are required strings (an
// explicit "" when absent, so missing data is visible in the Sheet);
// extended price fields are optional so a single missing supplementary
// value never fails the whole extraction. The field set is the
// component registry in ./components.ts — see components.test.ts, which
// guards this schema against drift from that registry.

export const extractionRecordSchema = z.object({
  filename: z.string().optional(),
  date: z.string(),
  // --- core (written to the master Sheet) ---
  aluminium_ingot: z.string(),
  copper_cathode: z.string(),
  tin_ingot: z.string(),
  melting_foundry_scrap_mumbai: z.string(),
  crca_bundle_mumbai: z.string(),
  crca_bundle_chennai: z.string(),
  pig_iron_sg_grade_a_pune: z.string(),
  pig_iron_foundry_gr_pune: z.string(),
  fe_si_70_75_mumbai: z.string(),
  fe_mn_hc_mumbai: z.string(),
  inoculant_2_6mm_mumbai: z.string(),
  fe_cr_mumbai: z.string(),
  fe_si_mg_mumbai: z.string(),
  low_sulp_cal_petro_coke: z.string(),
  calcinated_petroleum_coke_9_4mm: z.string(),
  lam_coke: z.string(),
  // --- extended (Firestore + dashboards only) ---
  sponge_iron_mg_punjab: z.string().optional(),
  fe_si_70_75_raipur: z.string().optional(),
  fe_mn_70_75_raipur: z.string().optional(),
  silico_manganese_mumbai: z.string().optional(),
  high_fe_mn_78_raipur: z.string().optional(),
  graphite_petroleum_coke_mumbai: z.string().optional(),
  // --- archived (Firestore only) ---
  cu_lme: z.string().optional(),
  cast_iron_scrap_bhavnagar: z.string().optional(),
  heavy_melting_scrap_mumbai_pune: z.string().optional(),
  pig_iron_foundry_grade_b_punjab: z.string().optional(),
  steel_shots_mumbai: z.string().optional(),
  fe_mn_mc_mumbai: z.string().optional(),
  zinc_ingot: z.string().optional(),
  lead_ingot: z.string().optional(),
  nickel_ingot: z.string().optional(),
  // --- metadata ---
  source_pages: z.string(),
  last_modified_date: z.string().optional(),
});

export type ExtractionRecord = z.infer<typeof extractionRecordSchema>;
