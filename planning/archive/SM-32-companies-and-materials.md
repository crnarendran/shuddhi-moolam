---
id: SM-32
title: Companies & Materials (BOM) management
type: ticket
points: 5
status: in-review
depends_on: [SM-30]
tags: [backlog, companies, bom, materials, cost-impact, ux]
---
# SM-32 — Companies & Materials (bill-of-materials)

## Implemented (dev)
- **Pure math** (`materials.ts`): `Company`/`Material`/`Composition` types +
  `blendedCost` and `contributions` (ratio×price, range-normalized, %
  breakdown) — vitest-tested (4 cases).
- **Firestore CRUD hooks** (`useCompanies`): companies owned by the user
  (`where ownerUid == uid`), add/update/delete with a **materials cascade**
  delete; `useMaterials(companyId)` for a company's materials (save/delete).
- **Companies tab** (`CompaniesPage`): company list + add/delete; per-company
  materials list; a `MaterialEditor` with name/unit + a composition table
  (commodity picker + ratio rows + add/remove) and a **live blended-cost
  preview** with per-row % contribution. Validation (name + positive ratios);
  signed-out empty state; responsive two-column layout. No AI chat on this tab.
- vitest (16 total) + oxlint + tsc + production build green.

**Follow-up (minor, not built):** the one-click "create a company from my
current Cost-Impact weights" seed. Cost-Impact still uses loose weights;
pointing it at a selected company/material is the SM-33-era follow-up noted
in Notes.

## Goal
Let a user (typically a consultant) manage **multiple companies**, and for each
company define the **materials** it manufactures, where each material is a mix
of commodities in given ratios (a bill-of-materials). This generalizes the
existing Cost-Impact consumption weights — which today is a single anonymous
BOM — into named, per-company materials, and is the input to the guidance
report (SM-33).

## Data model (owned per user, SM-30 rules)
```
companies/{companyId}: {
  ownerUid, name, notes?, createdAt, updatedAt
}
companies/{companyId}/materials/{materialId}: {
  name,                 // e.g. "Ductile Iron GR-500"
  unit,                 // e.g. "per kg" / "per tonne"
  composition: [
    { commodityKey, ratio }   // amount of this commodity per unit of product
  ],
  updatedAt
}
```
- `ratio` is a positive number (kg of commodity per unit of product). It need
  not sum to 1 — real BOMs include yield/loss. The UI shows the sum and a
  normalized % breakdown for readability, but stores raw ratios.
- `commodityKey` must be a valid registry key. Extended/archived commodities
  are selectable too (a company may care about ones the reports hide).

## UX
### Companies
- A **Companies** area (new tab, or a section within Settings). List of the
  user's companies with name + material count; "Add company" (name, optional
  notes); edit / delete (confirm; deleting removes its materials).
- A "current company" selector in the header of the guidance report (SM-33) so
  reports scope to one company at a time.

### Materials (within a company)
- List of materials; "Add material".
- Material editor: name, unit, and a **composition table** — rows of
  `[commodity picker] [ratio input] [× remove]`, "Add commodity" to append.
  Reuse the SM-31 commodity picker (grouped, searchable).
- **Live blended-cost preview**: as rows change, show
  `Σ(ratio × latest price)` using the newest `historical_prices` record, plus a
  per-commodity contribution bar (which commodities dominate the cost) and the
  normalized % breakdown. This is the same math Cost-Impact already uses.
- Validation: at least one row; ratios > 0; no duplicate commodity in one
  material (or merge). Unsaved-changes guard.

### Migration from Cost-Impact
On first use, if the user has Cost-Impact weights (migrated to
`user_settings` in SM-30), offer a one-click "Create a company from my current
cost model" that seeds a company + one material whose composition is those
weights. Keeps continuity for existing users.

## Reuse / shared logic
- `blendedCost(material, priceRecord)` and `contributionByCommodity(material,
  priceRecord)` as pure functions in the reporting lib (mirrors backend
  `reporting/`), unit-tested and reused by the editor preview and SM-33.

## Acceptance / TDD
- CRUD: create/edit/delete companies and materials persists to Firestore and is
  private to the owner (rules from SM-30).
- `blendedCost` / `contributionByCommodity` unit tests over seeded materials +
  price records (range strings normalized via the existing `normalizePrice`).
- Live preview updates as composition changes; % breakdown sums to 100%.
- Deleting a company cascades to its materials; guarded by confirm.
- Migration seeds a company+material from existing weights exactly once.
- Responsive + theme-correct.

## Notes
This is the natural home for the consumption model that Cost-Impact (SM-26)
approximates — once shipped, Cost-Impact can optionally read a selected
company/material instead of loose weights (follow-up, not required here).
