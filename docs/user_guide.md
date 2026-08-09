---
title: User Guide
section: User Guides
category: Onboarding
requiresLogin: false
---
# User Guide

This guide describes how to trigger and monitor the automated **Shuddhi-Moolam** PDF processing pipeline and where the extracted commodity pricing data lands in Google Sheets.

---

## Who This Is For

This guide is for business operations team members and analysts who receive weekly newsletter PDFs (e.g. *Minerals & Metals Review*) and maintain the master commodity pricing spreadsheet. 

No coding or software execution is required. You simply upload weekly PDF newsletters into a designated Google Drive folder, and the pipeline automatically extracts and appends the structured data to the master spreadsheet.

---

## Uploading a Newsletter

### Destination Folder
Upload weekly newsletter PDFs directly into the shared Google Drive folder:
- **Drive Folder ID**: `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`
- **Subfolders**: You may organize files into subfolders within this root folder. The pipeline recursively watches all subfolders (up to 10 folder levels deep) for new files.

### File Requirements
- **File Format**: PDF (`application/pdf`) only.
- **Maximum File Size**: 15 MB per file.
- **Naming**: Any standard filename (e.g., `MMRW27072026.pdf`).

### Automated Pipeline Ingestion
1. **Push Webhook**: When a PDF is added to the watched Drive folder, Google Drive fires a push notification to the Cloud Function webhook (`driveWebhook`).
2. **Ancestry & Filtering**: The pipeline checks the folder tree hierarchy to ensure the PDF resides within the designated root folder.
3. **Deduplication**: The pipeline verifies whether the file has already been processed or is currently pending in Firestore. If it has already been processed, duplicate notifications are ignored.
4. **Queueing**: Valid new PDFs are added to the Firestore queue (`_system/pending_pdfs/{fileId}`), triggering immediate asynchronous extraction.

---

## Where the Data Lands

### Master Spreadsheet
All extracted pricing records are automatically appended to the master Google Sheet:
- **Spreadsheet ID**: `1DNB8wkqGiVZ1fED4tSVI43PdNY6cY9NdYO6HsZJ-hoY`

### Year-Based Routing & Dynamic Tabs
The pipeline automatically routes each newsletter's data based on its publication year:
- **Tab Naming**: Each year has its own dedicated tab named `Data_<year>` (e.g. `Data_2025`, `Data_2026`).
- **Automatic Tab Creation**: If a newsletter belongs to a year that doesn't have a tab yet (for example, the first newsletter of 2027), the pipeline automatically creates the `Data_2027` tab and populates the canonical column headers before appending the row.

---

## What Gets Extracted: the Three Tiers

Each newsletter issue is read into **31 tracked components**, but not every
component appears in every place. Each has a **tier** that controls where it
shows up:

| Tier | Count | Master Sheet | Dashboards | Data store (Firestore) |
|---|---|:--:|:--:|:--:|
| **core** | 16 | ✅ | ✅ | ✅ |
| **extended** | 6 | — | ✅ | ✅ |
| **archived** | 9 | — | — | ✅ |

Every component is always captured into the data store. **Extended** items are
useful commodities shown on the dashboards but deliberately kept out of the
master Sheet (pending a decision to promote them). **Archived** items (e.g.
Copper LME, domestic Zinc/Lead/Nickel) are captured passively for possible
future use, and are hidden from both the Sheet and the dashboards.

> Why capture things we don't yet show? Adding a component to the extraction is
> essentially free; the costly step is re-reading the entire PDF backlog. So we
> capture generously once and decide later where each one is displayed — moving
> a component up a tier never requires re-processing the PDFs.

## Reading an Extracted Row (the Master Sheet)

Each row on a year tab corresponds to one weekly issue. The master Sheet shows
the **16 core columns** plus 4 metadata columns, in this left-to-right order:
`filename`, `date`, the 16 core commodities below, `source_pages`,
`last_modified_date`.

| Core Column | Description | Unit | Example |
|---|---|---|---|
| `aluminium_ingot` | Aluminium Ingot (Mumbai) | Rs/kg | `339` |
| `copper_cathode` | Copper Cathode (Mumbai) | Rs/kg | `1,326` |
| `tin_ingot` | Tin Ingot (Mumbai) | Rs/kg | `5,349` |
| `melting_foundry_scrap_mumbai` | Melting Scrap Foundry (Mumbai/Pune) | Rs/tonne | `46,500` |
| `crca_bundle_mumbai` | CRCA-Bundle LSLP (Mumbai/Pune) | Rs/tonne | `47,400` |
| `crca_bundle_chennai` | CRCA-Bundle LSLP (Chennai) | Rs/tonne | `49,000` |
| `pig_iron_sg_grade_a_pune` | Pig Iron SG Grade-A (Pune) | Rs/tonne | `49,500` |
| `pig_iron_foundry_gr_pune` | Pig Iron Foundry Grade-A (Pune) | Rs/tonne | `48,000` |
| `fe_si_70_75_mumbai` | Ferro Silicon 70-75% (Mumbai) | Rs/kg | `109` |
| `fe_mn_hc_mumbai` | Ferro Manganese HC (Mumbai) | Rs/kg | `95` |
| `inoculant_2_6mm_mumbai` | Inoculant 2-6mm (Mumbai) | Rs/kg | `208` |
| `fe_cr_mumbai` | Ferro Chromium HC 60-65% (Mumbai) | Rs/kg | `140` |
| `fe_si_mg_mumbai` | Ferro Silicon Magnesium (Mumbai) | Rs/kg | `190` |
| `low_sulp_cal_petro_coke` | Import Low-Sulphur CPC 98% (Raipur) | Rs/kg | `59` |
| `calcinated_petroleum_coke_9_4mm` | Calcined Petroleum Coke 0-4mm (Indian) | Rs/kg | `80` |
| `lam_coke` | Lam Coke (Ex-Plant) | Rs/tonne | `35,000` |

The **6 extended** commodities also visible on the dashboards are: Sponge Iron
(Mandi Gobindgarh), Ferro Silicon 70/75 (Raipur), Ferro Manganese 70/75
(Raipur), Silico Manganese (Mumbai), High Ferro Manganese 78% (Raipur), and
Graphite Petroleum Coke (Mumbai).

### Key Formatting Rules
- **Verbatim Text Preservation**: Prices are extracted as text strings, not numeric values. Price ranges (e.g., `47,500 - 46,500`) are captured as the upper-bound value; currency formatting is preserved from the PDF source.
- **Explicit Missing Values**: If a core commodity price is omitted in a particular issue, the cell contains an empty string `""` rather than missing or shifted data. (Extended and archived values may simply be absent when not printed.)

---

## When Something Looks Wrong

- **Missing Row**: If you uploaded a PDF but no new row appears in the spreadsheet within 1-2 minutes:
  1. Confirm the file is a PDF under 15 MB and was uploaded into the correct Drive folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`.
  2. The file may have failed Gemini extraction or Zod validation. Contact system operators to review the system logs and `_system/dead_letters` queue.
- **Requesting a Reprocess**: If a file failed or was updated, an operator can trigger a manual reprocess by clearing the Firestore lock document. See [docs/support_runbook.md](file:///c:/Naren/shuddhi-moolam/docs/support_runbook.md) for details.
