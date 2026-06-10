# Product: Video Library

Covers US-105.

## Library Grid

- Desktop: 3 columns. Tablet: 2 columns. Mobile: 1 column.
- Each card: thumbnail (real or pastel gradient fallback), title, sentence count, progress bar, last studied date, status badge, favourite toggle, "Saved" shortcut.
- Import bar pinned at bottom of screen at all times.
- UI language: English.
- Theme: warm paper palette (`#F1EFE8` base) with teal / coral / purple accents; fonts Be Vietnam Pro (body) + Newsreader (stat figures).

## Card States

| State | Trigger | Button |
|---|---|---|
| `queued` | Job just enqueued | Spinner, disabled |
| `processing` | Worker running | "Processing…", disabled |
| `ready` | Never studied | "Continue" |
| `learning` | 1 ≤ practiced < total | "Continue" |
| `done` | practiced = total | "Review" |
| `failed` | 3 retries exhausted | (failed badge) |

## Filtering

Filter pills: All, Learning, Done, Favorites.

## Sorting

- Recently added: `added_at DESC` (default)
- Progress: `completed_sentences / total_sentences DESC`
- Duration: `duration_seconds DESC`
- A–Z: `title ASC` (Vietnamese locale)

## Favourite Toggle

- Click heart icon: `is_favorited` toggles with optimistic update.
- Persisted to `user_videos` within 2 s.

## Custom Tags

- User adds tags to a card; tags stored in `user_videos.custom_tags text[]`.
- Tags appear as pills on the card and as filter options.

## Remove from Library

- Deletes the user's `user_videos` row.
- Cascade-deletes the user's `user_progress` and `saved_sentences` rows for sentences in that video.
- Shared `videos` and `sentences` rows remain (other users unaffected).

## Realtime Card Updates

- Frontend subscribes to Supabase Realtime channel `video:{job_id}`.
- On `video_ready` event: card transitions from `processing` → `ready` without page refresh.
- Fallback: 3 s poll of `GET /api/jobs/{id}/status` if WebSocket disconnects.
- If a user imports a video while another user's import is already queued or processing, the existing job is linked into the current user's library.
