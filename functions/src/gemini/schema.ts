import { z } from 'zod';

export const extractionRecordSchema = z.object({
  newsletter_issue_date: z.string(),
  month: z.string(),
  year: z.number().int(),
  crca_bundle_mumbai: z.string(),
  crca_bundle_chennai: z.string(),
  melting_foundry_scrap_mumbai: z.string(),
  fe_mn_hc_mumbai: z.string(),
  fe_si_70_75_mumbai: z.string(),
  low_sulp_cal_petro_coke: z.string(),
  fe_si_mg_mumbai: z.string(),
  cu_lme: z.string(),
  cu_domestic: z.string(),
  fe_cr_mumbai: z.string(),
  pig_iron_foundry_gr_pune: z.string(),
  source_pages: z.string(),
});

export type ExtractionRecord = z.infer<typeof extractionRecordSchema>;
