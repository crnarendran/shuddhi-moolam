import { CORE_KEYS } from '../gemini/components';

// The master Sheet carries only the core-tier components. Extended
// components are persisted to Firestore and shown on dashboards but are
// intentionally kept out of the Sheet until promoted (flip a component's
// 'tier' to 'core' in ../gemini/components.ts). Deriving from CORE_KEYS
// keeps the Sheet columns in lockstep with the registry.
//
// Column-count note: upsert.ts maps the last header to a single A-Z
// column letter, so SHEET_HEADERS must stay <= 26 columns. With 16 core
// components + 4 metadata columns that is 20 (column T) — safe.

export const SHEET_HEADERS: string[] = [
  'filename',
  'date',
  ...CORE_KEYS,
  'source_pages',
  'last_modified_date',
];

// Title-cased header labels written to row 1 of each year tab (e.g.
// 'aluminium_ingot' -> 'Aluminium Ingot'). Single source of truth so the
// tab-creation path (routing.ts) and the reset path (clearTabs) can never
// disagree on the header names.
export const SHEET_HEADERS_FRIENDLY: string[] = SHEET_HEADERS.map((header) =>
  header
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);
