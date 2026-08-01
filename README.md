# Shuddhi-Moolam 🪔

> **"Purifying to the raw source."** An AI-powered, event-driven pipeline that
> turns weekly table-heavy PDF newsletters into clean, structured rows in a
> master Google Sheet — automatically, the moment a file lands in Drive.

Shuddhi-Moolam watches a Google Drive folder for new PDF newsletters (e.g.
*Minerals & Metals Review*), extracts the target price line-items with Gemini
using **structured outputs**, and appends each record to the correct
year-specific tab of a continuously growing master spreadsheet — entirely on
serverless GCP/Firebase infrastructure.

This repository is built and operated by a **multi-agent swarm** (seeded from
[SwarmKit](https://github.com/crnarendran/swarmkit)). Any AI coding tool that
opens this repo must read [`AGENTS.md`](AGENTS.md) first.

---

## Architecture

Entirely serverless and event-driven:

| Concern | Service |
|---|---|
| File storage & trigger | Google Drive API (push notifications / `changes.watch`) |
| Compute | Firebase Cloud Functions (**Node.js + TypeScript**) |
| AI extraction | Google Gemini (Flash model) with structured JSON output |
| Data destination | Google Sheets API (year-routed tabs) |
| State / dedup | Firestore |

## Data flow

1. **Trigger** — a PDF (e.g. `MMRW27072026.pdf`) is uploaded to the target
   Drive folder (or a subfolder). Drive dispatches a push webhook carrying the
   change to a Cloud Function endpoint.
2. **Ingest & extract** — the function resolves the changed `fileId`, retrieves
   the PDF, and calls Gemini with a strict JSON schema
   (`response_mime_type: application/json` + Zod validation) to return a
   structured object of the target price fields.
3. **Route & append** — the function parses the publication **year** from the
   issue date, ensures a `Data_<year>` tab exists (creating it with headers if
   not), and appends the extracted record as a new row.

See [`knowledge/domain_model.md`](knowledge/domain_model.md) for the full
domain model and the canonical extraction schema, and
[`knowledge/adr/`](knowledge/adr/) for the design decisions.

## Repository layout

```text
shuddhi-moolam/
├── AGENTS.md              # Agent entry point — read first, any tool
├── CLAUDE.md              # Imports AGENTS.md so Claude Code auto-loads it
├── .agents/               # Swarm role configs + skills (SOPs)
├── knowledge/             # Static project knowledge (OKF: Markdown + YAML)
│   ├── adr/               # Architecture Decision Records
│   ├── domain_model.md    # What this project is + the extraction contract
│   └── infrastructure.md  # Projects, APIs, secrets, known gaps
├── planning/              # Dynamic project state
│   ├── backlog/           # Points-based feature tickets (SM-01 … SM-10)
│   └── archive/           # Completed / deprecated tickets
├── docs/                  # User-facing docs (synced to the docs portal)
├── scripts/syncDocs.ts    # Pushes docs/knowledge into the docs-portal
└── .github/workflows/     # CI (docs sync; deploy CI added later)
```

`functions/` (the Cloud Functions app) is intentionally **not yet scaffolded** —
it is the first backlog ticket (SM-01) and gets built via TDD, not committed as
an empty skeleton.

## Status

This repo is in the **prep/planning** stage. The swarm architecture, knowledge
base, docs-portal integration, and the full feature backlog are in place; the
pipeline itself is queued in [`planning/backlog/`](planning/backlog/). Several
prerequisites are human-only (Blaze billing, GCP API enablement, service
account + IAM, GitHub secrets) — see the **Known Gaps** section of
[`knowledge/infrastructure.md`](knowledge/infrastructure.md).

## License

MIT
