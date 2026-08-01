"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractionRecordSchema = void 0;
const zod_1 = require("zod");
exports.extractionRecordSchema = zod_1.z.object({
    newsletter_issue_date: zod_1.z.string(),
    year: zod_1.z.number().int(),
    crca_bundle_mumbai: zod_1.z.string(),
    crca_bundle_chennai: zod_1.z.string(),
    melting_foundry_scrap_mumbai: zod_1.z.string(),
    fe_mn_hc_mumbai: zod_1.z.string(),
    fe_si_70_75_mumbai: zod_1.z.string(),
    low_sulp_cal_petro_coke: zod_1.z.string(),
    fe_si_mg_mumbai: zod_1.z.string(),
    cu_lme: zod_1.z.string(),
    cu_domestic: zod_1.z.string(),
    fe_cr_mumbai: zod_1.z.string(),
    pig_iron_foundry_gr_pune: zod_1.z.string(),
});
//# sourceMappingURL=schema.js.map