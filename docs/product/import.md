# Product: Video Import

Covers US-101. Phase 1 only — CC-enabled YouTube videos.

## Behaviour

- Accepts `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`.
- Client extracts `video_id` without a network call before submit.
- Server re-validates URL, checks YouTube Data API v3 for CC availability.
- Videos with no English CC return `400` in Phase 1.
- Private or deleted videos return `404` / `403`.
- Duplicate `youtube_id` with `transcript_status = ready` returns immediately; no reprocessing.
- Duplicate `youtube_id` in `queued` / `processing` state links the current user to the existing import and returns current status.

## Background Job (CcImportJob)

1. `status → processing` on start.
2. yt-dlp downloads SRT/VTT subtitle file via `Process.Start()`.
3. Parser splits into sentences with `start_time_ms` / `end_time_ms`.
4. DeepL translates each sentence (graceful degradation on quota exceeded — stores `null`).
5. Bulk insert sentences, `status → ready`, `sentence_count` updated.
6. Supabase Realtime broadcasts `video_ready` event to frontend.

## Retry Policy

- Hangfire retries 3× on failure: 30 s → 5 min → 30 min backoff.
- After 3 failures: card shows `failed` state + error logged to Sentry with `job_id`.

## Timing Targets

| Step | Target |
|---|---|
| `POST /api/videos/import` response | < 300 ms |
| Import-to-ready (CC video) | < 5 s |

## Realtime Fallback

Frontend polls `GET /api/jobs/{id}/status` every 3 s if Supabase Realtime disconnects.
The API returns status only when the authenticated user has a `user_videos` link for that job/video.
Max polling: 5 min, then manual refresh prompt.

## Error Messages

| Condition | HTTP | Message |
|---|---|---|
| Invalid URL | 400 | `"Invalid URL — please paste a YouTube link"` |
| No English CC | 400 | `"This video has no English captions — Phase 1 only supports CC-enabled videos"` |
| Video not found | 404 | `"Video not found or has been removed"` |
| Private / age-restricted | 403 | `"This video is not publicly accessible"` |
| YouTube API quota | 503 | `"Service temporarily unavailable — please try again later"` |
