# 0008 Phase 1 Supports CC-Only Videos

Date: 2026-06-06

## Status

Accepted

## Context

Whisper transcription requires a GPU or long CPU processing time (30–90 s per video). For the MVP, the priority is a fast import loop (< 5 s) and zero GPU infrastructure.

## Decision

Phase 1 rejects any YouTube video without an English closed-caption track. The API returns `400` with `"This video has no English captions — Phase 1 only supports CC-enabled videos"`. No `videos` row is created for such requests.

## Alternatives Considered

1. Accept all videos, fall back to Whisper — rejected; Whisper adds infrastructure complexity and breaks the < 5 s import target.
2. Accept all videos, skip transcription and show a `"no captions"` message — rejected; the core practice loop requires a sentence list.

## Consequences

Positive:
- Import-to-ready time < 5 s is achievable.
- No GPU / Whisper infrastructure needed in Phase 1.
- Simplifies `CcImportJob` — only one code path.

Tradeoffs:
- Users are limited to CC-enabled videos; some popular content is excluded.
- Auto-generated captions (`trackKind = asr`) are accepted but may contain errors (open question in spec §11.1; a quality warning is a Phase 2 concern via US-205).

## Follow-Up

- Phase 2: implement Whisper path for non-CC videos (US-201).
- Phase 2: add ASR quality warning banner (US-205).
