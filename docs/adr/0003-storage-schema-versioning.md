# ADR-0003: Storage Schema Versioning (`v2` Clean Slate)

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
In v1, user progress was spread across four separate unversioned `localStorage` keys (`nursing_exam_mistakes_v1`, `nursing_exam_stats_v1`, `nursing_saved_exams_v1`) and mistakes were stored as a plain array of IDs without timestamps. Because mistakes had no per-item timestamps and stats had no `lastResetAt` timestamp, cloud synchronization suffered from two bugs:
1. Removing a mistake on Device A was overwritten by Device B's stale mistake list via set-union.
2. Resetting statistics on Device A was overwritten by Device B's stale higher counters via `Math.max`.

Because there are currently no external production users relying on v1 local data, we do not need backward-compatibility shims for v1 storage keys.

## Decision
1. Consolidate persistent user progress under a single versioned key `nursing_progress_v2` in `localStorage` (and matching `schemaVersion: 2` in Firestore `users/{uid}`).
2. Store `mistakes` as a timestamped map `{ [questionId]: { status: 'mistake' | 'resolved', updatedAt: number } }` and include `lastResetAt: number` inside `userStats`.
3. Include `schemaVersion: 2` at the root of the persisted object so any future `v2 -> v3` schema evolution has a clean migration hook in `core/storage.js`.

## Consequences
- **Positive**:
  - Eliminates legacy v1 migration complexity while establishing versioned storage from day one of v2.
  - Fixes both cross-device synchronization bugs deterministically.
- **Negative / Trade-offs**:
  - Any developer browser profile that tested v1 starts with clean v2 stats/mistakes (desired).
