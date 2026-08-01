---
title: Shuddhi-Moolam Overview
section: Documentation
category: Guides
requiresLogin: false
---
# Shuddhi-Moolam — Overview

Shuddhi-Moolam turns weekly PDF newsletters into structured spreadsheet rows,
automatically. When a new PDF lands in a watched Google Drive folder, the system
reads it with AI, pulls out a fixed set of commodity prices, and appends them to
the right year's tab in a master Google Sheet — no manual copy-paste.

## What it does, end to end

1. **A PDF arrives** in the target Drive folder (or a subfolder). For example,
   `MMRW27072026.pdf`, the *Minerals & Metals Review* issue for that week.
2. **Google Drive notifies the pipeline** via a push webhook.
3. **Gemini extracts the prices** into a strict, predefined structure (issue
   date, year, and the target metal/scrap/ferro-alloy prices). Prices that
   appear as ranges are preserved exactly as written.
4. **The record is filed by year.** The pipeline finds (or creates) the tab for
   that year — `Data_2026` — and appends the extracted values as a new row.

The result: a master sheet that keeps growing on its own, one clean row per
weekly issue, organized into per-year tabs.

## Why AI extraction

Source newsletters change layout, move tables between pages, and format prices
inconsistently. A rules-based parser breaks every time the source shifts. Using
Gemini with a strict output schema keeps extraction robust to those changes
while still guaranteeing a predictable, validated structure downstream.

## Where to go next

- **Setup & operations:** see the Support / Runbook doc.
- **What's being built:** see the feature backlog (`planning/backlog/`).
- **The exact data contract:** see the Domain Model
  (`knowledge/domain_model.md`), which lists every extracted field.
- **Design rationale:** see ADR 001 (`knowledge/adr/`).
