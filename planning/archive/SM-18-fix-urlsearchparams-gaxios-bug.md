---
type: bug
status: in-review
points: 3
priority: high
scope: all-environments
---

# SM-18: Fix `URLSearchParams` crash in Drive download (gaxios bug)

## Problem

All files dropped in staging (and prod) after the latest deployment are
failing at the `process` stage with:

```
Value of "this" must be of type URLSearchParams
```

This crash occurs inside `functions/src/drive/download.ts` when
`drive.files.get({ alt: 'media' })` is called. Root cause is a `this`-
binding bug in **gaxios@6.6+** (the HTTP client used by googleapis) when
constructing query parameters for media downloads.

4 confirmed failures in `pipeline_runs_staging`, all with this identical
error. Reproduced on the live deployed function **after** the GH Actions
deploy succeeded.

## Fix

1. Pin `gaxios` to `6.5.0` in `functions/package.json` by adding an
   explicit `"gaxios": "6.5.0"` to `dependencies` (overrides the transitive
   version pulled in by googleapis).
2. Run `npm install` to update `package-lock.json`.
3. Verify the fix locally by running `npm test` — the download mock should
   still pass.
4. Alternatively, check if a newer `googleapis` patch release has resolved
   this and upgrade there instead.

## Acceptance Criteria

- No new `URLSearchParams` failures appear in `pipeline_runs_staging` after
  a new file is dropped.
- All 26 existing tests still pass.
- Lint passes.

## References

- [gaxios issue](https://github.com/googleapis/gaxios/issues/591)
- ADR-005: environment isolation
- Affected file: `functions/src/drive/download.ts`
