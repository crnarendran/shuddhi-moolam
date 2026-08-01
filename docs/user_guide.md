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

## Reading an Extracted Row

Each row appended to a year tab corresponds to one weekly issue. The table below lists the 13 canonical columns in their exact left-to-right order:

| Column Header | Field Description | Example Value |
|---|---|---|
| `newsletter_issue_date` | Issue date range printed on the front page | `JULY 27-AUGUST 02` |
| `year` | 4-digit publication year | `2026` |
| `crca_bundle_mumbai` | Melting Scrap (CRCA – Bundle) LSLP (Mumbai/Pune) | `38,500 - 39,000` |
| `crca_bundle_chennai` | Melting Scrap (CRCA – Bundle) LSLP (Chennai) | `40,000` |
| `melting_foundry_scrap_mumbai` | Melting Scrap (Mumbai/Pune) (Foundry) | `37,000` |
| `fe_mn_hc_mumbai` | Ferro Manganese HC (Ferro Alloys – Mumbai) | `68,000` |
| `fe_si_70_75_mumbai` | Ferro Silicon (70–75%) (Ferro Alloys – Mumbai) | `95,000` |
| `low_sulp_cal_petro_coke` | Low Sulp. (max 1.5%) cal Petro. Coke 98% (Raipur) | `22,500` |
| `fe_si_mg_mumbai` | Ferro Silicon Magnesium (Ferro Alloys – Mumbai) | `115,000` |
| `cu_lme` | LME Settlement Rate, Copper Grade A | `9,850` |
| `cu_domestic` | Domestic / MMR Landed price for Copper | `845` |
| `fe_cr_mumbai` | Ferro Chromium (High or Low Carbon), Mumbai market | `102,000` |
| `pig_iron_foundry_gr_pune` | Pig Iron Foundry Grade – A (Pune) | `41,500` |

### Key Formatting Rules
- **Verbatim Text Preservation**: Prices are extracted as text strings, not numeric values. Price ranges (e.g., `47,500 - 46,500`) and currency formatting are preserved verbatim from the PDF source.
- **Explicit Missing Values**: If a specific commodity price is omitted or unlisted in a particular issue, the cell will contain an empty string `""` rather than missing or shifted data.

---

## When Something Looks Wrong

- **Missing Row**: If you uploaded a PDF but no new row appears in the spreadsheet within 1-2 minutes:
  1. Confirm the file is a PDF under 15 MB and was uploaded into the correct Drive folder `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb`.
  2. The file may have failed Gemini extraction or Zod validation. Contact system operators to review the system logs and `_system/dead_letters` queue.
- **Requesting a Reprocess**: If a file failed or was updated, an operator can trigger a manual reprocess by clearing the Firestore lock document. See [docs/support_runbook.md](file:///c:/Naren/shuddhi-moolam/docs/support_runbook.md) for details.
