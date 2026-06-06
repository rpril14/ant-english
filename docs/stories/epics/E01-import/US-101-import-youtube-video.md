# US-101 · Import a YouTube video

**Epic:** E01 — Import  
**Lane:** high-risk  
**Status:** planned  
**Product doc:** [docs/product/import.md](../../../product/import.md)

## Story

As Alex, I want to paste a YouTube URL and have it ready to practice in seconds, so that I can start learning from any video I find without a long wait.

## Acceptance Criteria

**AC-101-1 — URL validation (client-side)**
- URL matches `youtu.be/<id>`, `youtube.com/watch?v=<id>`, or `youtube.com/shorts/<id>`
- Submit button activates; `video_id` extracted without network call

**AC-101-2 — Invalid URL rejected**
- Non-YouTube URL: inline error `"Invalid URL — please paste a YouTube link"`, submit disabled

**AC-101-3 — No English CC rejected**
- Server returns `400`: `"This video has no English captions — Phase 1 only supports CC-enabled videos"`
- No `videos` row created

**AC-101-4 — Private/unavailable video rejected**
- Server returns `404`: `"Video not found or has been removed"`

**AC-101-5 — Duplicate video handled**
- Same `youtube_id` with `transcript_status = ready` → returns `{ status: "ready", video_id }` immediately

**AC-101-6 — Card appears instantly**
- Card in `"Processing…"` state within 200 ms of submit
- `POST /api/videos/import` response < 300 ms

**AC-101-7 — Card updates when ready**
- Card transitions to `"Start practicing"` without page refresh
- Import-to-ready < 5 s for CC video

**AC-101-8 — Background job failure**
- After 3 Hangfire retries: card shows `"Import failed"` + retry button
- Error logged to Sentry with `job_id`

## Risk Flags

- External systems (YouTube Data API v3, yt-dlp, DeepL, Hangfire)
- Data model (creates `videos`, `sentences`, `user_videos` rows)
- Public contracts (`POST /api/videos/import` response shape)

## Validation

- Unit: URL extraction, duplicate-check logic, error mapping
- Integration: YouTube API mock → CC check; yt-dlp → sentence parse; DeepL degradation
- E2E: paste URL → card transitions from queued → processing → ready

## Proof Status

unit: no | integration: no | e2e: no | platform: no
