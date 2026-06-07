# Product: Video Library

Covers US-105.

## Library Grid

- Desktop: 3 columns. Tablet: 2 columns. Mobile: 1 column.
- Each card: thumbnail, title, sentence count, progress bar, last studied date.
- Import bar pinned at bottom of screen at all times.

## Card States

| State | Trigger | Button |
|---|---|---|
| `queued` | Job just enqueued | Spinner, disabled |
| `processing` | Worker running | "Processing…", disabled |
| `ready` | Never studied | "Start practicing" |
| `in-progress` | 1 ≤ completed < total | "Continue (X / N)" |
| `completed` | completed = total | "Review again" (green) |
| `failed` | 3 retries exhausted | "Import failed — Retry" |

## Filtering

Filter pills: All, In progress, Completed, Favourites, custom tags.

## Sorting

- Recently studied: `last_studied_at DESC`
- Progress: `completed_sentences / total_sentences DESC`

## Favourite Toggle

- Click heart icon: `is_favorited` toggles with optimistic update.
- Persisted to `user_videos` within 2 s.

## Custom Tags

- User adds tags to a card; tags stored in `user_videos.custom_tags text[]`.
- Tags appear as pills on the card and as filter options.

## Remove from Library

- Deletes `user_videos` row only.
- Shared `videos` and `sentences` rows remain (other users unaffected).

## Realtime Card Updates

- Frontend subscribes to Supabase Realtime channel `video:{job_id}`.
- On `video_ready` event: card transitions from `processing` → `ready` without page refresh.
- Fallback: 3 s poll of `GET /api/jobs/{id}/status` if WebSocket disconnects.
- If a user imports a video while another user's import is already queued or processing, the existing job is linked into the current user's library.
