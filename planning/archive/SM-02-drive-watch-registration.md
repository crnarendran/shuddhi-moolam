---
id: SM-02
title: Drive changes.watch registration + channel renewal
type: ticket
points: 5
status: todo
depends_on: [SM-01]
tags: [backlog, ingestion, drive, scheduled]
---
# SM-02 — Drive `changes.watch` registration + channel renewal

## Goal
Establish and keep alive the Google Drive push-notification channel that fires
the pipeline when a PDF is uploaded to the target folder (or any subfolder).

**Target folder:** `1RgArYZYgmR-ZJB7Gne5fZA7nlufIKaeb` (root; watch all
subfolders) — see `knowledge/infrastructure.md` → Monitored resources. Read from
config (`DRIVE_ROOT_FOLDER_ID`), not hardcoded.

## Scope
- A callable/HTTP admin function to **register** a `changes.watch` channel for
  the target folder tree, persisting `channelId`, `resourceId`, and `expiration`
  to Firestore.
- A **scheduled function** (Cloud Scheduler / Pub-Sub) that renews the channel
  before its ~7-day expiry — re-registering and updating stored state, and
  stopping the old channel.
- Subfolder coverage: Drive `changes` is account/drive-scoped, so the handler
  (SM-03) filters by folder ancestry; document that decision here.

## Acceptance criteria (TDD)
- Registration writes channel state to Firestore (mocked Drive client).
- The renewal function re-registers when expiry is within the threshold and is a
  no-op when it isn't.
- Old channel is stopped on renewal (no leaked channels).

## Notes / escalation
- Requires the Drive API enabled + a service account with folder access — human
  prerequisites (`infrastructure.md` → Known Gaps). Build/test against mocks;
  live registration waits on those.
