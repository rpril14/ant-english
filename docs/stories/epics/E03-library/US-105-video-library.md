# US-105 · Manage video library

**Epic:** E03 — Library  
**Lane:** normal  
**Status:** implemented  
**Product doc:** [docs/product/library.md](../../../product/library.md)

## Story

As Alex, I want to see all my saved videos, track progress, and filter by status, so that I can continue where I left off and know which videos I have finished.

## Acceptance Criteria

**AC-105-1 — Library grid**
- 3-col desktop / 2-col tablet / 1-col mobile
- Card: thumbnail, title, sentence count, progress bar, last studied date

**AC-105-2 — Card states**: queued, processing, ready, in-progress, completed, failed (see product doc)

**AC-105-3 — Filter pills**: All, Learning, Done, Favorites

**AC-105-4 — Sort**: Recently added (`added_at DESC`), Progress (% DESC), Duration (`duration_seconds DESC`), A–Z (Vietnamese locale)

**AC-105-5 — Favourite toggle**: optimistic update; persisted within 2 s

**AC-105-6 — Custom tags**: add tag → pill on card + filter option

**AC-105-7 — Remove from library**: deletes `user_videos` row only; shared rows unaffected

**AC-105-8 — Import bar always visible**: pinned at bottom

## Risk Flags

- Data model (`user_videos` mutations)
- Public contracts (`GET /api/library`, `DELETE /api/library/{video_id}`)

## Validation

- Unit: card state derivation logic, sort/filter functions
- Integration: favourite toggle upsert; tag update; remove
- E2E: library renders with correct states; filter pills work

## Proof Status

unit: yes | integration: no | e2e: no | platform: no

## Evidence

- 2026-06-07: Fixed `GET /api/library` runtime failure by ordering `user_videos` before projecting to `LibraryItem`; `dotnet test src\AntEnglish.sln` passed 42/42.
- 2026-06-08: Redesigned `LibraryClient.tsx` with warm paper theme (from Claude Design handoff). Added Duration and A–Z sort options (`SortId` extended in `library.ts`; `applySort` updated). Added "Saved" shortcut action on each card. Switched UI language to English throughout (`LibraryClient.tsx`, `ImportBar.tsx`). All 19 library unit tests pass.
